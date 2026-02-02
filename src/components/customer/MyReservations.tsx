import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarCheck, Loader2, Ticket, Shuffle, Clock, X, Download } from 'lucide-react';
import { useUserBookings } from '@/hooks/useUserBookings';
import { useCancelBooking, useUserWaitlistEntries, useLeaveWaitlist } from '@/hooks/useWaitlist';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from '@/hooks/use-toast';
import { downloadICSFile } from '@/lib/icsGenerator';

export function MyReservations() {
  const { data: bookings, isLoading: bookingsLoading } = useUserBookings();
  const { data: waitlistEntries, isLoading: waitlistLoading } = useUserWaitlistEntries();
  const cancelBooking = useCancelBooking();
  const leaveWaitlist = useLeaveWaitlist();
  
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; bookingId: string | null; type: 'booking' | 'waitlist' }>({
    open: false,
    bookingId: null,
    type: 'booking',
  });

  const isLoading = bookingsLoading || waitlistLoading;

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

  const handleCancelBooking = async () => {
    if (!cancelDialog.bookingId) return;

    try {
      if (cancelDialog.type === 'booking') {
        await cancelBooking.mutateAsync(cancelDialog.bookingId);
        toast({
          title: 'Reservation Cancelled',
          description: 'Your reservation has been cancelled successfully.',
        });
      } else {
        await leaveWaitlist.mutateAsync(cancelDialog.bookingId);
        toast({
          title: 'Left Waitlist',
          description: 'You have been removed from the waitlist.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCancelDialog({ open: false, bookingId: null, type: 'booking' });
    }
  };

  const handleAddToCalendar = (booking: NonNullable<typeof bookings>[number]) => {
    if (!booking.availability_slots) return;
    
    downloadICSFile({
      id: booking.id,
      title: booking.availability_slots.name || 'SGD Reservation',
      date: booking.availability_slots.date,
      startTime: booking.availability_slots.time,
      endTime: booking.availability_slots.end_time,
      description: booking.availability_slots.description || undefined,
      partySize: booking.party_size,
    });

    toast({
      title: 'Calendar Event Downloaded',
      description: 'Open the .ics file to add it to your calendar.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasNoData = (!bookings || bookings.length === 0) && (!waitlistEntries || waitlistEntries.length === 0);

  if (hasNoData) {
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
  const upcomingBookings = bookings?.filter(
    b => b.availability_slots && b.availability_slots.date >= today && b.status !== 'cancelled'
  ) || [];
  const pastBookings = bookings?.filter(
    b => b.availability_slots && b.availability_slots.date < today
  ) || [];

  // Filter upcoming waitlist entries
  const upcomingWaitlist = waitlistEntries?.filter(
    w => w.availability_slots && w.availability_slots.date >= today
  ) || [];

  return (
    <div className="space-y-6">
      {/* Upcoming Reservations */}
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
                  
                  {/* Action Buttons */}
                  <div className="mt-3 flex gap-2">
                    {booking.status === 'confirmed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAddToCalendar(booking)}
                      >
                        <Download className="mr-1.5 h-4 w-4" />
                        Add to Calendar
                      </Button>
                    )}
                    {(booking.status === 'confirmed' || booking.status === 'pending_lottery') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={booking.status === 'confirmed' ? 'flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground' : 'w-full text-destructive hover:bg-destructive hover:text-destructive-foreground'}
                        onClick={() => setCancelDialog({ open: true, bookingId: booking.id, type: 'booking' })}
                      >
                        <X className="mr-1.5 h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Waitlist Entries */}
      {upcomingWaitlist.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Waitlist</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {upcomingWaitlist.map((entry) => (
              <Card key={entry.id} className="overflow-hidden border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {entry.availability_slots?.name || 'Event'}
                    </CardTitle>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      #{entry.position} on waitlist
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarCheck className="h-4 w-4" />
                    {entry.availability_slots && (
                      <span>
                        {format(new Date(entry.availability_slots.date), 'EEEE, MMMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {entry.availability_slots && (
                      <span>
                        {formatTime(entry.availability_slots.time)}
                        {entry.availability_slots.end_time && 
                          ` – ${formatTime(entry.availability_slots.end_time)}`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You'll be notified if a spot opens up
                  </p>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => setCancelDialog({ open: true, bookingId: entry.id, type: 'waitlist' })}
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Leave Waitlist
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past Reservations */}
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ ...cancelDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelDialog.type === 'booking' ? 'Cancel Reservation?' : 'Leave Waitlist?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelDialog.type === 'booking' 
                ? 'Are you sure you want to cancel this reservation? This action cannot be undone.'
                : 'Are you sure you want to leave the waitlist? You will lose your spot.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelBooking.isPending || leaveWaitlist.isPending}
            >
              {(cancelBooking.isPending || leaveWaitlist.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                cancelDialog.type === 'booking' ? 'Yes, cancel reservation' : 'Yes, leave waitlist'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
