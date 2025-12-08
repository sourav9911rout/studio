
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  format,
  isToday,
  eachDayOfInterval,
  parse,
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
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import type { DrugHighlight, InfoWithReference } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
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
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { cn } from '@/lib/utils';
import { Textarea } from '../ui/textarea';
import { ThemeToggle } from '../ThemeToggle';
import { getDrugInfo } from '@/ai/flows/drug-info-flow';

const infoWithReferenceSchema = z.object({
  value: z.string().min(1, 'This field is required.'),
  references: z.array(z.string().url()).optional(),
});

const drugSchema = z.object({
  drugName: infoWithReferenceSchema,
  drugClass: infoWithReferenceSchema,
  mechanism: infoWithReferenceSchema,
  uses: infoWithReferenceSchema,
  sideEffects: infoWithReferenceSchema,
  routeOfAdministration: infoWithReferenceSchema,
  dose: infoWithReferenceSchema,
  dosageForm: infoWithReferenceSchema,
  halfLife: infoWithReferenceSchema,
  clinicalUses: infoWithReferenceSchema,
  contraindication: infoWithReferenceSchema,
  offLabelUse: infoWithReferenceSchema,
  funFact: infoWithReferenceSchema,
});


type FormFieldType = {
  key: keyof Omit<DrugHighlight, 'drugName'>;
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
  { key: 'offLabelUse', label: 'Off Label Use', isTextarea: true },
  { key: 'funFact', label: 'Fun Fact', isTextarea: true },
];

const emptyDrugData: DrugHighlight = {
  drugName: { value: '', references: [] },
  drugClass: { value: '', references: [] },
  mechanism: { value: '', references: [] },
  uses: { value: '', references: [] },
  sideEffects: { value: '', references: [] },
  routeOfAdministration: { value: '', references: [] },
  dose: { value: '', references: [] },
  dosageForm: { value: '', references: [] },
  halfLife: { value: '', references: [] },
  clinicalUses: { value: '', references: [] },
  contraindication: { value: '', references: [] },
  offLabelUse: { value: '', references: [] },
  funFact: { value: '', references: [] },
};

export default function PharmaFlashClient() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [drugData, setDrugData] = useState<DrugHighlight | null>(null);
  const [allDrugData, setAllDrugData] = useState<Map<string, DrugHighlight>>(new Map());
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
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const [currentReferences, setCurrentReferences] = useState<{label: string, refs: string[]}>({label: '', refs: []});


  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  const form = useForm<DrugHighlight>({
    resolver: zodResolver(drugSchema),
    defaultValues: emptyDrugData,
  });

  const { formState: { isDirty } } = form;

  const dateString = useMemo(
    () => format(selectedDate, 'yyyy-MM-dd'),
    [selectedDate]
  );

  useEffect(() => {
    if (firestore && user === null && !isUserLoading) {
      initiateAnonymousSignIn(auth);
    }
  }, [firestore, user, isUserLoading, auth]);

  useEffect(() => {
    if (!firestore) return;

    const fetchAllDrugData = async () => {
      const q = query(collection(firestore, 'drugHighlights'));
      const querySnapshot = await getDocs(q);
      const newAllData = new Map<string, DrugHighlight>();
      const newDatesWithData = new Set<string>();
      querySnapshot.forEach((doc) => {
        newAllData.set(doc.id, doc.data() as DrugHighlight);
        newDatesWithData.add(doc.id);
      });
      setAllDrugData(newAllData);
      setDatesWithData(newDatesWithData);
    };

    fetchAllDrugData();
  }, [firestore]);

  useEffect(() => {
    if (!firestore) return;
    const fetchDrugData = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(firestore, 'drugHighlights', dateString);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as DrugHighlight;
          setDrugData(data);
          form.reset(data);
        } else {
          setDrugData(null);
          form.reset(emptyDrugData);
        }
      } catch (error) {
        console.error('Error fetching drug data:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            'Failed to fetch drug information. Please check your connection and Firestore setup.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrugData();
  }, [dateString, form, toast, firestore]);

  const datesForNavigation = useMemo(() => {
    const today = new Date();
    return eachDayOfInterval({
      start: new Date('2025-10-25'),
      end: today,
    }).sort((a, b) => a.getTime() - b.getTime());
  }, []);

  const handleSave = async (data: DrugHighlight) => {
    if (!firestore) return;
    setIsSaving(true);
    const docRef = doc(firestore, 'drugHighlights', dateString);
    setDocumentNonBlocking(docRef, data, { merge: true });

    // Optimistically update UI
    setDrugData(data);
    setAllDrugData(prev => new Map(prev).set(dateString, data));
    setDatesWithData((prev) => new Set(prev).add(dateString));
    setIsEditing(false);
    setIsSaving(false);
    form.reset(data); // Reset form to mark it as not dirty

    toast({
      title: 'Success',
      description: `Drug highlight for ${dateString} has been saved.`,
    });
  };

  const handleDelete = () => {
    if (!firestore) return;
    const docRef = doc(firestore, 'drugHighlights', dateString);

    deleteDocumentNonBlocking(docRef);

    // Optimistically update UI
    setDrugData(null);
    form.reset(emptyDrugData);
    setAllDrugData(prev => {
      const newMap = new Map(prev);
      newMap.delete(dateString);
      return newMap;
    });
    setDatesWithData((prev) => {
      const newSet = new Set(prev);
      newSet.delete(dateString);
      return newSet;
    });
    setIsEditing(false);

    toast({
      title: 'Deleted',
      description: `Drug highlight for ${dateString} has been deleted.`,
    });
  };

  const handleCancelEdit = () => {
    if (drugData) {
      form.reset(drugData);
    } else {
      form.reset(emptyDrugData);
    }
    setIsEditing(false);
  };
  
  const proceedWithNavigation = (targetDate: Date) => {
    if (isDirty) {
      if (drugData) {
        form.reset(drugData);
      } else {
        form.reset(emptyDrugData);
      }
    }
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
    }
  };

  const handleAutofill = async (mode: 'all' | 'blank') => {
    const drugNameValue = form.getValues('drugName.value');
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

      if (mode === 'all') {
        form.reset(result);
      } else { // 'blank' mode
        const currentValues = form.getValues();
        const newValues = { ...currentValues };
        for (const key in result) {
          if (Object.prototype.hasOwnProperty.call(result, key)) {
            const field = key as keyof DrugHighlight;
            if (!currentValues[field]?.value) {
                (newValues[field] as InfoWithReference) = result[field];
            }
          }
        }
        form.reset(newValues);
      }

      toast({
        title: 'AI Auto-fill Complete',
        description: `Information for ${result.drugName.value || drugNameValue} has been populated.`,
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

  const handleShowReferences = (label: string, references: string[]) => {
    setCurrentReferences({ label, refs: references });
    setIsReferenceDialogOpen(true);
  };

  const initialCarouselIndex = useMemo(() => {
    const today = new Date();
    const formattedToday = format(today, 'yyyy-MM-dd');
    const index = datesForNavigation.findIndex(
      (d) => format(d, 'yyyy-MM-dd') === formattedToday
    );
    return index > -1 ? index : datesForNavigation.length - 1;
  }, [datesForNavigation]);

  const parseDateString = (dateStr: string): Date => {
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  };

  const hasDataModifier = useMemo(
    () => Array.from(datesWithData).map(parseDateString),
    [datesWithData]
  );
  
  const renderField = (
    label: string,
    fieldData: InfoWithReference | undefined,
    isEditing: boolean,
    formControl: any,
    fieldName: any,
    isTextarea: boolean = false
  ) => {
    const hasReferences = fieldData && fieldData.references && fieldData.references.length > 0;
  
    return (
      <TableCell>
        <div className="flex items-start justify-between gap-4">
          {isEditing ? (
            <FormField
              control={formControl}
              name={`${fieldName}.value`}
              render={({ field }) => (
                <FormItem className="flex-grow">
                  <FormControl>
                    {isTextarea ? (
                      <Textarea
                        placeholder={`Enter ${label.toLowerCase()}...`}
                        {...field}
                        className="font-body min-h-[100px]"
                      />
                    ) : (
                      <Input
                        placeholder={`Enter ${label.toLowerCase()}...`}
                        {...field}
                        className="font-body"
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div className="text-primary text-base min-h-[2.5rem] py-2 whitespace-pre-wrap font-body flex-grow">
              {(fieldData?.value) || 'No data available.'}
            </div>
          )}
          {!isEditing && hasReferences && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => handleShowReferences(label, fieldData.references)}
            >
              <BookText className="mr-2 h-4 w-4" />
              Reference
            </Button>
          )}
        </div>
      </TableCell>
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
                      {isToday(date) ? 'Today' : format(date, 'MMM')}
                    </span>
                    <span className="text-xs font-semibold text-primary whitespace-normal text-center mt-1 min-h-[4em] h-auto leading-tight flex items-center justify-center">
                      {dayDrugData?.drugName?.value}
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
              disabled={{ before: new Date('2025-10-25'), after: new Date() }}
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
            Highlight for {format(selectedDate, 'MMMM d, yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDownloadDialogOpen(true)}
            >
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPinDialogOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)}>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableBody>
                  {isLoading ? (
                    formFields.map((field) => (
                      <TableRow key={field.key}>
                        <TableCell className="font-semibold w-1/3 font-body">
                          {field.label}
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <>
                      <TableRow>
                        <TableCell className="font-semibold w-1/3 align-top pt-5 font-body">
                          Drug of the Day
                        </TableCell>
                        {renderField('Drug of the Day', drugData?.drugName, isEditing, form.control, 'drugName')}
                      </TableRow>
                      {formFields.map((fieldInfo) => (
                        <TableRow key={fieldInfo.key}>
                          <TableCell className="font-semibold w-1/3 align-top pt-5 font-body">
                            {fieldInfo.label}
                          </TableCell>
                          {renderField(fieldInfo.label, drugData?.[fieldInfo.key], isEditing, form.control, fieldInfo.key, fieldInfo.isTextarea)}
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            {isEditing && (
              <div className="flex justify-end gap-2 mt-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isFetchingAI}
                    >
                      {isFetchingAI ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Auto-fill with AI
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleAutofill('all')}>
                      Fill All Fields
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAutofill('blank')}>
                      Fill Only Blank Fields
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete All Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the drug highlight data for{' '}
                        {format(selectedDate, 'MMMM d, yyyy')}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Confirm Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
                  Save Changes
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
      />
       <ReferenceDialog
        open={isReferenceDialogOpen}
        onOpenChange={setIsReferenceDialogOpen}
        label={currentReferences.label}
        references={currentReferences.refs}
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
    </>
  );
}
