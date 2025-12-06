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
    // Create date in UTC to avoid timezone issues with date-fns format
    return new Date(year, month - 1, day);
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
      
      // Add a title to the document
      doc.setFontSize(20);
      doc.setFont("times", "bold");
      doc.text("Department of Pharmacology", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

      const allTables = highlights.map(highlight => {
        const highlightDate = format(parseDateString(highlight.id), "MMMM d, yyyy");
        const tableData = [
            ['Drug of the Day', highlight.drugName],
            ['Drug Class', highlight.drugClass],
            ['Mechanism of Action', highlight.mechanism],
            ['Common Uses', highlight.uses],
            ['Side Effects', highlight.sideEffects],
            ['Route of Administration', highlight.routeOfAdministration],
            ['Dose', highlight.dose],
            ['Dosage Form', highlight.dosageForm],
            ['Half-life', highlight.halfLife],
            ['Clinical uses', highlight.clinicalUses],
            ['Contraindication', highlight.contraindication],
            ['Off Label Use', highlight.offLabelUse],
            ['Fun Fact', highlight.funFact],
        ];

        return {
          head: [[{ content: `Date: ${highlightDate}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [220, 230, 240] } }]],
          body: tableData,
          theme: 'grid',
          styles: {
            font: "times", // Use a standard font
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 50 },
            1: { cellWidth: 'auto' },
          },
          didParseCell: function (data: any) {
            // This ensures that newlines in the data are respected
            if (typeof data.cell.raw === 'string') {
              data.cell.text = data.cell.raw.split('\n');
            }
          }
        };
      });

      autoTable(doc, {
        startY: 35,
        body: allTables.flatMap(table => [...table.head, ...table.body]),
        theme: 'grid',
        styles: {
          font: "times",
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 'auto' },
        },
        didParseCell: function (data: any) {
            if (data.cell.raw.hasOwnProperty('colSpan')) { // It's a header row
                data.cell.styles.fillColor = [220, 230, 240];
                data.cell.styles.fontStyle = 'bold';
            }
            if (typeof data.cell.raw === 'string') {
              data.cell.text = data.cell.raw.split('\n');
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
