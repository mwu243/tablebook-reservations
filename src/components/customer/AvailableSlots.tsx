import { format } from 'date-fns';
import { CalendarX, Loader2 } from 'lucide-react';
import { AvailabilitySlot } from '@/lib/types';
import { SlotChip } from './SlotChip';

interface AvailableSlotsProps {
  slots: AvailabilitySlot[] | undefined;
  isLoading: boolean;
  date: Date | undefined;
  onSlotClick: (slot: AvailabilitySlot) => void;
}

export function AvailableSlots({ slots, isLoading, date, onSlotClick }: AvailableSlotsProps) {
  if (!date) {
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-md text-center">
          <CalendarX className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Select a Date</h3>
          <p className="mt-2 text-muted-foreground">
            Choose your preferred date to see available time slots
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-16">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading availability...</span>
        </div>
      </div>
    );
  }

  const availableSlots = slots?.filter(s => s.booked_tables < s.total_tables) || [];

  if (availableSlots.length === 0) {
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-md text-center">
          <CalendarX className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No Availability</h3>
          <p className="mt-2 text-muted-foreground">
            No tables are available for {format(date, 'EEEE, MMMM d')}. Please try another date.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">
          Available Times for {format(date, 'EEEE, MMMM d')}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {availableSlots.length} time {availableSlots.length === 1 ? 'slot' : 'slots'} available
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {slots?.map((slot) => {
          const isAvailable = slot.booked_tables < slot.total_tables;
          return (
            <SlotChip
              key={slot.id}
              slot={slot}
              isAvailable={isAvailable}
              onClick={() => onSlotClick(slot)}
            />
          );
        })}
      </div>
    </div>
  );
}
