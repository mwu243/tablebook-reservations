import { format } from 'date-fns';
import { Calendar, Clock, Users, Ticket, Shuffle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { UpcomingEventWithHost } from '@/hooks/useUpcomingEventsWithHosts';

interface EventCardProps {
  event: UpcomingEventWithHost;
  onBookClick: (event: UpcomingEventWithHost) => void;
}

export function EventCard({ event, onBookClick }: EventCardProps) {
  const spotsLeft = event.total_tables - event.booked_tables;
  const isSoldOut = spotsLeft <= 0;
  const isLottery = event.booking_mode === 'lottery';

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getBookingBadge = () => {
    if (isSoldOut && event.waitlist_enabled) {
      return (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
          <AlertCircle className="mr-1 h-3 w-3" />
          Waitlist
        </Badge>
      );
    }
    if (isSoldOut) {
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          Sold Out
        </Badge>
      );
    }
    if (isLottery) {
      return (
        <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700">
          <Shuffle className="mr-1 h-3 w-3" />
          Lottery
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
        <Ticket className="mr-1 h-3 w-3" />
        Instant
      </Badge>
    );
  };

  const getButtonText = () => {
    if (isSoldOut && event.waitlist_enabled) return 'Join Waitlist';
    if (isSoldOut) return 'Sold Out';
    if (isLottery) return 'Enter Lottery';
    return 'Book Now';
  };

  return (
    <Card className="min-w-[280px] max-w-[300px] flex-shrink-0 transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold text-foreground">{event.name}</h3>
          {getBookingBadge()}
        </div>

        {event.host_name && (
          <p className="mb-2 text-sm text-muted-foreground">
            Hosted by <span className="font-medium text-foreground">{event.host_name}</span>
          </p>
        )}

        <div className="mb-3 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(event.date), 'EEE, MMM d')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              {formatTime(event.time)}
              {event.end_time && ` – ${formatTime(event.end_time)}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {isSoldOut ? (
              <span className="text-muted-foreground">No spots left</span>
            ) : (
              <span className="text-green-600 font-medium">
                {spotsLeft} of {event.total_tables} spots left
              </span>
            )}
          </div>
        </div>

        <Button
          size="sm"
          className="w-full"
          variant={isSoldOut && !event.waitlist_enabled ? 'secondary' : 'default'}
          disabled={isSoldOut && !event.waitlist_enabled}
          onClick={() => onBookClick(event)}
        >
          {getButtonText()}
        </Button>
      </CardContent>
    </Card>
  );
}
