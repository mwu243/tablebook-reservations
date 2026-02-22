import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Loader2, Plus, Tag, FileText, Ticket, Shuffle, Users, MapPin, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
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
import { BookingMode } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00',
];

export function AvailabilityManager() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('19:00');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [totalSpotsInput, setTotalSpotsInput] = useState('1');
  const [bookingMode, setBookingMode] = useState<BookingMode>('fcfs');
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  
  const createSlots = useCreateAvailabilitySlots();

  const formatTimeDisplay = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
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

    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create availability',
        variant: 'destructive',
      });
      return;
    }

    const startIndex = TIME_OPTIONS.indexOf(startTime);
    const endIndex = TIME_OPTIONS.indexOf(endTime);
    
    if (startIndex >= endIndex) {
      toast({
        title: 'Error',
        description: 'End time must be after start time',
        variant: 'destructive',
      });
      return;
    }

    const parsedSpots = parseInt(totalSpotsInput) || 1;
    const parsedCost = estimatedCost ? parseFloat(estimatedCost) : null;

    const slot = {
      date: format(date, 'yyyy-MM-dd'),
      time: startTime,
      end_time: endTime,
      total_tables: parsedSpots,
      name: name.trim() || 'Available Table',
      description: description.trim() || null,
      booking_mode: bookingMode,
      user_id: user.id,
      waitlist_enabled: waitlistEnabled,
      location: location.trim() || null,
      estimated_cost_per_person: parsedCost,
    };

    try {
      await createSlots.mutateAsync([slot]);
      toast({
        title: 'Availability Created',
        description: `"${slot.name}" on ${format(date, 'MMMM d, yyyy')} from ${formatTimeDisplay(startTime)} to ${formatTimeDisplay(endTime)}`,
      });
      setDate(undefined);
      setName('');
      setDescription('');
      setLocation('');
      setEstimatedCost('');
      setTotalSpotsInput('1');
      setWaitlistEnabled(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create availability slot',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="admin-card">
      <h2 className="mb-6 text-xl font-semibold">Create Availability</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name and Description */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              Event Name
            </Label>
            <Input
              placeholder="e.g., Dinner Service, Wine Tasting"
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

        {/* Location and Cost */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              Location (Optional)
            </Label>
            <Input
              placeholder="e.g., 123 Main St, Downtown"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              Est. Cost/Person (Optional)
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 25.00"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
            />
          </div>
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

          {/* Total Spots - FIX: use string input to allow clearing */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Available Spots
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={totalSpotsInput}
              onChange={(e) => setTotalSpotsInput(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(totalSpotsInput);
                if (isNaN(parsed) || parsed < 1) {
                  setTotalSpotsInput('1');
                }
              }}
              placeholder="1"
            />
            <p className="text-xs text-muted-foreground">
              Number of spots available for this event
            </p>
          </div>
        </div>

        {/* Booking Mode */}
        <div className="space-y-3">
          <Label>Booking Mode</Label>
          <RadioGroup
            value={bookingMode}
            onValueChange={(v) => setBookingMode(v as BookingMode)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Label
              htmlFor="fcfs"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50",
                bookingMode === 'fcfs' && "border-accent bg-accent/5"
              )}
            >
              <RadioGroupItem value="fcfs" id="fcfs" className="mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Ticket className="h-4 w-4" />
                  First Come, First Served
                </div>
                <p className="text-sm text-muted-foreground">
                  Instant booking confirmation when customers book.
                </p>
              </div>
            </Label>
            <Label
              htmlFor="lottery"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50",
                bookingMode === 'lottery' && "border-accent bg-accent/5"
              )}
            >
              <RadioGroupItem value="lottery" id="lottery" className="mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Shuffle className="h-4 w-4" />
                  Lottery
                </div>
                <p className="text-sm text-muted-foreground">
                  Users apply for a spot; you pick winners later.
                </p>
              </div>
            </Label>
          </RadioGroup>
        </div>

        {/* Waitlist Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="waitlist" className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4" />
              Enable Waitlist
            </Label>
            <p className="text-sm text-muted-foreground">
              When fully booked, customers can join a waitlist. If someone cancels, the next person is automatically promoted and notified.
            </p>
          </div>
          <Switch
            id="waitlist"
            checked={waitlistEnabled}
            onCheckedChange={setWaitlistEnabled}
          />
        </div>

        {/* Preview */}
        {date && (
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium text-muted-foreground">Preview</p>
            <p className="mt-1 font-medium">
              {name.trim() || 'Available Table'}
            </p>
            {location && (
              <p className="mt-1 text-sm text-muted-foreground">📍 {location}</p>
            )}
            {estimatedCost && (
              <p className="mt-1 text-sm text-muted-foreground">💰 ~${parseFloat(estimatedCost).toFixed(2)} per person</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {format(date, 'MMMM d, yyyy')} • {formatTimeDisplay(startTime)} – {formatTimeDisplay(endTime)} • {parseInt(totalSpotsInput) || 1} spot{(parseInt(totalSpotsInput) || 1) > 1 ? 's' : ''} • {bookingMode === 'fcfs' ? 'First Come, First Served' : 'Lottery'}
              {waitlistEnabled && ' • Waitlist enabled'}
            </p>
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
              Create Availability
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
