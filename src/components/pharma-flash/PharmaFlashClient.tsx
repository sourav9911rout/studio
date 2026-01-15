
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  format,
  isToday,
  eachDayOfInterval,
  parse,
  startOfToday,
} from 'date-fns';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
} from 'firebase/firestore';
import { useFirestore, useUser, useAuth } from '@/firebase';
import {
  setDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import type { DailyHighlight, DrugHighlight, InfoWithReference } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import PinDialog from './PinDialog';
import DownloadDialog from './DownloadDialog';
import DuplicateDrugDialog, {
  type DuplicateDrugInfo,
} from './DuplicateDrugDialog';
import ReferenceDialog from './ReferenceDialog';
import {
  Pencil,
  Save,
  X,
  Calendar as CalendarIcon,
  Loader2,
  Download,
  Trash2,
  Sparkles,
  BookText,
  PlusCircle,
  GripVertical
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion"
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { cn } from '@/lib/utils';
import { Textarea } from '../ui/textarea';
import { ThemeToggle } from '../ThemeToggle';
import { getDrugInfo, GetDrugInfoOutput } from '@/ai/flows/drug-info-flow';

const offLabelUseSchema = z.object({
  value: z.string(),
  references: z.array(z.string().url()),
});

const drugHighlightSchema = z.object({
    id: z.string(),
    drugName: z.string().min(1, 'This field is required.'),
    drugClass: z.string(),
    mechanism: z.string(),
    uses: z.string(),
    sideEffects: z.string(),
    routeOfAdministration: z.string(),
    dose: z.string(),
    dosageForm: z.string(),
    halfLife: z.string(),
    clinicalUses: z.string(),
    contraindication: z.string(),
    offLabelUse: offLabelUseSchema,
    funFact: z.string(),
  });

const dailyHighlightSchema = z.object({
    date: z.string(),
    drugs: z.array(drugHighlightSchema),
});


type FormFieldType = {
  key: keyof Omit<DrugHighlight, 'id' | 'drugName' | 'offLabelUse'>;
  label: string;
  isTextarea: boolean;
};

const formFields: FormFieldType[] = [
  { key: 'drugClass', label: 'Drug Class', isTextarea: false },
  { key: 'mechanism', label: 'Mechanism of Action', isTextarea: true },
  { key: 'uses', label: 'Common Uses', isTextarea: true },
  { key: 'sideEffects', label: 'Side Effects', isTextarea: true },
  { key: 'routeOfAdministration', label: 'Route of Administration', isTextarea: false },
  { key: 'dose', label: 'Dose', isTextarea: false },
  { key: 'dosageForm', label: 'Dosage Form', isTextarea: false },
  { key: 'halfLife', label: 'Half-life', isTextarea: false },
  { key: 'clinicalUses', label: 'Clinical uses', isTextarea: true },
  { key: 'contraindication', label: 'Contraindication', isTextarea: true },
  { key: 'funFact', label: 'Fun Fact', isTextarea: true },
];

const emptyDrugData: Omit<DrugHighlight, 'id'> = {
  drugName: '',
  drugClass: '',
  mechanism: '',
  uses: '',
  sideEffects: '',
  routeOfAdministration: '',
  dose: '',
  dosageForm: '',
  halfLife: '',
  clinicalUses: '',
  contraindication: '',
  offLabelUse: { value: '', references: [] },
  funFact: '',
};

const getEmptyDailyHighlight = (date: string): DailyHighlight => ({
    date: date,
    drugs: [],
});

// Helper to safely get the display value for a field, whether it's a string or an object
const getDisplayValue = (fieldData: any): string => {
    if (typeof fieldData === 'string') {
      return fieldData;
    }
    if (fieldData && typeof fieldData === 'object' && 'value' in fieldData && typeof fieldData.value === 'string') {
      return fieldData.value;
    }
    return '';
  };
  
// Helper function to normalize incoming Firestore data
const normalizeDrugHighlight = (data: any): DrugHighlight => {
    const normalized: DrugHighlight = { 
      id: data?.id || new Date().getTime().toString(),
      ...emptyDrugData 
    };
  
    // Handle simple string fields
    Object.keys(emptyDrugData).forEach(keyStr => {
      const key = keyStr as keyof Omit<DrugHighlight, 'id'>;
      if (key !== 'offLabelUse') {
        normalized[key] = getDisplayValue(data?.[key]);
      }
    });
  
    // Handle the potentially complex offLabelUse field
    const offLabelData = data?.offLabelUse;
    if (typeof offLabelData === 'string') {
      normalized.offLabelUse = { value: offLabelData, references: [] };
    } else if (offLabelData && typeof offLabelData === 'object' && 'value' in offLabelData) {
      normalized.offLabelUse = {
        value: getDisplayValue(offLabelData),
        references: Array.isArray(offLabelData.references) ? offLabelData.references : [],
      };
    } else {
      normalized.offLabelUse = { value: '', references: [] };
    }
  
    return normalized;
};
  

const normalizeDailyHighlight = (date: string, data: any): DailyHighlight => {
    if (!data || !Array.isArray(data.drugs)) {
        return getEmptyDailyHighlight(date);
    }
    return {
        date: data.date || date,
        drugs: data.drugs.map(normalizeDrugHighlight),
    };
};
  

export default function PharmaFlashClient() {
    const [isClient, setIsClient] = useState(false);
    const [selectedDate, setSelectedDate] = useState(startOfToday());
    const [dailyData, setDailyData] = useState<DailyHighlight | null>(null);
    const [allDrugData, setAllDrugData] = useState<Map<string, DrugHighlight[]>>(new Map());
    const [datesWithData, setDatesWithData] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isFetchingAI, setIsFetchingAI] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState(false);
    const [pendingDate, setPendingDate] = useState<Date | null>(null);
    const [isDuplicateDrugDialogOpen, setIsDuplicateDrugDialogOpen] = useState(false);
    const [duplicateDrugInfo, setDuplicateDrugInfo] = useState<DuplicateDrugInfo | null>(null);
    const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
    const [activeDrugIndex, setActiveDrugIndex] = useState<number | null>(null);
  
    const { toast } = useToast();
    const firestore = useFirestore();
    const auth = useAuth();
    const { user, isUserLoading } = useUser();
  
    const form = useForm<DailyHighlight>({
        resolver: zodResolver(dailyHighlightSchema),
        defaultValues: getEmptyDailyHighlight(format(selectedDate, 'yyyy-MM-dd')),
    });
  
    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "drugs",
        keyName: "fieldId",
      });

    const { formState: { isDirty }, getValues, watch, reset, control } = form;
  
    const dateString = useMemo(
      () => format(selectedDate, 'yyyy-MM-dd'),
      [selectedDate]
    );

    const watchedDrugs = watch('drugs');
    
    useEffect(() => {
      setIsClient(true);
    }, []);
  
    useEffect(() => {
      if (firestore && user === null && !isUserLoading) {
        initiateAnonymousSignIn(auth);
      }
    }, [firestore, user, isUserLoading, auth]);
  
    const fetchAllDrugData = useCallback(async () => {
        if (!firestore) return;
        const q = query(collection(firestore, 'drugHighlights'));
        const querySnapshot = await getDocs(q);
        const newAllData = new Map<string, DrugHighlight[]>();
        const newDatesWithData = new Set<string>();
        querySnapshot.forEach((doc) => {
            const data = doc.data() as { drugs: any[] };
            if (data.drugs && data.drugs.length > 0) {
              const normalizedDrugs = data.drugs.map(normalizeDrugHighlight);
              newAllData.set(doc.id, normalizedDrugs);
              newDatesWithData.add(doc.id);
            }
        });
        setAllDrugData(newAllData);
        setDatesWithData(newDatesWithData);
      }, [firestore]);
    
      useEffect(() => {
        fetchAllDrugData();
      }, [fetchAllDrugData]);

      
    useEffect(() => {
      if (!firestore) return;
      const fetchDailyData = async () => {
        setIsLoading(true);
        try {
          const docRef = doc(firestore, 'drugHighlights', dateString);
          const docSnap = await getDoc(docRef);
  
          if (docSnap.exists()) {
            const data = docSnap.data();
            const normalizedData = normalizeDailyHighlight(dateString, data);
            setDailyData(normalizedData);
            reset(normalizedData);
          } else {
            const emptyData = getEmptyDailyHighlight(dateString);
            setDailyData(emptyData);
            reset(emptyData);
          }
        } catch (error) {
          console.error('Error fetching drug data:', error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to fetch drug information.',
          });
        } finally {
          setIsLoading(false);
        }
      };
  
      fetchDailyData();
    }, [dateString, reset, toast, firestore]);
  
    const datesForNavigation = useMemo(() => {
      const today = startOfToday();
      return eachDayOfInterval({
        start: new Date('2024-01-01'),
        end: today,
      }).sort((a, b) => a.getTime() - b.getTime());
    }, []);
  
  
    const handleSave = async (data: DailyHighlight) => {
      if (!firestore) return;
      setIsSaving(true);
      const docRef = doc(firestore, 'drugHighlights', dateString);
      
      // Ensure date field is correct
      const finalData = { ...data, date: dateString };
  
      setDocumentNonBlocking(docRef, finalData, { merge: true });
  
      // Optimistically update UI
      setDailyData(finalData);
      setAllDrugData(prev => new Map(prev).set(dateString, finalData.drugs));
      if (finalData.drugs.length > 0) {
        setDatesWithData((prev) => new Set(prev).add(dateString));
      } else {
        setDatesWithData((prev) => {
            const newSet = new Set(prev);
            newSet.delete(dateString);
            return newSet;
        });
      }
      setIsEditing(false);
      setIsSaving(false);
      reset(finalData); // Reset form to mark it as not dirty
  
      toast({
        title: 'Success',
        description: `Drug highlights for ${dateString} have been saved.`,
      });
    };
    
    const handleUpdateReferences = (newReferences: string[]) => {
        if (activeDrugIndex === null) return;
        form.setValue(`drugs.${activeDrugIndex}.offLabelUse.references`, newReferences, { shouldDirty: true });
    };
  
    const handleAddNewDrug = () => {
        const newDrug: DrugHighlight = {
            id: new Date().getTime().toString(), // Simple unique ID
            ...emptyDrugData
        };
        append(newDrug);
    }

    const handleDeleteDrug = (index: number) => {
        remove(index);
    }
  
    const handleCancelEdit = () => {
        if (dailyData) {
            reset(dailyData);
          } else {
            reset(getEmptyDailyHighlight(dateString));
          }
          setIsEditing(false);
    };
    
    const proceedWithNavigation = (targetDate: Date) => {
      reset(); // Discard changes
      setSelectedDate(targetDate);
      setIsCalendarOpen(false);
      setPendingDate(null);
      setIsUnsavedChangesDialogOpen(false);
    };
    
  
    const handleDateNavigation = (targetDate: Date | undefined) => {
      if (!targetDate) return;
  
      if (isEditing && isDirty) {
        setPendingDate(targetDate);
        setIsUnsavedChangesDialogOpen(true);
      } else {
        setSelectedDate(targetDate);
        setIsCalendarOpen(false);
        // Important: Exit edit mode when navigating
        setIsEditing(false);
      }
    };
  
    const setDrugFormValues = (index: number, data: Partial<GetDrugInfoOutput>, options: { shouldDirty: boolean }) => {
        Object.keys(data).forEach(keyStr => {
            const key = keyStr as keyof GetDrugInfoOutput;
            const value = data[key];
            if (value !== undefined) {
              // @ts-ignore
              form.setValue(`drugs.${index}.${key}`, value, options);
            }
          });
    };
  
    const handleAutofill = async (index: number, mode: 'all' | 'blank') => {
        const drugNameValue = getValues(`drugs.${index}.drugName`);
        if (!drugNameValue) {
            toast({
              variant: 'destructive',
              title: 'Drug Name Required',
              description: 'Please enter a drug name before using auto-fill.',
            });
            return;
          }
      
          setIsFetchingAI(true);
          try {
            const result = await getDrugInfo({ drugName: drugNameValue });
            const options = { shouldDirty: true };
      
            if (mode === 'all') {
                setDrugFormValues(index, result, options);
            } else { // 'blank' mode
              const currentValues = getValues(`drugs.${index}`);
              const valuesToSet: Partial<DrugHighlight> = {};
              
              Object.keys(result).forEach(keyStr => {
                const key = keyStr as keyof DrugHighlight;
                
                if (key === 'offLabelUse') {
                  if (!currentValues.offLabelUse.value) {
                     // @ts-ignore
                    valuesToSet.offLabelUse = result.offLabelUse;
                  }
                } else if (!currentValues[key]) {
                   // @ts-ignore
                  valuesToSet[key] = result[key];
                }
              });
              setDrugFormValues(index, valuesToSet, options);
            }
      
            toast({
              title: 'AI Auto-fill Complete',
              description: `Information for ${result.drugName || drugNameValue} has been populated.`,
            });
          } catch (error) {
            console.error('Error fetching data from AI:', error);
            toast({
              variant: 'destructive',
              title: 'AI Auto-fill Failed',
              description: 'Could not fetch drug information. Please try again.',
            });
          } finally {
            setIsFetchingAI(false);
          }
    };
  
  
    const handleDuplicateCheck = (drugName: string, currentIndex: number) => {
        if (!drugName) return;
    
        for (const [date, drugs] of allDrugData.entries()) {
          for (const drug of drugs) {
            if (
              drug.drugName.toLowerCase() === drugName.toLowerCase() &&
              (date !== dateString || drug.id !== getValues(`drugs.${currentIndex}.id`))
            ) {
              setDuplicateDrugInfo({
                drugName: drug.drugName,
                date: format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy'),
                data: drug,
              });
              setActiveDrugIndex(currentIndex);
              setIsDuplicateDrugDialogOpen(true);
              return; // Found a duplicate, stop searching
            }
          }
        }
      };
      
      const handleConfirmRepeat = () => {
        if (duplicateDrugInfo && activeDrugIndex !== null) {
          const { id, ...dataToCopy } = duplicateDrugInfo.data; // Exclude original ID
          setDrugFormValues(activeDrugIndex, dataToCopy, { shouldDirty: true });
          toast({
            title: 'Data Copied',
            description: `Data for ${duplicateDrugInfo.drugName} has been copied.`,
          });
        }
        setIsDuplicateDrugDialogOpen(false);
        setDuplicateDrugInfo(null);
        setActiveDrugIndex(null);
      };
  
    const handleGoWithNew = () => {
        if (activeDrugIndex !== null) {
            form.setValue(`drugs.${activeDrugIndex}.drugName`, '', { shouldDirty: true });
        }
        setIsDuplicateDrugDialogOpen(false);
        setDuplicateDrugInfo(null);
        setActiveDrugIndex(null);
      };
  
    const initialCarouselIndex = useMemo(() => {
        if (!isClient) return datesForNavigation.length -1;
        const today = startOfToday();
        const formattedToday = format(today, 'yyyy-MM-dd');
        const index = datesForNavigation.findIndex(
          (d) => format(d, 'yyyy-MM-dd') === formattedToday
        );
        return index > -1 ? index : datesForNavigation.length - 1;
      }, [datesForNavigation, isClient]);
  
  
    const parseDateString = (dateStr: string): Date => {
      return parse(dateStr, 'yyyy-MM-dd', new Date());
    };
  
    const hasDataModifier = useMemo(
      () => Array.from(datesWithData).map(parseDateString),
      [datesWithData]
    );
    
    const renderField = (
        index: number,
        label: string,
        isEditing: boolean,
        fieldName: keyof DrugHighlight,
        isTextarea: boolean = false
      ) => {
        const watchedValue = watch(`drugs.${index}.${fieldName}`);
        const displayValue = getDisplayValue(watchedValue);
      
        return isEditing ? (
          <FormField
            control={control}
            name={`drugs.${index}.${fieldName}`}
            render={({ field }) => {
              // Ensure field.value is a string for input components
              const value = getDisplayValue(field.value);
              return (
                <FormItem className="w-full">
                  <FormControl>
                    {isTextarea ? (
                      <Textarea
                        placeholder={`Enter ${label.toLowerCase()}...`}
                        {...field}
                        value={value}
                        className="font-body min-h-[80px]"
                      />
                    ) : (
                      <Input
                        placeholder={`Enter ${label.toLowerCase()}...`}
                        {...field}
                        value={value}
                        className="font-body"
                        onBlur={fieldName === 'drugName' ? (e) => handleDuplicateCheck(e.target.value, index) : undefined}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ) : (
          <div className="text-primary text-base min-h-[2.5rem] py-2 whitespace-pre-wrap font-body w-full">
            {displayValue || 'No data available.'}
          </div>
        );
      };
    
  
    return (
      <>
        <div className="p-6 relative">
          <h1 className="text-3xl font-headline font-bold text-center tracking-tight text-primary">
            Department of Pharmacology
          </h1>
          <p className="text-center text-xl font-headline text-primary mt-1 font-bold">
            भेषजगुण विज्ञान विभाग
          </p>
          <p className="text-center text-xl mt-2 font-headline text-primary">
            Your daily dose of Pharmacology.
          </p>
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
        </div>
  
        <div className="px-12 pb-2">
          <Carousel
            opts={{
              align: 'start',
              startIndex: initialCarouselIndex,
            }}
            className="w-full"
          >
            <CarouselContent>
              {datesForNavigation.map((date) => {
                const formattedDate = format(date, 'yyyy-MM-dd');
                const hasData = datesWithData.has(formattedDate);
                const isSelected = formattedDate === dateString;
                const dayDrugData = allDrugData.get(formattedDate);
  
                return (
                  <CarouselItem
                    key={date.toString()}
                    className="basis-1/5 sm:basis-1/7 md:basis-1/8 lg:basis-[12%]"
                  >
                    <Button
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn(
                        'flex-col h-auto p-2 w-full text-xs',
                        isSelected && 'bg-accent text-accent-foreground hover:bg-accent/90',
                        !isSelected &&
                          hasData &&
                          'bg-primary/20 border-primary/50',
                        !isSelected && !hasData && 'bg-secondary/50'
                      )}
                      onClick={() => handleDateNavigation(date)}
                    >
                      <span className="font-medium">{format(date, 'EEE')}</span>
                      <span className="text-lg font-bold">
                        {format(date, 'd')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isClient && isToday(date) ? 'Today' : format(date, 'MMM')}
                      </span>
                      <span className="text-xs font-semibold text-primary whitespace-normal text-center mt-1 min-h-[4em] h-auto leading-tight flex flex-col items-center justify-center">
                        {dayDrugData?.map(d => d.drugName).join(', ')}
                      </span>
                    </Button>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
  
        <div className="flex justify-center pb-4">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                Go to Date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => handleDateNavigation(date)}
                disabled={{ before: new Date('2024-01-01'), after: new Date() }}
                initialFocus
                modifiers={{ hasData: hasDataModifier }}
                modifiersStyles={{
                  hasData: {
                    backgroundColor: 'hsl(var(--primary) / 0.2)',
                    border: '1px solid hsl(var(--primary) / 0.5)',
                  },
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
  
        <div className="px-6 pb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              Highlights for {format(selectedDate, 'MMMM d, yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDownloadDialogOpen(true)}
              >
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPinDialogOpen(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              ) : (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddNewDrug}
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Drug
                </Button>
              )}
            </div>
          </div>
  
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)}>
              {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
              ) : fields.length > 0 ? (
                <Accordion type="multiple" defaultValue={fields.map(f => f.id)} className="w-full space-y-4">
                    {fields.map((field, index) => (
                      <AccordionItem value={field.id} key={field.id} className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-4 py-2 bg-secondary/50 hover:no-underline flex justify-between items-center w-full">
                           <div className="flex items-center gap-2">
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                                <span className="font-semibold text-lg">{getValues(`drugs.${index}.drugName`) || `New Drug ${index + 1}`}</span>
                           </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4">
                        <div className="space-y-4">
                            {/* Drug Name */}
                            <div className="flex items-start gap-4">
                                <label className="w-1/3 text-sm font-semibold pt-2 text-right">Drug of the Day</label>
                                <div className="w-2/3">
                                    {renderField(index, 'Drug of the Day', isEditing, 'drugName')}
                                </div>
                            </div>

                            {/* Other Fields */}
                            {formFields.map(fieldInfo => (
                                <div key={fieldInfo.key} className="flex items-start gap-4">
                                    <label className="w-1/3 text-sm font-semibold pt-2 text-right">{fieldInfo.label}</label>
                                    <div className="w-2/3">
                                        {renderField(index, fieldInfo.label, isEditing, fieldInfo.key, fieldInfo.isTextarea)}
                                    </div>
                                </div>
                            ))}

                            {/* Off Label Use */}
                            <div className="flex items-start gap-4">
                                <label className="w-1/3 text-sm font-semibold pt-2 text-right">Off Label Use</label>
                                <div className="w-2/3">
                                {isEditing ? (
                                    <div className="space-y-2">
                                       <FormField
                                        control={form.control}
                                        name={`drugs.${index}.offLabelUse.value`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Textarea
                                                placeholder="Enter off label use..."
                                                {...field}
                                                className="font-body min-h-[100px]"
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <Button type="button" variant="outline" size="sm" onClick={() => { setActiveDrugIndex(index); setIsReferenceDialogOpen(true); }}>
                                        <BookText className="mr-2 h-4 w-4" />
                                        References ({watchedDrugs[index]?.offLabelUse?.references?.length || 0})
                                      </Button>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="text-primary text-base min-h-[2.5rem] py-2 whitespace-pre-wrap font-body">
                                        {getDisplayValue(watchedDrugs[index]?.offLabelUse) || 'No data available.'}
                                      </div>
                                      {watchedDrugs[index]?.offLabelUse?.references && watchedDrugs[index]?.offLabelUse.references.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          <h4 className="text-sm font-semibold text-muted-foreground">References:</h4>
                                          <ul className="list-disc list-inside space-y-1">
                                            {watchedDrugs[index].offLabelUse.references.map((ref, refIndex) => (
                                              <li key={refIndex}>
                                                <a href={ref} target="_blank" rel="noopener noreferrer" className="text-primary text-sm underline-offset-4 hover:underline break-all">
                                                  {ref}
                                                </a>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                            </div>
                            
                            {isEditing && (
                                <div className="flex justify-end items-center gap-2 pt-4 border-t mt-4">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button type="button" variant="outline" size="sm" disabled={isFetchingAI}>
                                                {isFetchingAI ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Sparkles className="mr-2 h-4 w-4" /> )}
                                                Auto-fill
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => handleAutofill(index, 'all')}>Fill All Fields</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAutofill(index, 'blank')}>Fill Blank Fields</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteDrug(index)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Drug
                                    </Button>
                                </div>
                            )}

                        </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No drug highlights for this day.</p>
                    {isEditing && (
                        <Button
                            variant="default"
                            size="sm"
                            className="mt-4"
                            onClick={handleAddNewDrug}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" /> Add First Drug
                        </Button>
                    )}
                </div>
              )}
              
              {isEditing && (
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancelEdit}
                  >
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving || !isDirty}>
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save All Changes
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </div>
  
        <PinDialog
          open={isPinDialogOpen}
          onOpenChange={setIsPinDialogOpen}
          onSuccess={() => setIsEditing(true)}
        />
        <DownloadDialog
          open={isDownloadDialogOpen}
          onOpenChange={setIsDownloadDialogOpen}
          datesWithData={datesWithData}
          allDrugData={allDrugData}
        />
        <ReferenceDialog
            open={isReferenceDialogOpen}
            onOpenChange={setIsReferenceDialogOpen}
            references={
              activeDrugIndex !== null
                ? watchedDrugs[activeDrugIndex]?.offLabelUse?.references || []
                : []
            }
            onSave={handleUpdateReferences}
        />
        <AlertDialog open={isUnsavedChangesDialogOpen} onOpenChange={setIsUnsavedChangesDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Are you sure you want to discard them and continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDate(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => pendingDate && proceedWithNavigation(pendingDate)}>
                Discard &amp; Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {duplicateDrugInfo && (
          <DuplicateDrugDialog
            open={isDuplicateDrugDialogOpen}
            onOpenChange={setIsDuplicateDrugDialogOpen}
            duplicateDrugInfo={duplicateDrugInfo}
            onConfirmRepeat={handleConfirmRepeat}
            onGoWithNew={handleGoWithNew}
          />
        )}
      </>
    );
  }
