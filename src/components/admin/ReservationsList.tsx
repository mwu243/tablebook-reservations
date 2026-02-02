import { useState } from 'react';
import { format, isPast, parseISO } from 'date-fns';
import { CalendarCheck, CreditCard, Loader2, Users, History, Calendar, Clock, UtensilsCrossed } from 'lucide-react';
import { useOwnerAllBookings, useOwnerWaitlistEntries } from '@/hooks/useOwnerBookings';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ParticipantPaymentModal } from './ParticipantPaymentModal';
import type { Booking, WaitlistEntry } from '@/lib/types';

interface BookingWithSlot {
  id: string;
  customer_name: string;
  customer_email: string;
  party_size: number;
  slot_id: string;
  dietary_restrictions?: string | null;
  availability_slots: {
    id: string;
    date: string;
    time: string;
    name: string;
    waitlist_enabled?: boolean;
  } | null;
}

interface WaitlistWithSlot {
  id: string;
  customer_name: string;
  customer_email: string;
  party_size: number;
  slot_id: string;
  position: number;
  dietary_restrictions?: string | null;
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
  waitlistEnabled: boolean;
  bookings: BookingWithSlot[];
  waitlist: WaitlistWithSlot[];
}

export function ReservationsList() {
  const { data: allBookings, isLoading: loadingBookings } = useOwnerAllBookings();
  const { data: allWaitlist, isLoading: loadingWaitlist } = useOwnerWaitlistEntries();
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

  const isLoading = loadingBookings || loadingWaitlist;

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
  const validWaitlist = (allWaitlist?.filter(w => w.availability_slots) || []) as WaitlistWithSlot[];

  // Separate into upcoming and past
  const upcomingBookings = validBookings.filter(b => !isEventPast(b.availability_slots!.date));
  const pastBookings = validBookings.filter(b => isEventPast(b.availability_slots!.date));
  const upcomingWaitlist = validWaitlist.filter(w => !isEventPast(w.availability_slots!.date));

  // Group bookings by slot
  const groupBookings = (bookingsList: BookingWithSlot[], waitlistList: WaitlistWithSlot[]): GroupedBookings[] => {
    const grouped: Record<string, GroupedBookings> = {};

    bookingsList.forEach((booking) => {
      const slotId = booking.slot_id;
      if (!grouped[slotId]) {
        grouped[slotId] = {
          slotId,
          slotName: booking.availability_slots!.name,
          date: booking.availability_slots!.date,
          time: booking.availability_slots!.time,
          waitlistEnabled: booking.availability_slots!.waitlist_enabled ?? false,
          bookings: [],
          waitlist: [],
        };
      }
      grouped[slotId].bookings.push(booking);
    });

    waitlistList.forEach((entry) => {
      const slotId = entry.slot_id;
      if (!grouped[slotId]) {
        grouped[slotId] = {
          slotId,
          slotName: entry.availability_slots!.name,
          date: entry.availability_slots!.date,
          time: entry.availability_slots!.time,
          waitlistEnabled: true,
          bookings: [],
          waitlist: [],
        };
      }
      grouped[slotId].waitlist.push(entry);
    });

    return Object.values(grouped).sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const upcomingGrouped = groupBookings(upcomingBookings, upcomingWaitlist);
  const pastGrouped = groupBookings(pastBookings, []).reverse();

  const renderBookingItem = (booking: BookingWithSlot) => (
    <div
      key={booking.id}
      className="flex items-start justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 animate-fade-in"
    >
      <div className="space-y-1">
        <p className="font-medium">{booking.customer_name}</p>
        <p className="text-sm text-muted-foreground">{booking.customer_email}</p>
        {booking.dietary_restrictions && (
          <p className="flex items-center gap-1 text-sm text-amber-600">
            <UtensilsCrossed className="h-3 w-3" />
            {booking.dietary_restrictions}
          </p>
        )}
      </div>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {booking.party_size} {booking.party_size === 1 ? 'guest' : 'guests'}
      </p>
    </div>
  );

  const renderWaitlistItem = (entry: WaitlistWithSlot) => (
    <div
      key={entry.id}
      className="flex items-start justify-between rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 transition-colors hover:bg-amber-50 animate-fade-in"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
            #{entry.position}
          </Badge>
          <p className="font-medium">{entry.customer_name}</p>
        </div>
        <p className="text-sm text-muted-foreground">{entry.customer_email}</p>
        {entry.dietary_restrictions && (
          <p className="flex items-center gap-1 text-sm text-amber-600">
            <UtensilsCrossed className="h-3 w-3" />
            {entry.dietary_restrictions}
          </p>
        )}
      </div>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {entry.party_size} {entry.party_size === 1 ? 'guest' : 'guests'}
      </p>
    </div>
  );

  const GroupedSlotCard = ({ group, isPast }: { group: GroupedBookings; isPast: boolean }) => {
    const [activeSubTab, setActiveSubTab] = useState<'confirmed' | 'waitlist'>('confirmed');

    return (
      <div className="space-y-3">
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

        {/* Sub-tabs for Confirmed vs Waitlist */}
        {group.waitlistEnabled && group.waitlist.length > 0 ? (
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'confirmed' | 'waitlist')} className="w-full">
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="confirmed" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Confirmed ({group.bookings.length})
              </TabsTrigger>
              <TabsTrigger value="waitlist" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Waitlist ({group.waitlist.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="confirmed" className="mt-3 space-y-2">
              {group.bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No confirmed guests yet</p>
              ) : (
                group.bookings.map(renderBookingItem)
              )}
            </TabsContent>
            <TabsContent value="waitlist" className="mt-3 space-y-2">
              {group.waitlist.map(renderWaitlistItem)}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-2 pl-4">
            {group.bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No guests yet</p>
            ) : (
              group.bookings.map(renderBookingItem)
            )}
          </div>
        )}
      </div>
    );
  };

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
          <GroupedSlotCard key={group.slotId} group={group} isPast={isPast} />
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