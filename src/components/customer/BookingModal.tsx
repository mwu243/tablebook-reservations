import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Check, Loader2, Shuffle, Ticket, PartyPopper } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvailabilitySlot } from '@/lib/types';
import { useBookSlot } from '@/hooks/useAvailabilitySlots';
import { useAuth } from '@/contexts/AuthContext';

interface BookingModalProps {
  slot: AvailabilitySlot | null;
  partySize: number;
  onClose: () => void;
}

export function BookingModal({ slot, partySize, onClose }: BookingModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; isLottery: boolean }>({
    open: false,
    isLottery: false,
  });
  const bookSlot = useBookSlot();

  // Pre-fill email from authenticated user
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user, email]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const isLottery = slot?.booking_mode === 'lottery';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot || !name.trim() || !email.trim()) return;

    try {
      await bookSlot.mutateAsync({
        slotId: slot.id,
        customerName: name.trim(),
        customerEmail: email.trim(),
        partySize,
        userId: user?.id,
        isLottery,
      });
      
      // Close the form modal first
      onClose();
      
      // Reset form
      setName('');
      setEmail('');
      
      // Show success dialog
      setSuccessDialog({ open: true, isLottery });
    } catch (error) {
      console.error('Booking failed:', error);
    }
  };

  const handleCloseSuccessDialog = () => {
    setSuccessDialog({ open: false, isLottery: false });
  };

  if (!slot) return null;

  return (
    <>
      <Dialog open={!!slot} onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {isLottery ? 'Enter Lottery' : 'Complete Your Reservation'}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 rounded-lg bg-muted p-4">
            <div className="mb-2 flex items-center gap-2">
              {isLottery ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  <Shuffle className="h-3 w-3" />
                  Lottery
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  <Ticket className="h-3 w-3" />
                  Instant Booking
                </span>
              )}
            </div>
            <p className="font-medium">{slot.name}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">
                {formatTime(slot.time)}
                {slot.end_time && ` – ${formatTime(slot.end_time)}`}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Party Size</span>
              <span className="font-medium">{partySize} {partySize === 1 ? 'Guest' : 'Guests'}</span>
            </div>
          </div>

          {isLottery && (
            <p className="text-sm text-muted-foreground">
              This is a lottery event. Submitting your details enters you for a chance to be selected. You will be notified by email if you win.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-accent hover:bg-accent/90"
                disabled={bookSlot.isPending}
              >
                {bookSlot.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isLottery ? 'Entering...' : 'Booking...'}
                  </>
                ) : isLottery ? (
                  <>
                    <Shuffle className="mr-2 h-4 w-4" />
                    Enter Lottery
                  </>
                ) : (
                  'Confirm Booking'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog - Shows after form closes */}
      <AlertDialog open={successDialog.open} onOpenChange={handleCloseSuccessDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              {successDialog.isLottery ? (
                <Shuffle className="h-8 w-8 text-success" />
              ) : (
                <PartyPopper className="h-8 w-8 text-success" />
              )}
            </div>
            <AlertDialogTitle className="text-xl">
              {successDialog.isLottery ? 'Fingers Crossed!' : 'Reservation Confirmed!'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {successDialog.isLottery
                ? 'You have been entered into the lottery. Winners will be notified via email.'
                : 'We look forward to seeing you.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <Button onClick={handleCloseSuccessDialog} className="min-w-32">
              Got it!
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
