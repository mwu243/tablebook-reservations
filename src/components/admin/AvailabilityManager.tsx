import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Loader2, Plus, TableIcon, Tag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useCreateAvailabilitySlots } from '@/hooks/useAvailabilitySlots';
import { toast } from '@/hooks/use-toast';

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00',
];

export function AvailabilityManager() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('22:00');
  const [tablesPerSlot, setTablesPerSlot] = useState(5);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const createSlots = useCreateAvailabilitySlots();

  const formatTimeDisplay = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const generateSlots = () => {
    if (!date) return [];

    const slots: { date: string; time: string; total_tables: number; name: string; description: string | null }[] = [];
    const startIndex = TIME_OPTIONS.indexOf(startTime);
    const endIndex = TIME_OPTIONS.indexOf(endTime);
    const slotName = name.trim() || 'Available Table';

    for (let i = startIndex; i <= endIndex; i++) {
      slots.push({
        date: format(date, 'yyyy-MM-dd'),
        time: TIME_OPTIONS[i],
        total_tables: tablesPerSlot,
        name: slotName,
        description: description.trim() || null,
      });
    }

    return slots;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast({
        title: 'Error',
        description: 'Please select a date',
        variant: 'destructive',
      });
      return;
    }

    const slots = generateSlots();
    if (slots.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select a valid time range',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createSlots.mutateAsync(slots);
      toast({
        title: 'Availability Added',
        description: `Created ${slots.length} time slots for ${format(date, 'MMMM d, yyyy')}`,
      });
      setDate(undefined);
      setName('');
      setDescription('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create availability slots',
        variant: 'destructive',
      });
    }
  };

  const previewSlots = date ? generateSlots() : [];

  return (
    <div className="admin-card">
      <h2 className="mb-6 text-xl font-semibold">Manage Availability</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name and Description */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              Availability Name
            </Label>
            <Input
              placeholder="e.g., Chef's Table, Patio Seating"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Description (Optional)
            </Label>
            <Textarea
              placeholder="e.g., Premium outdoor seating with garden views"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
              className="min-h-[40px] resize-none"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  {date ? format(date, 'EEEE, MMMM d, yyyy') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tables Per Slot */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <TableIcon className="h-4 w-4" />
              Tables Per Slot
            </Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={tablesPerSlot}
              onChange={(e) => setTablesPerSlot(Number(e.target.value))}
            />
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Start Time
            </Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {formatTimeDisplay(time)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* End Time */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              End Time
            </Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {formatTimeDisplay(time)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preview */}
        {previewSlots.length > 0 && (
          <div className="rounded-lg bg-muted p-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Preview: {previewSlots.length} slots will be created
            </p>
            <div className="flex flex-wrap gap-2">
              {previewSlots.slice(0, 10).map((slot, i) => (
                <span
                  key={i}
                  className="rounded-md bg-background px-2 py-1 text-xs font-medium"
                >
                  {formatTimeDisplay(slot.time)}
                </span>
              ))}
              {previewSlots.length > 10 && (
                <span className="px-2 py-1 text-xs text-muted-foreground">
                  +{previewSlots.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-accent hover:bg-accent/90"
          disabled={createSlots.isPending || !date}
        >
          {createSlots.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Open Availability
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
