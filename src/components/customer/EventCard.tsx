import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, Users, Ticket, Shuffle, AlertCircle, MapPin, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UpcomingEventWithHost } from '@/hooks/useUpcomingEventsWithHosts';
import { parseLocalDate } from '@/lib/utils';

interface EventCardProps {
  event: UpcomingEventWithHost;
  onBookClick: (event: UpcomingEventWithHost, partySize: number) => void;
}

export function EventCard({ event, onBookClick }: EventCardProps) {
  const [partySize, setPartySize] = useState(1);
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
            <span>{format(parseLocalDate(event.date), 'EEE, MMM d')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              {formatTime(event.time)}
              {event.end_time && ` – ${formatTime(event.end_time)}`}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.estimated_cost_per_person != null && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span>~${event.estimated_cost_per_person.toFixed(2)} per person</span>
            </div>
          )}
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

        {/* Party size selector */}
        <div className="mb-3">
          <Select
            value={partySize.toString()}
            onValueChange={(v) => setPartySize(Number(v))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Guest (Just me)</SelectItem>
              <SelectItem value="2">2 Guests (+1)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          className="w-full"
          variant={isSoldOut && !event.waitlist_enabled ? 'secondary' : 'default'}
          disabled={isSoldOut && !event.waitlist_enabled}
          onClick={() => onBookClick(event, partySize)}
        >
          {getButtonText()}
        </Button>
      </CardContent>
    </Card>
  );
}
