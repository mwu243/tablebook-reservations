import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, Loader2, Pencil, Trash2, Users } from 'lucide-react';
import { useUserOwnedSlots } from '@/hooks/useUserOwnedSlots';
import { useDeleteAvailabilitySlot } from '@/hooks/useAvailabilitySlots';
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
import { AvailabilitySlot } from '@/lib/types';
import { EditSlotModal } from './EditSlotModal';
import { parseLocalDate } from '@/lib/utils';

export function SlotsManager() {
  const { data: slots, isLoading } = useUserOwnedSlots();
  const deleteSlot = useDeleteAvailabilitySlot();
  
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    slot: AvailabilitySlot | null 
  }>({
    open: false,
    slot: null,
  });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    slot: AvailabilitySlot | null;
  }>({
    open: false,
    slot: null,
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleDeleteSlot = async () => {
    if (!deleteDialog.slot) return;

    try {
      await deleteSlot.mutateAsync(deleteDialog.slot.id);
      toast.success('Slot and associated bookings cancelled.');
      setDeleteDialog({ open: false, slot: null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete slot');
    }
  };

  if (isLoading) {
    return (
      <div className="admin-card">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading availability slots...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="admin-card">
        <div className="mb-6 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Your Upcoming Slots</h2>
          {slots && slots.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {slots.length} slots
            </Badge>
          )}
        </div>

        {!slots || slots.length === 0 ? (
          <div className="py-8 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">You haven't created any availability slots yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50 animate-fade-in"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{slot.name}</p>
                    <Badge variant={slot.booking_mode === 'lottery' ? 'default' : 'secondary'}>
                      {slot.booking_mode === 'lottery' ? 'Lottery' : 'FCFS'}
                    </Badge>
                    {slot.waitlist_enabled && (
                      <Badge variant="outline" className="text-xs">
                        Waitlist
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(parseLocalDate(slot.date), 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(slot.time)}
                      {slot.end_time && ` - ${formatTime(slot.end_time)}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <p className="flex items-center justify-end gap-1 text-sm font-medium">
                      <Users className="h-3.5 w-3.5" />
                      {slot.booked_tables}/{slot.total_tables} booked
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditDialog({ open: true, slot })}
                    title="Edit event"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteDialog({ open: true, slot })}
                    title="Delete event"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Slot Modal */}
      <EditSlotModal
        open={editDialog.open}
        onOpenChange={(open) => !open && setEditDialog({ open: false, slot: null })}
        slot={editDialog.slot}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, slot: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this time slot?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently remove the{' '}
                  <strong>{deleteDialog.slot && formatTime(deleteDialog.slot.time)}</strong> slot on{' '}
                  <strong>
                    {deleteDialog.slot && format(parseLocalDate(deleteDialog.slot.date), 'MMMM d, yyyy')}
                  </strong>.
                </p>
                {deleteDialog.slot && deleteDialog.slot.booked_tables > 0 && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <strong>Warning:</strong> This slot has {deleteDialog.slot.booked_tables} existing{' '}
                    {deleteDialog.slot.booked_tables === 1 ? 'booking' : 'bookings'} that will be cancelled.
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  If there are any existing bookings or lottery entries, they will be cancelled.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Slot</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSlot}
              disabled={deleteSlot.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSlot.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Yes, Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
