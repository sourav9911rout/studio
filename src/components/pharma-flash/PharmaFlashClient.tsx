
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  format,
  isToday,
  eachDayOfInterval,
  parse,
  startOfToday,
  isValid,
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
import type { DailyHighlight, DrugHighlight } from '@/lib/types';
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
} from '@/components/ui/alert-dialog';
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
import NotifyStaffDialog from './NotifyStaffDialog';
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
  GripVertical,
  Link as LinkIcon,
  Mail,
  AlertCircle,
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
import { getDrugInfo, type GetDrugInfoOutput } from '@/ai/flows/drug-info-flow';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

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

const getDisplayValue = (fieldData: any): string => {
    if (typeof fieldData === 'string') {
      return fieldData;
    }
    if (fieldData && typeof fieldData === 'object' && 'value' in fieldData && typeof fieldData.value === 'string') {
      return fieldData.value;
    }
    return '';
  };
  
const normalizeDrugHighlight = (data: any): DrugHighlight => {
    const normalized: DrugHighlight = { 
      id: data?.id || data?.drugName || new Date().getTime().toString(), 
      ...emptyDrugData 
    };
  
    Object.keys(emptyDrugData).forEach(keyStr => {
      const key = keyStr as keyof Omit<DrugHighlight, 'id'>;
      if (key !== 'offLabelUse') {
        normalized[key] = getDisplayValue(data?.[key]);
      }
    });
  
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
    if (data && Array.isArray(data.drugs)) {
        return {
            date: data.date || date,
            drugs: data.drugs.map(normalizeDrugHighlight),
        };
    }

    if (data && typeof data.drugName === 'string') {
        return {
            date: date,
            drugs: [normalizeDrugHighlight(data)], 
        };
    }
    
    return getEmptyDailyHighlight(date);
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
    const [aiError, setAiError] = useState<string | null>(null);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState(false);
    const [pendingDate, setPendingDate] = useState<Date | null>(null);
    const [isDuplicateDrugDialogOpen, setIsDuplicateDrugDialogOpen] = useState(false);
    const [duplicateDrugInfo, setDuplicateDrugInfo] = useState<DuplicateDrugInfo | null>(null);
    const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
    const [activeDrugIndex, setActiveDrugIndex] = useState<number | null>(null);
    const drugAccordionRefs = useRef<Map<string, HTMLElement | null>>(new Map());
    const [isNotifyStaffDialogOpen, setIsNotifyStaffDialogOpen] = useState(false);
    
  
    const { toast } = useToast();
    const firestore = useFirestore();
    const auth = useAuth();
    const { user, isUserLoading } = useUser();
  
    const form = useForm<DailyHighlight>({
        resolver: zodResolver(dailyHighlightSchema),
        defaultValues: getEmptyDailyHighlight(format(selectedDate, 'yyyy-MM-dd')),
    });
  
    const { fields, append, remove } = useFieldArray({
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
        // Cleanup old local storage keys as requested
        localStorage.removeItem('PHARMA_GEMINI_KEY');

        const params = new URLSearchParams(window.location.search);
        const dateParam = params.get('date');
        if (dateParam) {
          const parsedDate = parse(dateParam, 'yyyy-MM-dd', new Date());
          if (isValid(parsedDate)) {
            setSelectedDate(parsedDate);
          }
        }
      }, []);

      useEffect(() => {
        if (isClient) {
          const newUrl = `${window.location.pathname}?date=${dateString}`;
          window.history.pushState({ path: newUrl }, '', newUrl);
        }
      }, [dateString, isClient]);
  
    useEffect(() => {
      if (firestore && user === null && !isUserLoading) {
        initiateAnonymousSignIn(auth);
      }
    }, [firestore, user, isUserLoading, auth]);
  
    const fetchAllDrugData = useCallback(async () => {
        if (!firestore) return;
        try {
          const q = query(collection(firestore, 'drugHighlights'));
          const querySnapshot = await getDocs(q);
          const newAllData = new Map<string, DrugHighlight[]>();
          const newDatesWithData = new Set<string>();
          querySnapshot.forEach((doc) => {
              const normalizedData = normalizeDailyHighlight(doc.id, doc.data());
              if (normalizedData.drugs.length > 0) {
                newAllData.set(doc.id, normalizedData.drugs);
                newDatesWithData.add(doc.id);
              }
          });
          setAllDrugData(newAllData);
          setDatesWithData(newDatesWithData);
        } catch (error) {
          console.error('Error fetching all drug data:', error);
        }
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
      
      const finalData = { 
        ...data, 
        date: dateString,
        drugs: data.drugs.map(drug => ({
            ...drug,
            id: drug.id || new Date().getTime().toString() + Math.random(),
        })),
    };
  
      setDocumentNonBlocking(docRef, finalData, { merge: true });
  
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
      reset(finalData);
  
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
            id: new Date().getTime().toString(), 
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
          setAiError(null);
    };
    
    const proceedWithNavigation = (targetDate: Date) => {
      reset(); 
      setSelectedDate(targetDate);
      setIsCalendarOpen(false);
      setPendingDate(null);
      setIsUnsavedChangesDialogOpen(false);
      setAiError(null);
    };
    
  
    const handleDateNavigation = (targetDate: Date | undefined) => {
      if (!targetDate) return;
  
      if (isEditing && isDirty) {
        setPendingDate(targetDate);
        setIsUnsavedChangesDialogOpen(true);
      } else {
        setSelectedDate(targetDate);
        setIsCalendarOpen(false);
        setIsEditing(false);
        setAiError(null);
      }
    };
  
    const setDrugFormValues = (index: number, data: Partial<GetDrugInfoOutput>, options: { shouldDirty: boolean }) => {
        Object.entries(data).forEach(([key, value]) => {
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
          setAiError(null);
          try {
            const result = await getDrugInfo({ drugName: drugNameValue });
            const options = { shouldDirty: true };
      
            if (mode === 'all') {
                setDrugFormValues(index, result, options);
            } else { 
              const currentValues = getValues(`drugs.${index}`);
              const valuesToSet: Partial<DrugHighlight> = {};
              
              Object.entries(result).forEach(([key, value]) => {
                if (key === 'offLabelUse') {
                  if (!currentValues.offLabelUse.value) {
                     // @ts-ignore
                    valuesToSet.offLabelUse = value;
                  }
                } else if (!currentValues[key as keyof DrugHighlight]) {
                   // @ts-ignore
                  valuesToSet[key as keyof DrugHighlight] = value;
                }
              });
              setDrugFormValues(index, valuesToSet, options);
            }
      
            toast({
              title: 'AI Auto-fill Complete',
              description: `Information for ${result.drugName || drugNameValue} has been populated.`,
            });
          } catch (error: any) {
            console.error('Error fetching data from AI:', error);
            
            let errorMessage = 'Could not fetch drug information.';
            const msg = error.message || '';

            if (msg.includes('API_KEY_EXPOSED')) {
                errorMessage = 'The system API key is currently flagged as exposed. Please update the GEMINI_API_KEY environment variable in your deployment dashboard.';
                setAiError(errorMessage);
            } else if (msg.toLowerCase().includes('high demand') || msg.includes('503')) {
                errorMessage = 'The AI service is temporarily overloaded. Please wait 30 seconds and try again.';
            }

            toast({
              variant: 'destructive',
              title: 'AI Auto-fill Failed',
              description: errorMessage,
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
              return; 
            }
          }
        }
      };
      
      const handleConfirmRepeat = () => {
        if (duplicateDrugInfo && activeDrugIndex !== null) {
          const { id, ...dataToCopy } = duplicateDrugInfo.data; 
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
        if (!isClient) return datesForNavigation.length - 1; 
        const index = datesForNavigation.findIndex(
          (d) => format(d, 'yyyy-MM-dd') === dateString
        );
        return index > -1 ? index : datesForNavigation.length - 1;
      }, [datesForNavigation, isClient, dateString]);
  
  
    const parseDateString = (dateStr: string): Date => {
      return parse(dateStr, 'yyyy-MM-dd', new Date());
    };
  
    const hasDataModifier = useMemo(
      () => Array.from(datesWithData).map(parseDateString),
      [datesWithData]
    );

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        toast({
          title: 'Link Copied',
          description: 'A shareable link has been copied to your clipboard.',
        });
      };
    
      const handleScrollToDrug = (drugId: string) => {
        const element = drugAccordionRefs.current.get(drugId);
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

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
        <div className="p-8 relative">
          <h1 className="text-4xl font-headline font-bold text-center tracking-tight text-primary">
            Daily Drug Highlight
          </h1>
          <p className="text-center text-xl font-headline text-primary/80 mt-2 font-bold italic">
            An initiative of Department of Pharmacology, AIIMS-CAPFIMS
          </p>
          <p className="text-center text-[40px] mt-3 font-headline font-bold text-primary">
            <b>भेषजगुण विज्ञान विभाग</b>
          </p>
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
  
        <div className="px-12 pb-12">
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
                    className="basis-1/4 sm:basis-1/5 md:basis-[16%] lg:basis-[14%]"
                  >
                    <button
                      className={cn(
                        'flex flex-col items-center justify-between p-4 w-full h-44 transition-all duration-500 rounded-[2rem] relative border shadow-sm group overflow-hidden',
                        isSelected 
                          ? 'bg-primary text-primary-foreground shadow-2xl scale-105 border-primary z-10 ring-4 ring-primary/20' 
                          : 'bg-card hover:bg-accent/50 text-card-foreground border-border hover:border-primary/50',
                        !isSelected && hasData && 'bg-primary/5 border-primary/20'
                      )}
                      onClick={() => handleDateNavigation(date)}
                    >
                      <div className="flex flex-col items-center">
                        <span className={cn(
                          "text-[10px] uppercase tracking-widest font-black opacity-60 mb-1",
                          isSelected ? "text-primary-foreground" : "text-muted-foreground"
                        )}>
                          {format(date, 'EEE')}
                        </span>
                        <span className="text-4xl font-headline font-black leading-none tracking-tighter">
                          {format(date, 'd')}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold mt-2",
                          isSelected ? "text-primary-foreground/90" : "text-primary"
                        )}>
                          {isClient && isToday(date) ? 'TODAY' : format(date, 'MMM').toUpperCase()}
                        </span>
                      </div>
                      
                      <div className={cn(
                        "w-full px-1 text-center overflow-hidden transition-all duration-300 mt-2",
                        isSelected ? "opacity-100 translate-y-0" : "opacity-70 group-hover:opacity-100"
                      )}>
                        <p className={cn(
                          "text-[8px] leading-tight font-black line-clamp-3 uppercase tracking-tight",
                          isSelected ? "text-primary-foreground" : "text-primary"
                        )}>
                          {dayDrugData?.map(d => d.drugName).join(', ') || (hasData ? 'Highlights' : '')}
                        </p>
                      </div>

                      {hasData && !isSelected && (
                        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary animate-pulse" />
                      )}
                    </button>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="-left-8" />
            <CarouselNext className="-right-8" />
          </Carousel>
        </div>
  
        <div className="flex justify-center pb-6 pt-6 border-t bg-secondary/10">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="flex items-center gap-2 rounded-full px-8 shadow-sm hover:shadow-md transition-all"
              >
                <CalendarIcon className="h-5 w-5" />
                Jump to specific date
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
                    backgroundColor: 'hsl(var(--primary) / 0.15)',
                    border: '1px solid hsl(var(--primary) / 0.4)',
                    color: 'hsl(var(--primary))',
                    fontWeight: 'bold'
                  },
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
  
        <div className="px-10 pb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex flex-col">
              <h2 className="text-3xl font-headline font-bold flex items-center gap-3 text-primary">
                <CalendarIcon className="h-8 w-8" />
                {format(selectedDate, 'MMMM d, yyyy')}
                <Button variant="ghost" size="icon" className="h-10 w-10 ml-1 rounded-full" onClick={handleCopyLink}>
                  <LinkIcon className="h-5 w-5" />
                </Button>
              </h2>
              {isClient && isToday(selectedDate) && (
                <span className="text-[10px] font-black text-primary/60 uppercase tracking-[0.3em] ml-11">Current Highlight</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <Button
                variant="outline"
                className="rounded-full px-6 shadow-sm"
                onClick={() => setIsNotifyStaffDialogOpen(true)}
                disabled={isLoading || !dailyData || dailyData.drugs.length === 0}
              >
                <Mail className="mr-2 h-4 w-4" /> Notify Staff
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-6 shadow-sm"
                onClick={() => setIsDownloadDialogOpen(true)}
              >
                <Download className="mr-2 h-4 w-4" /> Export PDF
              </Button>
              {!isEditing ? (
                <Button
                  variant="default"
                  className="rounded-full px-8 shadow-lg shadow-primary/20"
                  onClick={() => setIsPinDialogOpen(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Manage Entry
                </Button>
              ) : (
                <Button
                    variant="secondary"
                    className="rounded-full px-6"
                    onClick={handleAddNewDrug}
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Drug
                </Button>
              )}
            </div>
          </div>

          {aiError && isEditing && (
            <Alert variant="destructive" className="mb-6 rounded-2xl bg-destructive/5 border-destructive/20">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="font-bold">AI Service Notice</AlertTitle>
              <AlertDescription className="text-sm">
                {aiError}
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && fields.length > 1 && (
            <div className="mb-8 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mr-2">Jump to drug:</span>
              {fields.map((field, index) => (
                <Button
                  key={field.id}
                  variant="secondary"
                  size="sm"
                  className="rounded-full text-xs font-bold h-8 px-4 border border-border/50"
                  onClick={() => handleScrollToDrug(field.id)}
                >
                  {getValues(`drugs.${index}.drugName`) || `Drug ${index + 1}`}
                </Button>
              ))}
            </div>
          )}
  
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} suppressHydrationWarning>
              {isLoading ? (
                <div className="space-y-6">
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
              ) : fields.length > 0 ? (
                <Accordion type="multiple" defaultValue={fields.map(f => f.id)} className="w-full space-y-8">
                  {fields.map((field, index) => (
                    <AccordionItem 
                        value={field.id} 
                        key={field.id} 
                        className="border rounded-[2.5rem] overflow-hidden shadow-sm bg-card transition-all duration-300 hover:shadow-xl border-border/60"
                        ref={(el) => drugAccordionRefs.current.set(field.id, el)}
                    >
                      <AccordionTrigger className="px-8 py-6 bg-accent/20 hover:bg-accent/40 hover:no-underline transition-colors border-b border-border/40">
                        <div className="flex items-center gap-4">
                          {isEditing && <GripVertical className="h-6 w-6 text-muted-foreground cursor-grab" />}
                          <div className="flex flex-col items-start">
                            <span className="font-headline font-bold text-2xl text-primary tracking-tight">
                              {getValues(`drugs.${index}.drugName`) || `New Pharmacological Entry`}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-black tracking-[0.2em] uppercase mt-1">
                              Clinical Profile
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="p-10 space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 items-start">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground pt-3 md:text-right">Drug Name</label>
                                <div className="w-full">
                                    {renderField(index, 'Drug Name', isEditing, 'drugName')}
                                </div>
                            </div>

                            {formFields.map(fieldInfo => (
                                <div key={fieldInfo.key} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 items-start">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground pt-3 md:text-right">{fieldInfo.label}</label>
                                    <div className="w-full">
                                        {renderField(index, fieldInfo.label, isEditing, fieldInfo.key, fieldInfo.isTextarea)}
                                    </div>
                                </div>
                            ))}

                            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 items-start">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground pt-3 md:text-right">Off Label Use</label>
                                <div className="w-full">
                                {isEditing ? (
                                    <div className="space-y-4">
                                       <FormField
                                        control={form.control}
                                        name={`drugs.${index}.offLabelUse.value`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Textarea
                                                placeholder="Enter off label use details..."
                                                {...field}
                                                className="font-body min-h-[140px] rounded-2xl"
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="rounded-full px-6 shadow-sm"
                                        onClick={() => { setActiveDrugIndex(index); setIsReferenceDialogOpen(true); }}
                                      >
                                        <BookText className="mr-2 h-4 w-4" />
                                        Evidence & References ({watchedDrugs[index]?.offLabelUse?.references?.length || 0})
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="space-y-6">
                                      <div className="text-primary text-base min-h-[2.5rem] py-2 whitespace-pre-wrap font-body leading-relaxed">
                                        {watchedDrugs[index]?.offLabelUse?.value || 'No data available.'}
                                      </div>
                                      {watchedDrugs[index]?.offLabelUse?.references && watchedDrugs[index]?.offLabelUse.references.length > 0 && (
                                        <div className="bg-accent/20 p-6 rounded-[2rem] space-y-3 border border-accent/40 shadow-inner">
                                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Scientific Literature:</h4>
                                          <ul className="space-y-3">
                                            {watchedDrugs[index].offLabelUse.references.map((ref, refIndex) => (
                                              <li key={refIndex} className="flex items-start gap-3">
                                                <div className="bg-primary/10 h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                                    <LinkIcon className="h-3 w-3 text-primary" />
                                                </div>
                                                <a href={ref} target="_blank" rel="noopener noreferrer" className="text-primary text-sm font-medium hover:underline break-all leading-snug">
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
                        </div>
                        
                        {isEditing && (
                          <div className="px-10 py-8 bg-secondary/10 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Pharmacology Assistant</span>
                              <div className="flex items-center gap-4">
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button type="button" variant="outline" className="rounded-full px-6 border-primary/20 hover:bg-primary/5" disabled={isFetchingAI}>
                                              {isFetchingAI ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Sparkles className="mr-2 h-4 w-4 text-primary" /> )}
                                              AI Autofill
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[200px]">
                                          <DropdownMenuItem className="rounded-xl py-3" onClick={() => handleAutofill(index, 'all')}>Complete Profile Search</DropdownMenuItem>
                                          <DropdownMenuItem className="rounded-xl py-3" onClick={() => handleAutofill(index, 'blank')}>Fill Missing Details Only</DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>

                                  <Button type="button" variant="destructive" className="rounded-full px-6 shadow-sm" onClick={() => handleDeleteDrug(index)}>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remove Entry
                                  </Button>
                              </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-24 border-2 border-dashed rounded-[3rem] bg-secondary/5 border-border/40">
                    <div className="bg-primary/10 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                      <CalendarIcon className="h-10 w-10 text-primary/40" />
                    </div>
                    <p className="text-muted-foreground font-headline text-xl">No daily highlights recorded for this date.</p>
                    {isEditing && (
                        <Button
                            variant="default"
                            size="lg"
                            className="mt-8 rounded-full px-10 shadow-lg shadow-primary/20"
                            onClick={handleAddNewDrug}
                        >
                            <PlusCircle className="mr-2 h-5 w-5" /> Start First Entry
                        </Button>
                    )}
                </div>
              )}
              
              {isEditing && (
                <div className="flex flex-col sm:flex-row justify-end gap-4 mt-12 p-8 bg-card border border-border/60 rounded-[3rem] shadow-2xl sticky bottom-6 z-20 backdrop-blur-sm bg-card/95">
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full px-10 font-bold hover:bg-destructive/5 hover:text-destructive"
                    onClick={handleCancelEdit}
                  >
                    <X className="mr-2 h-5 w-5" /> Discard Edits
                  </Button>
                  <Button 
                    type="submit" 
                    className="rounded-full px-12 py-6 text-lg font-bold shadow-xl shadow-primary/30"
                    disabled={isSaving || !isDirty}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-5 w-5" />
                    )}
                    Commit to Database
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
        <NotifyStaffDialog
          open={isNotifyStaffDialogOpen}
          onOpenChange={setIsNotifyStaffDialogOpen}
          dailyHighlight={dailyData}
        />
        <AlertDialog open={isUnsavedChangesDialogOpen} onOpenChange={setIsUnsavedChangesDialogOpen}>
          <AlertDialogContent className="rounded-[2.5rem]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-3xl font-headline">Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription className="text-base leading-relaxed">
                You have active pharmacological edits that haven&apos;t been committed. Navigating away will lose these details permanently.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel className="rounded-full px-8" onClick={() => setPendingDate(null)}>
                Keep Editing
              </AlertDialogCancel>
              <AlertDialogAction className="rounded-full px-8 bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={() => pendingDate && proceedWithNavigation(pendingDate)}>
                Discard Changes
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
