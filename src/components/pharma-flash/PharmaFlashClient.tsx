
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, isToday, eachDayOfInterval, parse, isSunday, subDays } from "date-fns";
import { doc, getDoc, getDocs, collection, query, where, orderBy } from "firebase/firestore";
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
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import PinDialog from "./PinDialog";
import DownloadDialog from "./DownloadDialog";
import { Pencil, Save, X, Calendar as CalendarIcon, Loader2, Download, Trash2, Sparkles, CheckCircle, XCircle } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";
import { ThemeToggle } from "../ThemeToggle";
import { getDrugInfo } from "@/ai/flows/drug-info-flow";
import { generateMcqs, McqQuestion } from "@/ai/flows/mcq-flow";


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
  const [datesWithData, setDatesWithData] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingAI, setIsFetchingAI] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  // Quiz state
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<McqQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<{score: number; total: number} | null>(null);


  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  const form = useForm<DrugHighlight>({
    resolver: zodResolver(drugSchema),
    defaultValues: emptyDrugData,
  });

  const dateString = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);
  const isSundaySelected = useMemo(() => isSunday(selectedDate), [selectedDate]);

  useEffect(() => {
    if (firestore && user === null && !isUserLoading) {
      initiateAnonymousSignIn(auth);
    }
  }, [firestore, user, isUserLoading, auth]);
  
  useEffect(() => {
    if (!firestore) return;

    const fetchAllDrugDates = async () => {
        const q = query(collection(firestore, "drugHighlights"));
        const querySnapshot = await getDocs(q);
        const newDatesWithData = new Set<string>();
        querySnapshot.forEach(doc => {
          newDatesWithData.add(doc.id);
        });
        setDatesWithData(newDatesWithData);
    };

    fetchAllDrugDates();
  }, [firestore]);

  useEffect(() => {
    if (!firestore) return;
    const fetchDrugData = async () => {
      setIsLoading(true);
      // Reset quiz state when date changes
      setQuizQuestions([]);
      setUserAnswers({});
      setQuizResult(null);

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

  const handleGenerateQuiz = async () => {
    if (!firestore) return;

    setIsGeneratingQuiz(true);
    setQuizQuestions([]);
    setUserAnswers({});
    setQuizResult(null);

    try {
      const lastWeekDate = format(subDays(selectedDate, 6), "yyyy-MM-dd");
      const sundayDate = format(selectedDate, "yyyy-MM-dd");

      const q = query(
        collection(firestore, "drugHighlights"),
        where("__name__", ">=", lastWeekDate),
        where("__name__", "<=", sundayDate),
        orderBy("__name__")
      );
      
      const querySnapshot = await getDocs(q);
      const highlights = querySnapshot.docs.map((doc) => doc.data()) as DrugHighlight[];

      if (highlights.length === 0) {
        toast({
          title: "Not Enough Data",
          description: "There isn't enough drug data from the past week to generate a quiz.",
        });
        setIsGeneratingQuiz(false);
        return;
      }
      
      const result = await generateMcqs({ drugs: highlights });
      setQuizQuestions(result.questions);
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast({
        variant: "destructive",
        title: "Quiz Generation Failed",
        description: "Could not generate the quiz. Please try again.",
      });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setUserAnswers(prev => ({...prev, [questionIndex]: answer}));
  };

  const handleCheckResult = () => {
    let score = 0;
    quizQuestions.forEach((q, index) => {
      if (userAnswers[index] === q.correctAnswer) {
        score++;
      }
    });
    setQuizResult({ score, total: quizQuestions.length });
  };


  const handleSave = async (data: DrugHighlight) => {
    if (!firestore) return;
    setIsSaving(true);
    const docRef = doc(firestore, "drugHighlights", dateString);
    setDocumentNonBlocking(docRef, data, { merge: true });
    
    // Optimistically update UI
    setDrugData(data);
    setDatesWithData(prev => new Set(prev).add(dateString));
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
    setDatesWithData(prev => {
        const newSet = new Set(prev);
        newSet.delete(dateString);
        return newSet;
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
  
  const hasDataModifier = useMemo(() => Array.from(datesWithData).map(parseDateString), [datesWithData]);
  

  return (
    <>
      <div className="p-6 relative">
        <h1 className="text-3xl font-headline font-bold text-center tracking-tight text-primary">Department of Pharmacology</h1>
        <p className="text-center text-xl font-headline text-primary mt-1 font-bold">भेषजगुण विज्ञान विभाग</p>
        <p className="text-center text-primary text-3xl mt-2 font-headline">Your Daily Dose of Pharmacology.</p>
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
                disabled={{ before: new Date('2025-10-25'), after: new Date() }}
                initialFocus
                modifiers={{ hasData: hasDataModifier }}
                modifiersStyles={{ hasData: { backgroundColor: "hsl(var(--primary) / 0.2)",  border: "1px solid hsl(var(--primary) / 0.5)"} }}
              />
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="px-6 pb-6">
      <Tabs defaultValue="highlight" className="w-full" value={isSundaySelected ? undefined: "highlight"}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                {isSundaySelected ? `Weekly Review for ${format(selectedDate, "MMMM d, yyyy")}` : `Highlight for ${format(selectedDate, "MMMM d, yyyy")}`}
            </h2>
            <div className="flex items-center gap-2">
                <TabsList className={cn(!isSundaySelected && "hidden")}>
                    <TabsTrigger value="highlight">Drug of the Day</TabsTrigger>
                    <TabsTrigger value="quiz">Ask Questions</TabsTrigger>
                </TabsList>
                <Button variant="outline" size="sm" onClick={() => setIsDownloadDialogOpen(true)}>
                    <Download className="mr-2 h-4 w-4" /> Download
                </Button>
                {!isEditing && !isSundaySelected && (
                    <Button variant="outline" size="sm" onClick={() => setIsPinDialogOpen(true)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>
                )}
            </div>
        </div>

        <TabsContent value="highlight">
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
        </TabsContent>

        <TabsContent value="quiz">
            <Card>
                <CardHeader>
                    <CardTitle>Sunday Quiz</CardTitle>
                    <CardDescription>Test your knowledge of the drugs highlighted in the past week.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isGeneratingQuiz && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-4 text-muted-foreground">Generating your quiz...</p>
                        </div>
                    )}

                    {!isGeneratingQuiz && quizQuestions.length === 0 && !quizResult && (
                        <div className="text-center py-12">
                            <p className="mb-4 text-muted-foreground">Ready to test your pharmacology knowledge?</p>
                            <Button onClick={handleGenerateQuiz}>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate 10-Question Quiz
                            </Button>
                        </div>
                    )}
                    
                    {quizResult && (
                        <div className="text-center py-12 space-y-4">
                             <h3 className="text-2xl font-bold">Quiz Complete!</h3>
                            <p className="text-4xl font-bold text-primary">{quizResult.score} / {quizResult.total}</p>
                            <p className="text-muted-foreground">
                                {quizResult.score > 7 ? "Excellent work! You have a strong grasp of the material." : "Good effort! Keep reviewing to improve your score."}
                            </p>
                            <div className="space-y-4 pt-4">
                                {quizQuestions.map((q, index) => (
                                    <div key={index} className={cn("p-4 rounded-md text-left", userAnswers[index] === q.correctAnswer ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                                        <p className="font-semibold">{index + 1}. {q.question}</p>
                                        <p className={cn("mt-2 text-sm", userAnswers[index] === q.correctAnswer ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>
                                            Your answer: {userAnswers[index] || "Not answered"}
                                            {userAnswers[index] !== q.correctAnswer && <span className="block">Correct answer: {q.correctAnswer}</span>}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={handleGenerateQuiz} className="mt-6">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Try Another Quiz
                            </Button>
                        </div>
                    )}

                    {!quizResult && quizQuestions.length > 0 && (
                        <div className="space-y-8">
                            {quizQuestions.map((q, index) => (
                                <div key={index} className="space-y-3">
                                    <p className="font-semibold text-base">{index + 1}. {q.question}</p>
                                    <RadioGroup
                                        onValueChange={(value) => handleAnswerChange(index, value)}
                                        value={userAnswers[index]}
                                        className="space-y-2"
                                    >
                                        {q.options.map((option, i) => (
                                            <div key={i} className="flex items-center space-x-2">
                                                <RadioGroupItem value={option} id={`q${index}-opt${i}`} />
                                                <Label htmlFor={`q${index}-opt${i}`}>{option}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </div>
                            ))}
                            <Button onClick={handleCheckResult} disabled={Object.keys(userAnswers).length !== quizQuestions.length}>
                                Check Result
                            </Button>
                        </div>
                    )}

                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
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
