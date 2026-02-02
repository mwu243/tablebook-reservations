import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpcomingEventsWithHosts, UpcomingEventWithHost } from '@/hooks/useUpcomingEventsWithHosts';
import { EventCard } from './EventCard';

interface UpcomingEventsListProps {
  onEventClick: (event: UpcomingEventWithHost) => void;
}

export function UpcomingEventsList({ onEventClick }: UpcomingEventsListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: events, isLoading } = useUpcomingEventsWithHosts(20);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 320; // Card width + gap
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (isLoading) {
    return (
      <div className="mb-8 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="mb-8 rounded-xl border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 font-medium">No Upcoming Events</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Check back soon for new SGDs!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
          <p className="text-sm text-muted-foreground">
            {events.length} event{events.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted"
        style={{ scrollbarWidth: 'thin' }}
      >
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onBookClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}
