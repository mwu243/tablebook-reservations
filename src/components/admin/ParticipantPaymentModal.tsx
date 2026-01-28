import { Copy, CreditCard, Loader2, Users, X } from 'lucide-react';
import { useParticipantPaymentInfo } from '@/hooks/useParticipantPaymentInfo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ParticipantPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string | null;
  slotName: string;
}

export function ParticipantPaymentModal({
  open,
  onOpenChange,
  slotId,
  slotName,
}: ParticipantPaymentModalProps) {
  const { data: participants, isLoading, error } = useParticipantPaymentInfo(open ? slotId : null);

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyAllPaymentInfo = async () => {
    if (!participants || participants.length === 0) return;

    const lines = participants.map((p) => {
      const paymentInfo = [];
      if (p.venmo_username) paymentInfo.push(`Venmo: @${p.venmo_username}`);
      if (p.zelle_identifier) paymentInfo.push(`Zelle: ${p.zelle_identifier}`);
      return `${p.customer_name} (${p.party_size} guest${p.party_size > 1 ? 's' : ''}) - ${paymentInfo.join(', ') || 'No payment info'}`;
    });

    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success('All participant info copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Info
          </DialogTitle>
          <DialogDescription>
            Participant payment information for <strong>{slotName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              Failed to load payment info. Make sure you own this event.
            </div>
          ) : !participants || participants.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-muted-foreground">No confirmed participants yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {participants.map((participant) => (
                <div
                  key={participant.booking_id}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{participant.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {participant.party_size} guest{participant.party_size > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {participant.venmo_username ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(participant.venmo_username!, 'Venmo username')}
                        className="text-xs"
                      >
                        <Copy className="mr-1.5 h-3 w-3" />
                        @{participant.venmo_username}
                      </Button>
                    ) : null}
                    
                    {participant.zelle_identifier ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(participant.zelle_identifier!, 'Zelle identifier')}
                        className="text-xs"
                      >
                        <Copy className="mr-1.5 h-3 w-3" />
                        {participant.zelle_identifier}
                      </Button>
                    ) : null}
                    
                    {!participant.venmo_username && !participant.zelle_identifier && (
                      <span className="text-xs text-muted-foreground italic">
                        No payment info provided
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {participants && participants.length > 0 && (
          <div className="flex justify-end border-t pt-4">
            <Button variant="outline" size="sm" onClick={copyAllPaymentInfo}>
              <Copy className="mr-2 h-4 w-4" />
              Copy All
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
