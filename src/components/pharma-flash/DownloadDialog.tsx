
"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
import { DailyHighlight, DrugHighlight, InfoWithReference } from "@/lib/types";
import { Download, Loader2 } from "lucide-react";

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datesWithData: Set<string>;
  allDrugData: Map<string, DrugHighlight[]>; // Changed from allDrugData
}

// Helper to safely get the display value for a field
const getDisplayValue = (fieldData: any): string => {
  if (typeof fieldData === 'string') {
    return fieldData;
  }
  if (fieldData && typeof fieldData === 'object' && 'value' in fieldData && typeof fieldData.value === 'string') {
    return fieldData.value;
  }
  return '';
};


export default function DownloadDialog({
  open,
  onOpenChange,
  datesWithData,
  allDrugData,
}: DownloadDialogProps) {
  const [range, setRange] = useState<DateRange | undefined>();
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const parseDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
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

    setIsDownloading(true);

    try {
      const startDate = format(range.from, "yyyy-MM-dd");
      const endDate = format(range.to, "yyyy-MM-dd");
      
      const highlightsToExport: DailyHighlight[] = [];
      for (const [date, drugs] of allDrugData.entries()) {
          if(date >= startDate && date <= endDate) {
            highlightsToExport.push({ date, drugs });
          }
      }
      highlightsToExport.sort((a,b) => a.date.localeCompare(b.date));


      if (highlightsToExport.length === 0) {
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

      let isFirstPage = true;

      highlightsToExport.forEach(dailyHighlight => {
        if (!isFirstPage) {
          doc.addPage();
        }
        isFirstPage = false;

        const highlightDate = format(parseDateString(dailyHighlight.date), "MMMM d, yyyy");
        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text(`Highlights for: ${highlightDate}`, 14, 20);

        let startY = 30;

        dailyHighlight.drugs.forEach((highlight, index) => {
            if (index > 0) {
                // Add a separator between drugs on the same day
                startY += 10;
                if (startY > 270) { // Check if new page is needed
                    doc.addPage();
                    startY = 20;
                }
                doc.setDrawColor(180, 180, 180);
                doc.line(14, startY - 5, doc.internal.pageSize.getWidth() - 14, startY - 5);
            }

            const offLabelUse = highlight.offLabelUse as InfoWithReference;
            let offLabelValue = offLabelUse.value || '';
            let offLabelRefs = offLabelUse.references || [];
            
            const referencesContent = offLabelRefs.length > 0 
              ? `${offLabelValue}\n\nReferences:\n${offLabelRefs.join('\n')}`
              : offLabelValue;

            const tableData = [
                ['Drug Name', getDisplayValue(highlight.drugName)],
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
                startY: startY,
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
                  fillColor: [240, 240, 240]
                },
                didDrawPage: (data) => {
                    startY = data.cursor?.y ?? 30; // Update startY for next table
                },
              });
              // @ts-ignore
              startY = doc.lastAutoTable.finalY;
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
