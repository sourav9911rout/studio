"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addDays, subDays, eachDayOfInterval, isToday } from "date-fns";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DrugHighlight } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import PinDialog from "./PinDialog";
import { Pencil, Save, X, Calendar as CalendarIcon, Loader2 } from "lucide-react";

const drugSchema = z.object({
  name: z.string().min(1, "Drug name is required."),
  class: z.string().min(1, "Class is required."),
  mechanism: z.string().min(1, "Mechanism is required."),
  uses: z.string().min(1, "Uses are required."),
  sideEffects: z.string().min(1, "Side effects are required."),
  funFact: z.string().min(1, "Fun fact is required."),
});

const formFields: { key: keyof DrugHighlight, label: string, isTextarea: boolean }[] = [
    { key: 'name', label: 'Drug Name', isTextarea: false },
    { key: 'class', label: 'Drug Class', isTextarea: false },
    { key: 'mechanism', label: 'Mechanism of Action', isTextarea: true },
    { key: 'uses', label: 'Common Uses', isTextarea: true },
    { key: 'sideEffects', label: 'Side Effects', isTextarea: true },
    { key: 'funFact', label: 'Fun Fact', isTextarea: true },
];

const emptyDrugData: DrugHighlight = {
    name: "",
    class: "",
    mechanism: "",
    uses: "",
    sideEffects: "",
    funFact: "",
};


export default function PharmaFlashClient() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [drugData, setDrugData] = useState<DrugHighlight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();

  const form = useForm<DrugHighlight>({
    resolver: zodResolver(drugSchema),
    defaultValues: emptyDrugData,
  });

  const dateString = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);

  useEffect(() => {
    const fetchDrugData = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, "drug_highlights", dateString);
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
  }, [dateString, form, toast]);

  const datesForNavigation = useMemo(() => {
    const today = new Date();
    return eachDayOfInterval({
      start: subDays(today, 7),
      end: addDays(today, 7),
    });
  }, []);

  const handleSave = async (data: DrugHighlight) => {
    setIsSaving(true);
    try {
      const docRef = doc(db, "drug_highlights", dateString);
      await setDoc(docRef, data);
      setDrugData(data);
      setIsEditing(false);
      toast({
        title: "Success",
        description: `Drug highlight for ${dateString} has been saved.`,
      });
    } catch (error) {
      console.error("Error saving data:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save data to Firestore. Please check console for errors.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (drugData) {
      form.reset(drugData);
    } else {
      form.reset(emptyDrugData);
    }
    setIsEditing(false);
  }

  return (
    <>
      <div className="p-6">
        <h1 className="text-3xl font-headline font-bold text-center tracking-tight text-primary">Department of Pharmacology</h1>
        <p className="text-center text-primary text-lg mt-2">Your daily dose of pharmacology.</p>
      </div>
      
      <div className="px-6 pb-4">
        <ScrollArea className="w-full whitespace-nowrap rounded-md">
          <div className="flex space-x-2 pb-4">
            {datesForNavigation.map((date) => (
              <Button
                key={date.toString()}
                variant={format(date, "yyyy-MM-dd") === dateString ? "default" : "outline"}
                className={`flex-col h-auto py-2 px-3 ${format(date, "yyyy-MM-dd") === dateString ? 'bg-accent text-accent-foreground hover:bg-accent/90' : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                <span className="text-sm font-medium">{format(date, "EEE")}</span>
                <span className="text-xl font-bold">{format(date, "d")}</span>
                <span className="text-xs text-muted-foreground">{isToday(date) ? "Today" : format(date, "MMM")}</span>
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="px-6 pb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            Highlight for {format(selectedDate, "MMMM d, yyyy")}
          </h2>
          {!isEditing && (
             <Button variant="outline" size="sm" onClick={() => setIsPinDialogOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
             </Button>
          )}
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)}>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                <TableBody>
                    {isLoading ? (
                        formFields.map(field => (
                            <TableRow key={field.key}>
                                <TableCell className="font-semibold w-1/3">{field.label}</TableCell>
                                <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : (
                        formFields.map(field => (
                            <TableRow key={field.key}>
                                <TableCell className="font-semibold w-1/3 align-top pt-5">{field.label}</TableCell>
                                <TableCell>
                                {isEditing ? (
                                    <FormField
                                        control={form.control}
                                        name={field.key}
                                        render={({ field: formFieldRender }) => (
                                            <FormItem>
                                            <FormControl>
                                                {field.isTextarea ? (
                                                    <Textarea placeholder={`Enter ${field.label.toLowerCase()}...`} {...formFieldRender} className="min-h-[100px]" />
                                                ) : (
                                                    <Input placeholder={`Enter ${field.label.toLowerCase()}...`} {...formFieldRender} />
                                                )}
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ) : (
                                    <p className="text-muted-foreground min-h-[2.5rem] flex items-center whitespace-pre-wrap">
                                        {(drugData && drugData[field.key]) || "No data available."}
                                    </p>
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
    </>
  );
}
