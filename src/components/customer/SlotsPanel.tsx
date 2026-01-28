import { format } from 'date-fns';
import { Clock, Loader2, Users } from 'lucide-react';
import { AvailabilitySlot, MealTime, MEAL_TIME_RANGES } from '@/lib/types';
import { SlotChip } from './SlotChip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SlotsPanelProps {
  date: Date;
  slots: AvailabilitySlot[] | undefined;
  isLoading: boolean;
  partySize: number;
  onPartySizeChange: (size: number) => void;
  mealTime: MealTime;
  onMealTimeChange: (time: MealTime) => void;
  onSlotClick: (slot: AvailabilitySlot) => void;
  onWaitlistClick?: (slot: AvailabilitySlot) => void;
}

export function SlotsPanel({
  date,
  slots,
  isLoading,
  partySize,
  onPartySizeChange,
  mealTime,
  onMealTimeChange,
  onSlotClick,
  onWaitlistClick,
}: SlotsPanelProps) {
  const availableSlots = slots?.filter(s => s.booked_tables < s.total_tables) || [];

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">
          {format(date, 'EEEE, MMMM d')}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Select your preferred time
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">
            <Users className="mr-1.5 inline h-4 w-4" />
            Party Size
          </label>
          <Select
            value={partySize.toString()}
            onValueChange={(v) => onPartySizeChange(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Guest (Just me)</SelectItem>
              <SelectItem value="2">2 Guests (+1)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">
            <Clock className="mr-1.5 inline h-4 w-4" />
            Time
          </label>
          <Select value={mealTime} onValueChange={(v) => onMealTimeChange(v as MealTime)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Times</SelectItem>
              <SelectItem value="breakfast">Breakfast</SelectItem>
              <SelectItem value="lunch">Lunch</SelectItem>
              <SelectItem value="dinner">Dinner</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Slots */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading times...</span>
        </div>
      ) : !slots || slots.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <p>No times available for this filter.</p>
          <p className="mt-1 text-sm">Try selecting "All Times".</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {availableSlots.length} time {availableSlots.length === 1 ? 'slot' : 'slots'} available
            {slots.length > availableSlots.length && ` (${slots.length - availableSlots.length} full)`}
          </p>
          <div className="flex flex-wrap gap-3">
            {slots.map((slot) => {
              const remainingSpots = slot.total_tables - slot.booked_tables;
              const isAvailable = remainingSpots >= partySize;
              return (
                <SlotChip
                  key={slot.id}
                  slot={slot}
                  isAvailable={isAvailable}
                  partySize={partySize}
                  onClick={() => onSlotClick(slot)}
                  onWaitlistClick={onWaitlistClick ? () => onWaitlistClick(slot) : undefined}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
