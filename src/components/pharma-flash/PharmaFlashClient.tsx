"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, isToday, eachDayOfInterval, parse } from "date-fns";
import { doc, getDoc, collection, getDocs, query } from "firebase/firestore";
import { useFirestore, useUser, useAuth } from "@/firebase";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import type { DrugHighlight } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
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
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, CalendarProps } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import PinDialog from "./PinDialog";
import DownloadDialog from "./DownloadDialog";
import { Pencil, Save, X, Calendar as CalendarIcon, Loader2, Download, Trash2, Sparkles } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";
import { ThemeToggle } from "../ThemeToggle";
import { getDrugInfo } from "@/ai/flows/drug-info-flow";

const drugSchema = z.object({
  drugName: z.string().min(1, "Drug name is required."),
  drugClass: z.string().min(1, "Class is required."),
  mechanism: z.string().min(1, "Mechanism is required."),
  uses: z.string().min(1, "Uses are required."),
  sideEffects: z.string().min(1, "Side effects are required."),
  funFact: z.string().min(1, "Fun fact is required."),
});

const formFields: { key: keyof DrugHighlight, label: string, isTextarea: boolean }[] = [
    { key: 'drugName', label: 'Drug of the Day', isTextarea: false },
    { key: 'drugClass', label: 'Drug Class', isTextarea: false },
    { key: 'mechanism', label: 'Mechanism of Action', isTextarea: true },
    { key: 'uses', label: 'Common Uses', isTextarea: true },
    { key: 'sideEffects', label: 'Side Effects', isTextarea: true },
    { key: 'funFact', label: 'Fun Fact', isTextarea: true },
];

const emptyDrugData: DrugHighlight = {
    drugName: "",
    drugClass: "",
    mechanism: "",
    uses: "",
    sideEffects: "",
    funFact: "",
};


export default function PharmaFlashClient() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [drugData, setDrugData] = useState<DrugHighlight | null>(null);
  const [drugDataMap, setDrugDataMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingAI, setIsFetchingAI] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  const form = useForm<DrugHighlight>({
    resolver: zodResolver(drugSchema),
    defaultValues: emptyDrugData,
  });

  const dateString = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);

  useEffect(() => {
    if (firestore && user === null && !isUserLoading) {
      initiateAnonymousSignIn(auth);
    }
  }, [firestore, user, isUserLoading, auth]);
  
  useEffect(() => {
    if (!firestore) return;

    const fetchAllDrugData = async () => {
        const q = query(collection(firestore, "drugHighlights"));
        const querySnapshot = await getDocs(q);
        const dataMap = new Map<string, string>();
        querySnapshot.forEach(doc => {
          const data = doc.data() as DrugHighlight;
          if (data.drugName) {
            dataMap.set(doc.id, data.drugName);
          }
        });
        setDrugDataMap(dataMap);
    };

    fetchAllDrugData();
  }, [firestore]);

  useEffect(() => {
    if (!firestore) return;
    const fetchDrugData = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(firestore, "drugHighlights", dateString);
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
        console.error("Error fetching drug data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch drug information. Please check your connection and Firestore setup.",
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
      start: new Date("2025-10-25"),
      end: today,
    }).sort((a,b) => a.getTime() - b.getTime());
  }, []);

  const handleSave = async (data: DrugHighlight) => {
    if (!firestore) return;
    setIsSaving(true);
    const docRef = doc(firestore, "drugHighlights", dateString);
    setDocumentNonBlocking(docRef, data, { merge: true });
    
    // Optimistically update UI
    setDrugData(data);
    setDrugDataMap(prev => new Map(prev).set(dateString, data.drugName));
    setIsEditing(false);
    setIsSaving(false);

    toast({
      title: "Success",
      description: `Drug highlight for ${dateString} has been saved.`,
    });
  };

  const handleDelete = () => {
    if (!firestore) return;
    const docRef = doc(firestore, "drugHighlights", dateString);
    
    deleteDocumentNonBlocking(docRef);

    // Optimistically update UI
    setDrugData(null);
    form.reset(emptyDrugData);
    setDrugDataMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(dateString);
        return newMap;
    });
    setIsEditing(false);

    toast({
      title: "Deleted",
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
  }
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsCalendarOpen(false);
    }
  };

  const handleAutofill = async () => {
    const drugName = form.getValues("drugName");
    if (!drugName) {
      toast({
        variant: "destructive",
        title: "Drug Name Required",
        description: "Please enter a drug name before using auto-fill.",
      });
      return;
    }

    setIsFetchingAI(true);
    try {
      const result = await getDrugInfo({ drugName });
      form.setValue("drugClass", result.drugClass);
      form.setValue("mechanism", result.mechanism);
      form.setValue("uses", result.uses);
      form.setValue("sideEffects", result.sideEffects);
      form.setValue("funFact", result.funFact);
      toast({
        title: "AI Auto-fill Complete",
        description: `Information for ${drugName} has been populated.`,
      });
    } catch (error) {
      console.error("Error fetching data from AI:", error);
      toast({
        variant: "destructive",
        title: "AI Auto-fill Failed",
        description: "Could not fetch drug information. Please try again.",
      });
    } finally {
      setIsFetchingAI(false);
    }
  };

  const initialCarouselIndex = useMemo(() => {
    const index = datesForNavigation.findIndex(d => format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'));
    return index > -1 ? index : datesForNavigation.length - 1;
  }, [datesForNavigation]);

  const parseDateString = (dateStr: string): Date => {
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  };
  
  const datesWithData = useMemo(() => new Set(drugDataMap.keys()), [drugDataMap]);
  const hasDataModifier = Array.from(datesWithData).map(dateStr => parseDateString(dateStr));
  
  const DayWithTooltip: CalendarProps['components'] = {
    Day: ({ date, ...props }) => {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const drugName = drugDataMap.get(formattedDate);

      const dayContent = (
        <div {...props.rootProps} >
            {format(date, 'd')}
        </div>
      );
      
      if (drugName) {
        return (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                {dayContent}
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm font-semibold">{drugName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      
      return dayContent;
    },
  };

  return (
    <>
      <div className="p-6 relative">
        <h1 className="text-3xl font-headline font-bold text-center tracking-tight text-primary">Department of Pharmacology</h1>
        <p className="text-center text-xl font-headline text-primary mt-1 font-bold">भेषजगुण विज्ञान विभाग</p>
        <p className="text-center text-primary text-lg mt-2 font-headline">Your daily dose of pharmacology.</p>
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
      </div>
      
      <div className="px-12 pb-2">
        <Carousel
          opts={{
            align: "start",
            startIndex: initialCarouselIndex,
          }}
          className="w-full"
        >
          <CarouselContent>
            {datesForNavigation.map((date) => {
              const formattedDate = format(date, "yyyy-MM-dd");
              const hasData = datesWithData.has(formattedDate);
              const isSelected = formattedDate === dateString;

              return (
              <CarouselItem key={date.toString()} className="basis-1/7 sm:basis-1/10 md:basis-1/12 lg:basis-[8%]">
                 <Button
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "flex-col h-auto p-2 w-full text-xs",
                    isSelected && 'bg-accent text-accent-foreground hover:bg-accent/90',
                    !isSelected && hasData && 'bg-primary/20 border-primary/50',
                    !isSelected && !hasData && 'bg-secondary/50'
                  )}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="font-medium">{format(date, "EEE")}</span>
                  <span className="text-lg font-bold">{format(date, "d")}</span>
                  <span className="text-xs text-muted-foreground">{isToday(date) ? "Today" : format(date, "MMM")}</span>
                </Button>
              </CarouselItem>
            )})}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
      
      <div className="flex justify-center pb-4">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Go to Date
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={{ before: new Date("2025-10-25"), after: new Date() }}
              initialFocus
              modifiers={{ hasData: hasDataModifier }}
              modifiersStyles={{ hasData: { backgroundColor: "hsl(var(--primary) / 0.2)",  border: "1px solid hsl(var(--primary) / 0.5)"} }}
              components={DayWithTooltip}
            />
          </PopoverContent>
        </Popover>
      </div>


      <div className="px-6 pb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            Highlight for {format(selectedDate, "MMMM d, yyyy")}
          </h2>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsDownloadDialogOpen(true)}>
                    <Download className="mr-2 h-4 w-4" /> Download
                </Button>
                {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsPinDialogOpen(true)}>
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
                        formFields.map(field => (
                            <TableRow key={field.key}>
                                <TableCell className="font-semibold w-1/3 font-body">{field.label}</TableCell>
                                <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : (
                        formFields.map(field => (
                            <TableRow key={field.key}>
                                <TableCell className="font-semibold w-1/3 align-top pt-5 font-body">{field.label}</TableCell>
                                <TableCell>
                                {isEditing ? (
                                    <FormField
                                        control={form.control}
                                        name={field.key}
                                        render={({ field: formFieldRender }) => (
                                            <FormItem>
                                            <FormControl>
                                                {field.isTextarea ? (
                                                    <Textarea placeholder={`Enter ${field.label.toLowerCase()}...`} {...formFieldRender} className="font-body min-h-[100px]" />
                                                ) : (
                                                    <Input placeholder={`Enter ${field.label.toLowerCase()}...`} {...formFieldRender} className="font-body" />
                                                )}
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ) : (
                                    <div
                                        className="text-primary text-base min-h-[2.5rem] py-2 whitespace-pre-wrap font-body"
                                    >
                                        {(drugData && drugData[field.key]) || "No data available."}
                                    </div>
                                )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
                </Table>
            </div>
            {isEditing && (
                <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={handleAutofill} disabled={isFetchingAI}>
                        {isFetchingAI ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Auto-fill with AI
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive">
                           <Trash2 className="mr-2 h-4 w-4" /> Delete All Data
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            drug highlight data for {format(selectedDate, "MMMM d, yyyy")}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Confirm Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
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
    </>
  );
}
