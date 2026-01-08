import { cn } from '@/lib/utils';
import { AvailabilitySlot } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const showTooltip = slot.name !== 'Available Table' || slot.description;

  const chipContent = (
    <button
      onClick={isAvailable ? onClick : undefined}
      disabled={!isAvailable}
      className={cn(
        'slot-chip flex flex-col',
        !isAvailable && 'slot-chip-disabled'
      )}
    >
      <span className="block">{formatTime(slot.time)}</span>
      {slot.name !== 'Available Table' && (
        <span className="mt-0.5 block text-xs text-muted-foreground truncate max-w-[100px]">
          {slot.name}
        </span>
      )}
      {isAvailable && tablesLeft <= 2 && (
        <span className="mt-0.5 block text-xs text-accent">
          {tablesLeft} {tablesLeft === 1 ? 'table' : 'tables'} left
        </span>
      )}
    </button>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {chipContent}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium">{slot.name}</p>
            {slot.description && (
              <p className="text-sm text-muted-foreground mt-1">{slot.description}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return chipContent;
}
