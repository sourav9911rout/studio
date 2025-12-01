"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { DrugHighlight } from "@/lib/types";
import { Download, Loader2 } from "lucide-react";

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datesWithData: Set<string>;
}

export default function DownloadDialog({
  open,
  onOpenChange,
  datesWithData,
}: DownloadDialogProps) {
  const [range, setRange] = useState<DateRange | undefined>();
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const parseDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Create date in UTC to avoid timezone issues
    return new Date(Date.UTC(year, month - 1, day));
  };

  const handleDownload = async () => {
    if (!range || !range.from || !range.to) {
      toast({
        variant: "destructive",
        title: "Invalid Date Range",
        description: "Please select a start and end date.",
      });
      return;
    }
    if (!firestore) return;

    setIsDownloading(true);

    try {
      const startDate = format(range.from, "yyyy-MM-dd");
      const endDate = format(range.to, "yyyy-MM-dd");

      const q = query(
        collection(firestore, "drugHighlights"),
        where("__name__", ">=", startDate),
        where("__name__", "<=", endDate),
        orderBy("__name__")
      );

      const querySnapshot = await getDocs(q);
      const highlights = querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as (DrugHighlight & { id: string })[];

      if (highlights.length === 0) {
        toast({
          title: "No Data Found",
          description: "No drug highlights found in the selected date range.",
        });
        setIsDownloading(false);
        return;
      }
      
      const doc = new jsPDF();
      doc.setFont("times", "normal");
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 15;
      let cursorY = 0;

      const addHeader = (docInstance: jsPDF) => {
        docInstance.setFont("times", "bold");
        docInstance.setFontSize(20);
        docInstance.text("Department of Pharmacology", pageWidth / 2, 20, { align: 'center' });
        docInstance.setFontSize(14);
        docInstance.setFont("times", "normal");
        docInstance.text("भेषजगुण विज्ञान विभाग", pageWidth / 2, 28, { align: 'center' });
        docInstance.setLineWidth(0.5);
        docInstance.line(margin, 35, pageWidth - margin, 35);
        return 45; // New cursor Y position
      };

      const addHighlight = (docInstance: jsPDF, highlight: DrugHighlight & { id: string }, startY: number): number => {
          let currentY = startY;

          const highlightDate = parseDateString(highlight.id);
          docInstance.setFontSize(12);
          docInstance.setFont("times", "bold");
          docInstance.text("Date:", margin, currentY);
          docInstance.setFont("times", "normal");
          docInstance.text(format(highlightDate, "MMMM d, yyyy"), margin + 15, currentY);
          currentY += 8;

          const fieldToLabel: { key: keyof DrugHighlight, label: string }[] = [
              { key: 'drugName', label: 'Drug of the Day' },
              { key: 'drugClass', label: 'Drug Class' },
              { key: 'mechanism', label: 'Mechanism of Action' },
              { key: 'uses', label: 'Common Uses' },
              { key: 'sideEffects', label: 'Side Effects' },
              { key: 'funFact', label: 'Fun Fact' },
          ];

          fieldToLabel.forEach(item => {
              docInstance.setFontSize(11);
              docInstance.setFont("times", "bold");
              docInstance.text(item.label + ":", margin, currentY);
              
              docInstance.setFont("times", "normal");
              const text = highlight[item.key] || "";
              const splitText = docInstance.splitTextToSize(text, pageWidth - margin * 2 - 45);
              
              docInstance.text(splitText, margin + 45, currentY, {
                align: 'left',
                lineHeightFactor: 1.2
              });
              
              const textHeight = docInstance.getTextDimensions(splitText).h;
              currentY += textHeight + 4; // Add some padding
          });

          return currentY + 5; // Return Y for next element
      }

      cursorY = addHeader(doc);

      highlights.forEach((highlight, index) => {
        // Estimate height to check if new page is needed. This is a simple approximation.
        const estimatedHeight = 100; // A rough guess for height per entry
        if (cursorY + estimatedHeight > pageHeight - margin) {
            doc.addPage();
            cursorY = addHeader(doc);
        }

        cursorY = addHighlight(doc, highlight, cursorY);
        
        // Add a separator line between entries if it's not the last one
        if (index < highlights.length - 1) {
            if (cursorY + 10 > pageHeight - margin) {
                doc.addPage();
                cursorY = addHeader(doc);
            } else {
                doc.setLineWidth(0.2);
                doc.line(margin, cursorY, pageWidth - margin, cursorY);
                cursorY += 10;
            }
        }
      });


      doc.save(`pharmacology-highlights-${startDate}-to-${endDate}.pdf`);

      toast({
        title: "Download Complete",
        description: "Your PDF has been generated successfully.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description:
          "An error occurred while generating the PDF. Please try again.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const hasDataModifier = Array.from(datesWithData).map(dateStr => parseDateString(dateStr));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Highlights
          </DialogTitle>
          <DialogDescription>
            Select a date range to download the drug highlights as a PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={1}
            modifiers={{ hasData: hasDataModifier }}
            modifiersStyles={{ hasData: { backgroundColor: "hsl(var(--primary) / 0.2)",  border: "1px solid hsl(var(--primary) / 0.5)"} }}
            disabled={{ before: new Date("2025-10-25"), after: new Date() }}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || !range?.from || !range?.to}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
