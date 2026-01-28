import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Loader2, Shuffle, Ticket, PartyPopper, Users, AlertCircle, LogIn } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AvailabilitySlot } from '@/lib/types';
import { useBookSlot } from '@/hooks/useAvailabilitySlots';
import { useJoinWaitlist } from '@/hooks/useWaitlist';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSlotBooking } from '@/hooks/useUserSlotBooking';

interface BookingModalProps {
  slot: AvailabilitySlot | null;
  partySize: number;
  onClose: () => void;
  isWaitlist?: boolean;
}

export function BookingModal({ slot, partySize, onClose, isWaitlist = false }: BookingModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; type: 'booking' | 'lottery' | 'waitlist' }>({
    open: false,
    type: 'booking',
  });
  const bookSlot = useBookSlot();
  const joinWaitlist = useJoinWaitlist();
  const { data: existingBooking, isLoading: checkingBooking } = useUserSlotBooking(slot?.id ?? null);
  
  const hasExistingBooking = !!existingBooking;

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
    if (!slot || !name.trim() || !email.trim() || !user || hasExistingBooking) return;

    try {
      if (isWaitlist) {
        await joinWaitlist.mutateAsync({
          slotId: slot.id,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim() || undefined,
          partySize,
          userId: user.id,
        });
        
        onClose();
        setName('');
        setEmail('');
        setPhone('');
        setSuccessDialog({ open: true, type: 'waitlist' });
      } else {
        await bookSlot.mutateAsync({
          slotId: slot.id,
          customerName: name.trim(),
          customerEmail: email.trim(),
          partySize,
          userId: user.id,
          isLottery,
        });
        
        onClose();
        setName('');
        setEmail('');
        setPhone('');
        setSuccessDialog({ open: true, type: isLottery ? 'lottery' : 'booking' });
      }
    } catch (error) {
      console.error('Booking failed:', error);
    }
  };

  const handleCloseSuccessDialog = () => {
    setSuccessDialog({ open: false, type: 'booking' });
  };

  if (!slot) return null;

  const isPending = bookSlot.isPending || joinWaitlist.isPending || checkingBooking;

  // Show sign-in prompt if user is not authenticated
  if (!user) {
    return (
      <Dialog open={!!slot} onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Sign In Required</DialogTitle>
            <DialogDescription>
              Please sign in or create an account to book this experience.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 rounded-lg bg-muted p-4">
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

          <div className="mt-4 space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                onClose();
                navigate('/auth');
              }}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In to Book
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={!!slot} onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {isWaitlist ? 'Join Waitlist' : isLottery ? 'Enter Lottery' : 'Complete Your Reservation'}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 rounded-lg bg-muted p-4">
            <div className="mb-2 flex items-center gap-2">
              {isWaitlist ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  <Users className="h-3 w-3" />
                  Waitlist
                </span>
              ) : isLottery ? (
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

          {hasExistingBooking ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You already have a reservation for this event. Each person can only book once per event.
              </AlertDescription>
            </Alert>
          ) : isWaitlist ? (
            <p className="text-sm text-muted-foreground">
              This event is currently full. Join the waitlist and you'll be notified if a spot opens up.
            </p>
          ) : isLottery ? (
            <p className="text-sm text-muted-foreground">
              This is a lottery event. Submitting your details enters you for a chance to be selected. You will be notified by email if you win.
            </p>
          ) : null}

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
            {isWaitlist && (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
                <p className="text-xs text-muted-foreground">
                  For text notifications when a spot opens up
                </p>
              </div>
            )}
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
                disabled={isPending || hasExistingBooking}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isWaitlist ? 'Joining...' : isLottery ? 'Entering...' : 'Booking...'}
                  </>
                ) : isWaitlist ? (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Join Waitlist
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
              {successDialog.type === 'waitlist' ? (
                <Users className="h-8 w-8 text-success" />
              ) : successDialog.type === 'lottery' ? (
                <Shuffle className="h-8 w-8 text-success" />
              ) : (
                <PartyPopper className="h-8 w-8 text-success" />
              )}
            </div>
            <AlertDialogTitle className="text-xl">
              {successDialog.type === 'waitlist' 
                ? 'You\'re on the Waitlist!' 
                : successDialog.type === 'lottery' 
                  ? 'Fingers Crossed!' 
                  : 'Reservation Confirmed!'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {successDialog.type === 'waitlist'
                ? 'We\'ll notify you by email if a spot opens up.'
                : successDialog.type === 'lottery'
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
