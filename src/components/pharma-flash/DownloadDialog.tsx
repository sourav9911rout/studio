
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
import { DrugHighlight, InfoWithReference } from "@/lib/types";
import { Download, Loader2 } from "lucide-react";

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datesWithData: Set<string>;
}

// Helper to safely get the display value for a field, whether it's a string or an object
const getDisplayValue = (fieldData: any): string => {
  if (typeof fieldData === 'string') {
    return fieldData;
  }
  if (fieldData && typeof fieldData === 'object' && 'value' in fieldData) {
    return fieldData.value || '';
  }
  return '';
};


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
    // Create date in UTC to avoid timezone issues with date-fns format
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
      
      doc.setFontSize(20);
      doc.setFont("times", "bold");
      doc.text("Department of Pharmacology", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.setFont("times", "normal");
      doc.text(`Drug Highlights from ${format(range.from, "MMMM d, yyyy")} to ${format(range.to, "MMMM d, yyyy")}`, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

      let firstPage = true;

      highlights.forEach(highlight => {
        if (!firstPage) {
          doc.addPage();
        }
        firstPage = false;
        
        const highlightDate = format(parseDateString(highlight.id), "MMMM d, yyyy");
        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text(`Highlight for: ${highlightDate}`, 14, 20);

        const offLabelUse = highlight.offLabelUse as unknown as InfoWithReference | string;
        let offLabelValue = '';
        let offLabelRefs: string[] = [];

        if (typeof offLabelUse === 'string') {
          offLabelValue = offLabelUse;
        } else if (offLabelUse && typeof offLabelUse === 'object') {
          offLabelValue = offLabelUse.value || '';
          offLabelRefs = offLabelUse.references || [];
        }
        
        const referencesContent = offLabelRefs.length > 0 
          ? `${offLabelValue}\n\nReferences:\n${offLabelRefs.join('\n')}`
          : offLabelValue;

        const tableData = [
            ['Drug of the Day', getDisplayValue(highlight.drugName)],
            ['Drug Class', getDisplayValue(highlight.drugClass)],
            ['Mechanism of Action', getDisplayValue(highlight.mechanism)],
            ['Common Uses', getDisplayValue(highlight.uses)],
            ['Side Effects', getDisplayValue(highlight.sideEffects)],
            ['Route of Administration', getDisplayValue(highlight.routeOfAdministration)],
            ['Dose', getDisplayValue(highlight.dose)],
            ['Dosage Form', getDisplayValue(highlight.dosageForm)],
            ['Half-life', getDisplayValue(highlight.halfLife)],
            ['Clinical uses', getDisplayValue(highlight.clinicalUses)],
            ['Contraindication', getDisplayValue(highlight.contraindication)],
            ['Off Label Use', referencesContent],
            ['Fun Fact', getDisplayValue(highlight.funFact)],
        ];

        autoTable(doc, {
          startY: 30,
          head: [['Field', 'Information']],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [22, 160, 133], // A teal color
            textColor: 255,
            fontStyle: 'bold',
            font: 'times',
          },
          styles: {
            font: "times",
            fontSize: 12,
            cellPadding: 3,
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 50 },
            1: { cellWidth: 'auto' },
          },
          alternateRowStyles: {
            fillColor: [240, 240, 240] // Light gray for alternate rows
          },
          didParseCell: (data) => {
            // For clickable links in the Off Label Use section
            if (data.row.section === 'body' && data.column.index === 1 && data.cell.raw) {
              const text = data.cell.raw.toString();
              if (text.includes('https://') || text.includes('http://')) {
                 // We don't need special handling here, autoTable handles links automatically if text is a URL.
                 // The text splitting logic below will handle creating multiple lines for text + links.
              }
            }
          },
        });
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
            disabled={{ before: new Date("2024-01-01"), after: new Date() }}
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

    