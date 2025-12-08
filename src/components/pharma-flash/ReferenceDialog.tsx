
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { BookText } from "lucide-react";

interface ReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  references: string[];
}

export default function ReferenceDialog({
  open,
  onOpenChange,
  label,
  references,
}: ReferenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookText className="h-5 w-5" />
            References for {label}
          </DialogTitle>
          <DialogDescription>
            The following sources were used by the AI to generate this information.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="py-4 space-y-2 max-h-60 overflow-y-auto">
          {references.length > 0 ? (
            references.map((ref, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">{index + 1}.</span>
                <a
                  href={ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 hover:underline break-all"
                >
                  {ref}
                </a>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No references were provided for this information.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
