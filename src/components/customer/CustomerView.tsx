import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { MealTime, AvailabilitySlot } from '@/lib/types';
import { useAvailabilitySlots } from '@/hooks/useAvailabilitySlots';
import { HeroSection } from './HeroSection';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { SlotsPanel } from './SlotsPanel';
import { BookingModal } from './BookingModal';

export function CustomerView() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [partySize, setPartySize] = useState(2);
  const [mealTime, setMealTime] = useState<MealTime>('all');
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  const { data: slots, isLoading } = useAvailabilitySlots(date, mealTime);

  return (
    <div className="min-h-screen pb-16">
      <HeroSection />
      
      <div className="container py-12">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold">Find Your Perfect Time</h2>
          <p className="mt-2 text-muted-foreground">
            Select a date with availability to see open time slots
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
          {/* Calendar */}
          <div>
            <AvailabilityCalendar
              selected={date}
              onSelect={setDate}
            />
          </div>

          {/* Slots Panel */}
          <div>
            {date ? (
              <SlotsPanel
                date={date}
                slots={slots}
                isLoading={isLoading}
                partySize={partySize}
                onPartySizeChange={setPartySize}
                mealTime={mealTime}
                onMealTimeChange={setMealTime}
                onSlotClick={setSelectedSlot}
              />
            ) : (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border bg-card p-6 text-center shadow-sm">
                <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">Select a Date</h3>
                <p className="mt-2 text-muted-foreground">
                  Click on a date with a green dot to see available times
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BookingModal
        slot={selectedSlot}
        partySize={partySize}
        onClose={() => setSelectedSlot(null)}
      />
    </div>
  );
}
