import { format } from 'date-fns';
import { CalendarCheck, Loader2, Ticket, Shuffle, Clock } from 'lucide-react';
import { useUserBookings } from '@/hooks/useUserBookings';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MyReservations() {
  const { data: bookings, isLoading } = useUserBookings();

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Confirmed</Badge>;
      case 'pending_lottery':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending Lottery</Badge>;
      case 'won':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Won</Badge>;
      case 'lost':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Not Selected</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CalendarCheck className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No Reservations Yet</h3>
        <p className="mt-2 text-muted-foreground">
          Your upcoming reservations will appear here
        </p>
      </div>
    );
  }

  // Separate upcoming and past reservations
  const today = new Date().toISOString().split('T')[0];
  const upcomingBookings = bookings.filter(
    b => b.availability_slots && b.availability_slots.date >= today
  );
  const pastBookings = bookings.filter(
    b => b.availability_slots && b.availability_slots.date < today
  );

  return (
    <div className="space-y-6">
      {upcomingBookings.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Upcoming</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {upcomingBookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {booking.availability_slots?.name || 'Reservation'}
                    </CardTitle>
                    {getStatusBadge(booking.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarCheck className="h-4 w-4" />
                    {booking.availability_slots && (
                      <span>
                        {format(new Date(booking.availability_slots.date), 'EEEE, MMMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {booking.availability_slots && (
                      <span>
                        {formatTime(booking.availability_slots.time)}
                        {booking.availability_slots.end_time && 
                          ` – ${formatTime(booking.availability_slots.end_time)}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.availability_slots?.booking_mode === 'lottery' ? (
                      <Shuffle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Ticket className="h-4 w-4 text-green-600" />
                    )}
                    <span className="text-muted-foreground">
                      Party of {booking.party_size}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pastBookings.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-muted-foreground">Past</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {pastBookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden opacity-60">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {booking.availability_slots?.name || 'Reservation'}
                    </CardTitle>
                    {getStatusBadge(booking.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarCheck className="h-4 w-4" />
                    {booking.availability_slots && (
                      <span>
                        {format(new Date(booking.availability_slots.date), 'MMMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {booking.availability_slots && (
                      <span>{formatTime(booking.availability_slots.time)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
