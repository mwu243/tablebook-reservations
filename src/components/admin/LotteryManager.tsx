import { useState } from 'react';
import { format } from 'date-fns';
import { Check, Dices, Loader2, Mail, Ticket, Trophy, Users, X } from 'lucide-react';
import { useLotteryBookings, useConfirmLotteryWinner, useRejectLotteryEntry, usePickRandomWinner } from '@/hooks/useLotteryBookings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Booking } from '@/lib/types';

export function LotteryManager() {
  const { data: lotteryEntries, isLoading } = useLotteryBookings();
  const confirmWinner = useConfirmLotteryWinner();
  const rejectEntry = useRejectLotteryEntry();
  const pickRandomWinner = usePickRandomWinner();
  
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; booking: Booking | null }>({
    open: false,
    booking: null,
  });
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; booking: Booking | null }>({
    open: false,
    booking: null,
  });
  const [randomPickDialog, setRandomPickDialog] = useState<{ 
    open: boolean; 
    slotId: string | null; 
    slotName: string;
    entries: Booking[];
  }>({
    open: false,
    slotId: null,
    slotName: '',
    entries: [],
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleConfirmWinner = async () => {
    if (!confirmDialog.booking) return;
    
    try {
      await confirmWinner.mutateAsync({
        bookingId: confirmDialog.booking.id,
        slotId: confirmDialog.booking.slot_id,
      });
      
      // Simulate email notification
      toast.success(
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <span>Winner confirmed! Notification sent to {confirmDialog.booking.customer_email}</span>
        </div>
      );
      setConfirmDialog({ open: false, booking: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to confirm winner');
    }
  };

  const handleRejectEntry = async () => {
    if (!rejectDialog.booking) return;
    
    try {
      await rejectEntry.mutateAsync({ bookingId: rejectDialog.booking.id });
      toast.success(`Entry for ${rejectDialog.booking.customer_name} has been rejected`);
      setRejectDialog({ open: false, booking: null });
    } catch (error) {
      toast.error('Failed to reject entry');
    }
  };

  const handlePickRandomWinner = async () => {
    if (!randomPickDialog.slotId || randomPickDialog.entries.length === 0) return;

    try {
      const result = await pickRandomWinner.mutateAsync({
        slotId: randomPickDialog.slotId,
        entries: randomPickDialog.entries,
        winnersCount: 1,
        rejectOthers: true,
      });

      const winner = result.winners[0];
      
      // Show success with winner info
      toast.success(
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-medium">
            <Trophy className="h-4 w-4 text-amber-500" />
            Winner Selected!
          </div>
          <div className="text-sm">
            {winner.customer_name} ({winner.customer_email})
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            Notification sent to winner
          </div>
        </div>,
        { duration: 5000 }
      );

      // Optional: Open mailto link for manual follow-up
      // window.open(`mailto:${winner.customer_email}?subject=Congratulations! You Won the Lottery&body=Dear ${winner.customer_name},%0A%0AYou have been selected as a winner for ${randomPickDialog.slotName}!%0A%0AWe look forward to seeing you.`);

      setRandomPickDialog({ open: false, slotId: null, slotName: '', entries: [] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pick winner');
    }
  };

  // Group entries by slot
  const entriesBySlot = lotteryEntries?.reduce((acc, entry) => {
    if (!entry.availability_slots) return acc;
    const slotKey = entry.slot_id;
    if (!acc[slotKey]) {
      acc[slotKey] = {
        slot: entry.availability_slots,
        entries: [],
      };
    }
    acc[slotKey].entries.push(entry);
    return acc;
  }, {} as Record<string, { slot: NonNullable<Booking['availability_slots']>; entries: Booking[] }>) || {};

  if (isLoading) {
    return (
      <div className="admin-card">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading lottery entries...</span>
        </div>
      </div>
    );
  }

  const slotGroups = Object.values(entriesBySlot);

  return (
    <>
      <div className="admin-card">
        <div className="mb-6 flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Lottery Drawings</h2>
          {lotteryEntries && lotteryEntries.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {lotteryEntries.length} pending
            </Badge>
          )}
        </div>

        {slotGroups.length === 0 ? (
          <div className="py-8 text-center">
            <Ticket className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">No pending lottery entries</p>
          </div>
        ) : (
          <div className="space-y-6">
            {slotGroups.map(({ slot, entries }) => (
              <div key={slot.id} className="rounded-lg border border-border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{slot.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(slot.date), 'EEEE, MMM d')} at {formatTime(slot.time)}
                      {slot.end_time && ` - ${formatTime(slot.end_time)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {slot.total_tables - slot.booked_tables} spots left
                    </Badge>
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => setRandomPickDialog({ 
                        open: true, 
                        slotId: slot.id, 
                        slotName: slot.name,
                        entries 
                      })}
                      disabled={slot.booked_tables >= slot.total_tables || entries.length === 0}
                    >
                      <Dices className="mr-1.5 h-4 w-4" />
                      Pick Random Winner
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-md bg-muted/50 p-3 animate-fade-in"
                    >
                      <div>
                        <p className="font-medium">{entry.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{entry.customer_email}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {entry.party_size} {entry.party_size === 1 ? 'guest' : 'guests'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => setRejectDialog({ open: true, booking: entry })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setConfirmDialog({ open: true, booking: entry })}
                          disabled={slot.booked_tables >= slot.total_tables}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Select
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Single Winner Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, booking: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Lottery Winner</AlertDialogTitle>
            <AlertDialogDescription>
              This will confirm <strong>{confirmDialog.booking?.customer_name}</strong> as a winner and reserve their spot. 
              They will receive a notification at {confirmDialog.booking?.customer_email}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmWinner} disabled={confirmWinner.isPending}>
              {confirmWinner.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Confirm Winner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Entry Dialog */}
      <AlertDialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({ open: false, booking: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Lottery Entry</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{rejectDialog.booking?.customer_name}</strong> from the lottery. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRejectEntry} 
              disabled={rejectEntry.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectEntry.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <X className="mr-2 h-4 w-4" />
              )}
              Reject Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pick Random Winner Dialog */}
      <AlertDialog open={randomPickDialog.open} onOpenChange={(open) => !open && setRandomPickDialog({ open: false, slotId: null, slotName: '', entries: [] })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Dices className="h-5 w-5 text-amber-600" />
              Pick Random Winner
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Randomly select a winner from <strong>{randomPickDialog.entries.length}</strong> entries for <strong>{randomPickDialog.slotName}</strong>.
                </p>
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium text-foreground">What happens:</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    <li>• One entry will be randomly selected as the winner</li>
                    <li>• Winner's booking will be confirmed</li>
                    <li>• All other entries will be rejected</li>
                    <li>• Winner will be notified via email</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePickRandomWinner} 
              disabled={pickRandomWinner.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {pickRandomWinner.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trophy className="mr-2 h-4 w-4" />
              )}
              Pick Winner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
