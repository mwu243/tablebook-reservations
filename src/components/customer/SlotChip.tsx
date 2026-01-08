import { cn } from '@/lib/utils';
import { AvailabilitySlot } from '@/lib/types';

interface SlotChipProps {
  slot: AvailabilitySlot;
  isAvailable: boolean;
  onClick: () => void;
}

export function SlotChip({ slot, isAvailable, onClick }: SlotChipProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const tablesLeft = slot.total_tables - slot.booked_tables;

  return (
    <button
      onClick={isAvailable ? onClick : undefined}
      disabled={!isAvailable}
      className={cn(
        'slot-chip',
        !isAvailable && 'slot-chip-disabled'
      )}
    >
      <span className="block">{formatTime(slot.time)}</span>
      {isAvailable && tablesLeft <= 2 && (
        <span className="mt-0.5 block text-xs text-accent">
          {tablesLeft} {tablesLeft === 1 ? 'table' : 'tables'} left
        </span>
      )}
    </button>
  );
}
