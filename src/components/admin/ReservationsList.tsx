import { useState } from 'react';
import { format, isPast, parseISO } from 'date-fns';
import { CalendarCheck, CreditCard, Loader2, Users, History, Calendar } from 'lucide-react';
import { useOwnerBookings, useOwnerAllBookings } from '@/hooks/useOwnerBookings';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  const { data: allBookings, isLoading } = useOwnerAllBookings();
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

  const isEventPast = (dateStr: string) => {
    const eventDate = parseISO(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
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

  const validBookings = (allBookings?.filter(b => b.availability_slots) || []) as BookingWithSlot[];

  // Separate into upcoming and past
  const upcomingBookings = validBookings.filter(b => !isEventPast(b.availability_slots!.date));
  const pastBookings = validBookings.filter(b => isEventPast(b.availability_slots!.date));

  // Group bookings by slot
  const groupBookings = (bookingsList: BookingWithSlot[]): GroupedBookings[] => {
    const grouped = bookingsList.reduce<Record<string, GroupedBookings>>((acc, booking) => {
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

    return Object.values(grouped).sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const upcomingGrouped = groupBookings(upcomingBookings);
  const pastGrouped = groupBookings(pastBookings).reverse(); // Most recent first for past events

  const renderBookingsList = (groupedList: GroupedBookings[], isPast: boolean) => {
    if (groupedList.length === 0) {
      return (
        <div className="py-8 text-center">
          {isPast ? (
            <>
              <History className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-muted-foreground">No past events with reservations</p>
            </>
          ) : (
            <>
              <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-muted-foreground">No upcoming reservations for your events</p>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {groupedList.map((group) => (
          <div key={group.slotId} className="space-y-3">
            {/* Slot Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{group.slotName}</h3>
                    {isPast && (
                      <Badge variant="secondary" className="text-xs">
                        Past Event
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(group.date), 'MMM d, yyyy')} at {formatTime(group.time)}
                  </p>
                </div>
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
    );
  };

  return (
    <>
      <div className="admin-card">
        <h2 className="mb-6 text-xl font-semibold">Reservations for Your Events</h2>
        
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming ({upcomingGrouped.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Past Events ({pastGrouped.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="mt-4">
            {renderBookingsList(upcomingGrouped, false)}
          </TabsContent>
          <TabsContent value="past" className="mt-4">
            {renderBookingsList(pastGrouped, true)}
          </TabsContent>
        </Tabs>
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
