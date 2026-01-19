'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DailyHighlight } from '@/lib/types';
import { Loader2, Mail } from 'lucide-react';
import { sendDailyHighlightEmail } from '@/app/actions';

interface NotifyStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyHighlight: DailyHighlight | null;
}

export default function NotifyStaffDialog({
  open,
  onOpenChange,
  dailyHighlight,
}: NotifyStaffDialogProps) {
  const [recipients, setRecipients] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

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
      .split(/[,;\s]+/)
      .map(email => email.trim())
      .filter(email => email);

    if (emailList.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Recipients',
        description: 'Please enter at least one recipient email address.',
      });
      return;
    }

    setIsSending(true);
    try {
      const result = await sendDailyHighlightEmail(dailyHighlight, emailList);
      if (result.success) {
        toast({
          title: 'Email Sent',
          description: `Highlights for ${dailyHighlight.date} sent to ${emailList.length} recipient(s).`,
        });
        onOpenChange(false);
        setRecipients('');
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
            Enter recipient emails separated by commas, semicolons, or spaces.
            The highlight for {dailyHighlight?.date} will be sent.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="recipients">Recipient Emails</Label>
          <Textarea
            id="recipients"
            value={recipients}
            onChange={e => setRecipients(e.target.value)}
            placeholder="staff1@example.com, staff2@example.com"
            className="mt-2 min-h-[100px]"
          />
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
            disabled={isSending}
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
