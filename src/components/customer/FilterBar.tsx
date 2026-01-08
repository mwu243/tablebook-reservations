import { format } from 'date-fns';
import { CalendarIcon, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MealTime } from '@/lib/types';

interface FilterBarProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  partySize: number;
  onPartySizeChange: (size: number) => void;
  mealTime: MealTime;
  onMealTimeChange: (time: MealTime) => void;
}

export function FilterBar({
  date,
  onDateChange,
  partySize,
  onPartySizeChange,
  mealTime,
  onMealTimeChange,
}: FilterBarProps) {
  return (
    <div className="container -mt-8 relative z-10">
      <div className="filter-section">
        {/* Date Picker */}
        <div className="flex-1 min-w-[200px]">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">
            <CalendarIcon className="mr-1.5 inline h-4 w-4" />
            Date
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !date && 'text-muted-foreground'
                )}
              >
                {date ? format(date, 'EEEE, MMMM d') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={onDateChange}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Party Size */}
        <div className="flex-1 min-w-[160px]">
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
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <SelectItem key={n} value={n.toString()}>
                  {n} {n === 1 ? 'Guest' : 'Guests'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Meal Time */}
        <div className="flex-1 min-w-[160px]">
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
    </div>
  );
}
