import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, DayProps } from 'react-day-picker';
import { format, isSameDay, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { useMonthAvailability } from '@/hooks/useMonthAvailability';

interface AvailabilityCalendarProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
}

export function AvailabilityCalendar({ selected, onSelect }: AvailabilityCalendarProps) {
  const [month, setMonth] = React.useState(new Date());
  const { data: availabilityMap, isLoading } = useMonthAvailability(month);

  const today = startOfDay(new Date());

  // Determine which dates should be disabled
  const isDateDisabled = (date: Date): boolean => {
    if (date < today) return true;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    // If we have data, disable dates with no availability
    if (availabilityMap) {
      return !availabilityMap.has(dateStr) || availabilityMap.get(dateStr) === 0;
    }
    // While loading, don't disable future dates
    return false;
  };

  // Get availability count for a date
  const getAvailabilityCount = (date: Date): number => {
    if (date < today) return 0;
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityMap?.get(dateStr) || 0;
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={onSelect}
        month={month}
        onMonthChange={setMonth}
        disabled={isDateDisabled}
        showOutsideDays={false}
        className={cn('p-3 pointer-events-auto')}
        classNames={{
          months: 'flex flex-col',
          month: 'space-y-4',
          caption: 'flex justify-center pt-1 relative items-center mb-4',
          caption_label: 'text-lg font-semibold',
          nav: 'space-x-1 flex items-center',
          nav_button: cn(
            buttonVariants({ variant: 'outline' }),
            'h-9 w-9 bg-transparent p-0 hover:bg-accent'
          ),
          nav_button_previous: 'absolute left-1',
          nav_button_next: 'absolute right-1',
          table: 'w-full border-collapse',
          head_row: 'flex justify-between',
          head_cell: 'text-muted-foreground font-medium text-sm w-12 h-10 flex items-center justify-center',
          row: 'flex w-full justify-between mt-1',
          cell: 'relative h-12 w-12 text-center text-sm p-0 focus-within:relative focus-within:z-20',
          day: cn(
            'h-12 w-12 p-0 font-normal rounded-lg transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'aria-selected:opacity-100'
          ),
          day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
          day_today: 'border-2 border-primary',
          day_outside: 'text-muted-foreground opacity-50',
          day_disabled: 'text-muted-foreground/40 cursor-not-allowed hover:bg-transparent',
          day_hidden: 'invisible',
        }}
        components={{
          IconLeft: () => <ChevronLeft className="h-5 w-5" />,
          IconRight: () => <ChevronRight className="h-5 w-5" />,
          Day: ({ date, displayMonth, ...props }: DayProps) => {
            const isDisabled = isDateDisabled(date);
            const eventCount = getAvailabilityCount(date);
            const isSelected = selected && isSameDay(date, selected);
            const isCurrentMonth = date.getMonth() === displayMonth.getMonth();
            const isToday = isSameDay(date, today);

            if (!isCurrentMonth) {
              return <div className="h-12 w-12" />;
            }

            return (
              <button
                disabled={isDisabled}
                onClick={() => !isDisabled && onSelect(date)}
                className={cn(
                  'relative h-12 w-12 rounded-lg font-normal transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  isDisabled && 'text-muted-foreground/40 cursor-not-allowed',
                  !isDisabled && 'hover:bg-accent hover:text-accent-foreground cursor-pointer',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                  isToday && !isSelected && 'border-2 border-primary'
                )}
              >
                <span className="flex h-full w-full flex-col items-center justify-center">
                  <span>{date.getDate()}</span>
                  {eventCount > 0 && !isSelected && (
                    <span className="absolute bottom-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
                      {eventCount}
                    </span>
                  )}
                  {eventCount > 0 && isSelected && (
                    <span className="absolute bottom-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-foreground px-1 text-[10px] font-bold text-primary">
                      {eventCount}
                    </span>
                  )}
                </span>
              </button>
            );
          },
        }}
      />
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 border-t pt-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
            {availabilityMap ? Array.from(availabilityMap.values()).reduce((sum, count) => sum + count, 0) : 0}
          </span>
          <span>Events available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          <span>Unavailable</span>
        </div>
      </div>
    </div>
  );
}
