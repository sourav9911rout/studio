"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/firebase";

const ADMIN_PIN = "743351"; // In a real app, this should be handled securely.

interface PinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function PinDialog({ open, onOpenChange, onSuccess }: PinDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();
  const auth = useAuth();

  const handleConfirm = () => {
    if (pin === ADMIN_PIN) {
      setError("");
      onSuccess();
      toast({
        title: "Edit Mode Unlocked",
        description: "You can now edit the drug information.",
      });
      onOpenChange(false);
      setPin("");
      
    } else {
      setError("Invalid PIN. Please try again.");
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setPin("");
      setError("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Enter Admin PIN
          </DialogTitle>
          <DialogDescription>
            Enter the PIN to enable edit mode. This is a placeholder for a real login.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pin" className="text-right">
              PIN
            </Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="col-span-3"
              autoComplete="one-time-code"
            />
          </div>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
