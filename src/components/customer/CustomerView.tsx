import { useState } from 'react';
import { MealTime, AvailabilitySlot } from '@/lib/types';
import { useAvailabilitySlots } from '@/hooks/useAvailabilitySlots';
import { HeroSection } from './HeroSection';
import { FilterBar } from './FilterBar';
import { AvailableSlots } from './AvailableSlots';
import { BookingModal } from './BookingModal';

export function CustomerView() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [partySize, setPartySize] = useState(2);
  const [mealTime, setMealTime] = useState<MealTime>('dinner');
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  const { data: slots, isLoading } = useAvailabilitySlots(date, mealTime);

  return (
    <div className="min-h-screen pb-16">
      <HeroSection />
      <FilterBar
        date={date}
        onDateChange={setDate}
        partySize={partySize}
        onPartySizeChange={setPartySize}
        mealTime={mealTime}
        onMealTimeChange={setMealTime}
      />
      <AvailableSlots
        slots={slots}
        isLoading={isLoading}
        date={date}
        onSlotClick={setSelectedSlot}
      />
      <BookingModal
        slot={selectedSlot}
        partySize={partySize}
        onClose={() => setSelectedSlot(null)}
      />
    </div>
  );
}
