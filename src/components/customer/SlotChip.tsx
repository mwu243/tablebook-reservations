import { Shuffle, Ticket } from 'lucide-react';
import { AvailabilitySlot } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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

  const isLottery = slot.booking_mode === 'lottery';
  const remainingTables = slot.total_tables - slot.booked_tables;
  // Lottery slots are always clickable; FCFS only if available
  const canClick = isLottery || isAvailable;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={canClick ? onClick : undefined}
            disabled={!canClick}
            className={cn(
              'group flex min-w-[100px] flex-col items-center gap-1 rounded-lg border px-4 py-3 text-sm transition-all',
              canClick
                ? 'cursor-pointer border-accent/30 bg-accent/5 hover:border-accent hover:bg-accent/10'
                : 'cursor-not-allowed border-muted bg-muted/50 text-muted-foreground opacity-60'
            )}
          >
            <span className="font-semibold">
              {formatTime(slot.time)}
              {slot.end_time && (
                <span className="text-muted-foreground font-normal"> – {formatTime(slot.end_time)}</span>
              )}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {slot.name}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {isLottery ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  <Shuffle className="h-2.5 w-2.5" />
                  Lottery
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">
                  <Ticket className="h-2.5 w-2.5" />
                  {remainingTables} left
                </span>
              )}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-medium">{slot.name}</p>
          {slot.description && (
            <p className="mt-1 text-xs text-muted-foreground">{slot.description}</p>
          )}
          <p className="mt-1 text-xs">
            {isLottery 
              ? 'Enter for a chance to be selected' 
              : `${remainingTables} of ${slot.total_tables} tables available`
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
