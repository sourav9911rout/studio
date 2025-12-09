
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookText, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  references: string[];
  onSave: (references: string[]) => void;
}

export default function ReferenceDialog({
  open,
  onOpenChange,
  references,
  onSave,
}: ReferenceDialogProps) {
  const [localRefs, setLocalRefs] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setLocalRefs(references ? [...references] : []);
    }
  }, [open, references]);

  const handleAddRef = () => {
    setLocalRefs([...localRefs, ""]);
  };

  const handleRemoveRef = (index: number) => {
    setLocalRefs(localRefs.filter((_, i) => i !== index));
  };

  const handleRefChange = (index: number, value: string) => {
    const newRefs = [...localRefs];
    newRefs[index] = value;
    setLocalRefs(newRefs);
  };

  const handleSaveChanges = () => {
    // Filter out empty strings before saving
    const validRefs = localRefs.filter((ref) => ref.trim() !== "");
    onSave(validRefs);
    toast({
      title: "References Saved",
      description: "Your reference links have been updated.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookText className="h-5 w-5" />
            Edit References
          </DialogTitle>
          <DialogDescription>
            Add or remove reference links for "Off Label Use". Paste each link below.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-64 pr-4">
          <div className="space-y-4 py-4">
            {localRefs.length > 0 ? (
              localRefs.map((ref, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Label htmlFor={`ref-${index}`} className="sr-only">
                    Link {index + 1}
                  </Label>
                  <Input
                    id={`ref-${index}`}
                    value={ref}
                    onChange={(e) => handleRefChange(index, e.target.value)}
                    placeholder="https://example.com"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRef(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                No references added yet.
              </p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between items-center w-full">
            <Button
                type="button"
                variant="outline"
                onClick={handleAddRef}
                className="w-full sm:w-auto"
            >
                <Plus className="mr-2 h-4 w-4" />
                Add Link
            </Button>
            <Button type="button" onClick={handleSaveChanges} className="w-full sm:w-auto">
                Save Changes
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
