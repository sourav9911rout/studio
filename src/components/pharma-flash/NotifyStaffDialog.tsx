'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DailyHighlight } from '@/lib/types';
import { Loader2, Mail, Plus, Trash2 } from 'lucide-react';
import { sendDailyHighlightEmail } from '@/app/actions';
import { ScrollArea } from '../ui/scroll-area';

interface NotifyStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyHighlight: DailyHighlight | null;
}

const RECIPIENTS_STORAGE_KEY = 'pharma-flash-recipients';

export default function NotifyStaffDialog({
  open,
  onOpenChange,
  dailyHighlight,
}: NotifyStaffDialogProps) {
  const [recipients, setRecipients] = useState<string[]>(['']);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const storedRecipients = localStorage.getItem(RECIPIENTS_STORAGE_KEY);
      if (storedRecipients) {
        try {
          const parsed = JSON.parse(storedRecipients);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecipients(parsed);
          } else {
            setRecipients(['']);
          }
        } catch (e) {
          console.error('Failed to parse recipients from localStorage', e);
          setRecipients(['']);
        }
      }
    }
  }, [open]);

  const handleRecipientChange = (index: number, value: string) => {
    const newRecipients = [...recipients];
    newRecipients[index] = value;
    setRecipients(newRecipients);
  };

  const handleAddRecipient = () => {
    setRecipients([...recipients, '']);
  };

  const handleRemoveRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };

  const handleSendEmail = async () => {
    if (!dailyHighlight || dailyHighlight.drugs.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data',
        description: 'There are no drug highlights for this day to send.',
      });
      return;
    }

    const emailList = recipients
      .map(email => email.trim())
      .filter(email => email);

    if (emailList.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Recipients',
        description: 'Please enter at least one valid recipient email address.',
      });
      return;
    }

    setIsSending(true);
    try {
      const result = await sendDailyHighlightEmail(dailyHighlight, emailList);
      if (result.success) {
        localStorage.setItem(RECIPIENTS_STORAGE_KEY, JSON.stringify(emailList));
        toast({
          title: 'Email Sent',
          description: `Highlights for ${dailyHighlight.date} sent to ${
            emailList.length
          } recipient(s).`,
        });
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Send Email',
          description: result.message,
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'An Error Occurred',
        description:
          'Could not send the email. Check the console for more details.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notify Staff
          </DialogTitle>
          <DialogDescription>
            Add recipient emails. The list will be remembered for next time. The
            highlight for {dailyHighlight?.date} will be sent.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="recipients" className="mb-2 block">
            Recipient Emails
          </Label>
          <ScrollArea className="h-40 w-full rounded-md border p-2">
            <div className="space-y-2">
              {recipients.map((recipient, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    id={`recipient-${index}`}
                    value={recipient}
                    onChange={e => handleRecipientChange(index, e.target.value)}
                    placeholder="staff@example.com"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRecipient(index)}
                    disabled={recipients.length <= 1}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRecipient}
            className="mt-2 w-full"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Recipient
          </Button>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSendEmail}
            disabled={isSending || recipients.every(r => r.trim() === '')}
          >
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Inform Others
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
