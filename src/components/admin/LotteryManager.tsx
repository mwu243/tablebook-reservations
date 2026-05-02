import { useState } from 'react';
import { format } from 'date-fns';
import { Check, Dices, Loader2, Mail, Ticket, Trophy, Users, X } from 'lucide-react';
import { useOwnerLotteryBookings } from '@/hooks/useOwnerBookings';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LotteryManager() {
  const { data: lotteryEntries, isLoading } = useOwnerLotteryBookings();
  const queryClient = useQueryClient();
  
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
    winnersCount: number;
    availableSpots: number;
  }>({
    open: false,
    slotId: null,
    slotName: '',
    entries: [],
    winnersCount: 1,
    availableSpots: 1,
  });
  const [selectedBySlot, setSelectedBySlot] = useState<Record<string, Set<string>>>({});
  const [confirmSelectedDialog, setConfirmSelectedDialog] = useState<{
    open: boolean;
    slotId: string | null;
    slotName: string;
    bookings: Booking[];
  }>({ open: false, slotId: null, slotName: '', bookings: [] });

  const toggleSelected = (slotId: string, bookingId: string) => {
    setSelectedBySlot((prev) => {
      const next = new Set(prev[slotId] ?? []);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return { ...prev, [slotId]: next };
    });
  };

  const clearSelected = (slotId: string) => {
    setSelectedBySlot((prev) => ({ ...prev, [slotId]: new Set() }));
  };

  // Confirm multiple winners mutation
  const confirmMultipleWinners = useMutation({
    mutationFn: async ({ bookingIds, slotId }: { bookingIds: string[]; slotId: string }) => {
      if (bookingIds.length === 0) throw new Error('No entries selected');

      const { data: slot, error: slotError } = await supabase
        .from('availability_slots')
        .select('booked_tables, total_tables')
        .eq('id', slotId)
        .single();
      if (slotError) throw slotError;
      if (!slot) throw new Error('Slot not found');

      const availableSpots = slot.total_tables - slot.booked_tables;
      if (bookingIds.length > availableSpots) {
        throw new Error(`Only ${availableSpots} spot(s) available`);
      }

      for (const bId of bookingIds) {
        const { error } = await supabase
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', bId);
        if (error) throw error;
      }

      const { error: updateError } = await supabase
        .rpc('increment_booked_tables', { slot_id: slotId, amount: bookingIds.length });
      if (updateError) throw updateError;

      return { count: bookingIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-lottery-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['user-owned-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
    },
  });

  // Confirm winner mutation
  const confirmWinner = useMutation({
    mutationFn: async ({ bookingId, slotId }: { bookingId: string; slotId: string }) => {
      // Update booking status to confirmed
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Use RPC to increment booked_tables with validation
      const { error: updateError } = await supabase
        .rpc('increment_booked_tables', { slot_id: slotId });

      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-lottery-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['user-owned-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
    },
  });

  // Reject entry mutation
  const rejectEntry = useMutation({
    mutationFn: async ({ bookingId }: { bookingId: string }) => {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-lottery-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
    },
  });

  // Pick random winner mutation
  const pickRandomWinner = useMutation({
    mutationFn: async ({ 
      slotId, 
      entries, 
      winnersCount = 1,
      rejectOthers = true 
    }: { 
      slotId: string; 
      entries: Booking[]; 
      winnersCount?: number;
      rejectOthers?: boolean;
    }) => {
      if (entries.length === 0) {
        throw new Error('No entries to pick from');
      }

      // Get current slot info
      const { data: slot, error: slotError } = await supabase
        .from('availability_slots')
        .select('booked_tables, total_tables')
        .eq('id', slotId)
        .single();

      if (slotError) throw slotError;
      if (!slot) throw new Error('Slot not found');

      const availableSpots = slot.total_tables - slot.booked_tables;
      const actualWinnersCount = Math.min(winnersCount, entries.length, availableSpots);

      if (actualWinnersCount <= 0) {
        throw new Error('No spots available for winners');
      }

      // Shuffle and pick winners
      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, actualWinnersCount);
      const losers = shuffled.slice(actualWinnersCount);

      // Update winners to confirmed (RLS allows slot owners to update bookings)
      const winnerIds = winners.map(w => w.id);
      for (const wId of winnerIds) {
        const { error } = await supabase
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', wId);
        if (error) throw error;
      }

      // Optionally reject others
      if (rejectOthers && losers.length > 0) {
        for (const l of losers) {
          const { error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', l.id);
          if (error) throw error;
        }
      }

      // Use RPC to increment booked_tables with validation
      const { error: updateError } = await supabase
        .rpc('increment_booked_tables', { slot_id: slotId, amount: actualWinnersCount });

      if (updateError) throw updateError;

      return { 
        winners, 
        rejected: rejectOthers ? losers : [],
        winnersCount: actualWinnersCount 
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-lottery-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['user-owned-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
    },
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
        winnersCount: randomPickDialog.winnersCount,
        rejectOthers: true,
      });

      toast.success(
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-medium">
            <Trophy className="h-4 w-4 text-amber-500" />
            {result.winnersCount} Winner{result.winnersCount === 1 ? '' : 's'} Selected!
          </div>
          <div className="text-sm">
            {result.winners.map((w) => w.customer_name).join(', ')}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            Notifications sent
          </div>
        </div>,
        { duration: 5000 }
      );

      setRandomPickDialog({ open: false, slotId: null, slotName: '', entries: [], winnersCount: 1, availableSpots: 1 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pick winner');
    }
  };

  const handleConfirmSelected = async () => {
    if (!confirmSelectedDialog.slotId || confirmSelectedDialog.bookings.length === 0) return;
    try {
      const result = await confirmMultipleWinners.mutateAsync({
        bookingIds: confirmSelectedDialog.bookings.map((b) => b.id),
        slotId: confirmSelectedDialog.slotId,
      });
      toast.success(
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span>{result.count} winner{result.count === 1 ? '' : 's'} confirmed!</span>
        </div>
      );
      clearSelected(confirmSelectedDialog.slotId);
      setConfirmSelectedDialog({ open: false, slotId: null, slotName: '', bookings: [] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to confirm winners');
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
          <h2 className="text-xl font-semibold">Your Lottery Drawings</h2>
          {lotteryEntries && lotteryEntries.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {lotteryEntries.length} pending
            </Badge>
          )}
        </div>

        {slotGroups.length === 0 ? (
          <div className="py-8 text-center">
            <Ticket className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">No pending lottery entries for your events</p>
          </div>
        ) : (
          <div className="space-y-6">
            {slotGroups.map(({ slot, entries }) => {
              const availableSpots = slot.total_tables - slot.booked_tables;
              const selectedSet = selectedBySlot[slot.id] ?? new Set<string>();
              const selectedCount = selectedSet.size;
              const selectedBookings = entries.filter((e) => selectedSet.has(e.id));
              const allSelected = entries.length > 0 && entries.every((e) => selectedSet.has(e.id));
              const someSelected = selectedCount > 0 && !allSelected;
              const toggleAll = () => {
                setSelectedBySlot((prev) => ({
                  ...prev,
                  [slot.id]: allSelected ? new Set() : new Set(entries.map((e) => e.id)),
                }));
              };

              return (
              <div key={slot.id} className="rounded-lg border border-border p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{slot.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(parseLocalDate(slot.date), 'EEEE, MMM d')} at {formatTime(slot.time)}
                      {slot.end_time && ` - ${formatTime(slot.end_time)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {availableSpots} spots left
                    </Badge>
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => setRandomPickDialog({
                        open: true,
                        slotId: slot.id,
                        slotName: slot.name,
                        entries,
                        winnersCount: Math.min(1, availableSpots),
                        availableSpots,
                      })}
                      disabled={availableSpots <= 0 || entries.length === 0}
                    >
                      <Dices className="mr-1.5 h-4 w-4" />
                      Pick Random Winner{availableSpots > 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>

                {entries.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleAll}
                      />
                      <span className="text-muted-foreground">
                        {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
                      </span>
                    </label>
                    {selectedCount > 0 && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => clearSelected(slot.id)}>
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setConfirmSelectedDialog({
                            open: true,
                            slotId: slot.id,
                            slotName: slot.name,
                            bookings: selectedBookings,
                          })}
                          disabled={selectedCount > availableSpots}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Confirm {selectedCount} Winner{selectedCount === 1 ? '' : 's'}
                          {selectedCount > availableSpots && ` (only ${availableSpots} spots)`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {entries.map((entry) => {
                    const isSelected = selectedSet.has(entry.id);
                    return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-md bg-muted/50 p-3 animate-fade-in"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelected(slot.id, entry.id)}
                          disabled={availableSpots <= 0}
                        />
                        <div>
                          <p className="font-medium">{entry.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{entry.customer_email}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {entry.party_size} {entry.party_size === 1 ? 'guest' : 'guests'}
                          </p>
                        </div>
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
                          disabled={availableSpots <= 0}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Select
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
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
