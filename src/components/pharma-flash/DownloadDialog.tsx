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
}

export default function DownloadDialog({
  open,
  onOpenChange,
}: DownloadDialogProps) {
  const [range, setRange] = useState<DateRange | undefined>();
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

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
      const highlightsPerPage = 4;
      let lastY = 0;

      const addPageHeader = () => {
        doc.setFontSize(20);
        doc.text("Department of Pharmacology", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
        doc.setFontSize(16);
        doc.text("भेषजगुण विज्ञान विभाग", doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
        lastY = 35; // Reset Y position for content
      };
      
      addPageHeader();

      highlights.forEach((highlight, index) => {
        const isNewPage = index % highlightsPerPage === 0 && index > 0;
        if (isNewPage) {
          doc.addPage();
          addPageHeader();
        }

        autoTable(doc, {
            head: [[
                { content: format(new Date(highlight.id.replace(/-/g, '/')), "d-MMMM-yyyy"), styles: { halign: 'left', fontStyle: 'bold' } },
                { content: 'Daily Drug Highlight', styles: { halign: 'center', fontStyle: 'bold' } }
            ]],
            body: [
                ['Drug of the Day', highlight.drugName],
                ['Class', highlight.drugClass],
                ['Mechanism of action', highlight.mechanism],
                ['Uses', highlight.uses],
                ['Side Effects', highlight.sideEffects],
                ['Fun-fact', highlight.funFact],
            ],
            startY: lastY + 5,
            theme: 'grid',
            styles: {
                font: 'helvetica',
                lineWidth: 0.1,
                lineColor: [0, 0, 0],
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontSize: 10,
            },
            bodyStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontSize: 9,
            },
            columnStyles: {
                0: { fontStyle: 'bold' }
            }
        });
        lastY = (doc as any).lastAutoTable.finalY;
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
