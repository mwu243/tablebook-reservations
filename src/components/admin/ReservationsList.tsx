import { format } from 'date-fns';
import { CalendarCheck, Loader2, Users } from 'lucide-react';
import { useOwnerBookings } from '@/hooks/useOwnerBookings';

export function ReservationsList() {
  const { data: bookings, isLoading } = useOwnerBookings();

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

  const validBookings = bookings?.filter(b => b.availability_slots) || [];

  return (
    <div className="admin-card">
      <h2 className="mb-6 text-xl font-semibold">Reservations for Your Events</h2>
      
      {validBookings.length === 0 ? (
        <div className="py-8 text-center">
          <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">No confirmed reservations for your events</p>
        </div>
      ) : (
        <div className="space-y-3">
          {validBookings.map((booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50 animate-fade-in"
            >
              <div>
                <p className="font-medium">{booking.customer_name}</p>
                <p className="text-sm text-muted-foreground">{booking.customer_email}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  {format(new Date(booking.availability_slots!.date), 'MMM d')} at{' '}
                  {formatTime(booking.availability_slots!.time)}
                </p>
                <p className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {booking.party_size} {booking.party_size === 1 ? 'guest' : 'guests'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
