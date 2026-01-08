import { useState } from 'react';
import { format } from 'date-fns';
import { Check, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvailabilitySlot } from '@/lib/types';
import { useBookSlot } from '@/hooks/useAvailabilitySlots';

interface BookingModalProps {
  slot: AvailabilitySlot | null;
  partySize: number;
  onClose: () => void;
}

export function BookingModal({ slot, partySize, onClose }: BookingModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const bookSlot = useBookSlot();

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot || !name.trim() || !email.trim()) return;

    try {
      await bookSlot.mutateAsync({
        slotId: slot.id,
        customerName: name.trim(),
        customerEmail: email.trim(),
        partySize,
      });
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
        setShowSuccess(false);
        setName('');
        setEmail('');
      }, 2000);
    } catch (error) {
      console.error('Booking failed:', error);
    }
  };

  if (!slot) return null;

  return (
    <Dialog open={!!slot} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        {showSuccess ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <Check className="h-8 w-8 text-success animate-check" />
            </div>
            <h3 className="text-xl font-semibold">Reservation Confirmed!</h3>
            <p className="mt-2 text-muted-foreground">
              We've sent a confirmation to {email}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Complete Your Reservation</DialogTitle>
            </DialogHeader>

            <div className="mt-2 rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{formatTime(slot.time)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Party Size</span>
                <span className="font-medium">{partySize} {partySize === 1 ? 'Guest' : 'Guests'}</span>
              </div>
            </div>

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
                      Booking...
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
