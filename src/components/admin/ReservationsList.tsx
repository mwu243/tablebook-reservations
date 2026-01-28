import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarCheck, CreditCard, Loader2, Users } from 'lucide-react';
import { useOwnerBookings } from '@/hooks/useOwnerBookings';
import { Button } from '@/components/ui/button';
import { ParticipantPaymentModal } from './ParticipantPaymentModal';

interface BookingWithSlot {
  id: string;
  customer_name: string;
  customer_email: string;
  party_size: number;
  slot_id: string;
  availability_slots: {
    id: string;
    date: string;
    time: string;
    name: string;
  } | null;
}

interface GroupedBookings {
  slotId: string;
  slotName: string;
  date: string;
  time: string;
  bookings: BookingWithSlot[];
}

export function ReservationsList() {
  const { data: bookings, isLoading } = useOwnerBookings();
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    slotId: string | null;
    slotName: string;
  }>({
    open: false,
    slotId: null,
    slotName: '',
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return (
      <div className="admin-card">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading reservations...</span>
        </div>
      </div>
    );
  }

  const validBookings = (bookings?.filter(b => b.availability_slots) || []) as BookingWithSlot[];

  // Group bookings by slot
  const groupedBySlot = validBookings.reduce<Record<string, GroupedBookings>>((acc, booking) => {
    const slotId = booking.slot_id;
    if (!acc[slotId]) {
      acc[slotId] = {
        slotId,
        slotName: booking.availability_slots!.name,
        date: booking.availability_slots!.date,
        time: booking.availability_slots!.time,
        bookings: [],
      };
    }
    acc[slotId].bookings.push(booking);
    return acc;
  }, {});

  const groupedList = Object.values(groupedBySlot).sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <>
      <div className="admin-card">
        <h2 className="mb-6 text-xl font-semibold">Reservations for Your Events</h2>
        
        {groupedList.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">No confirmed reservations for your events</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedList.map((group) => (
              <div key={group.slotId} className="space-y-3">
                {/* Slot Header */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="font-medium">{group.slotName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(group.date), 'MMM d, yyyy')} at {formatTime(group.time)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentModal({
                      open: true,
                      slotId: group.slotId,
                      slotName: group.slotName,
                    })}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Payment Info
                  </Button>
                </div>

                {/* Bookings List */}
                <div className="space-y-2 pl-4">
                  {group.bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 animate-fade-in"
                    >
                      <div>
                        <p className="font-medium">{booking.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.customer_email}</p>
                      </div>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {booking.party_size} {booking.party_size === 1 ? 'guest' : 'guests'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ParticipantPaymentModal
        open={paymentModal.open}
        onOpenChange={(open) => !open && setPaymentModal({ open: false, slotId: null, slotName: '' })}
        slotId={paymentModal.slotId}
        slotName={paymentModal.slotName}
      />
    </>
  );
}
