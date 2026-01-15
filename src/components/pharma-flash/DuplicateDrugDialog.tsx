
"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { DrugHighlight } from "@/lib/types";

export interface DuplicateDrugInfo {
  drugName: string;
  date: string;
  data: DrugHighlight;
}

interface DuplicateDrugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateDrugInfo: DuplicateDrugInfo;
  onConfirmRepeat: () => void;
  onGoWithNew: () => void;
}

export default function DuplicateDrugDialog({
  open,
  onOpenChange,
  duplicateDrugInfo,
  onConfirmRepeat,
  onGoWithNew,
}: DuplicateDrugDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Duplicate Drug Found
          </AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{duplicateDrugInfo.drugName}</strong> was already highlighted
            on {duplicateDrugInfo.date}.<br />
            Would you like to copy the existing data or enter a new drug?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onGoWithNew}>
            Enter New Drug
          </Button>
          <Button onClick={onConfirmRepeat}>Copy Existing Data</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
