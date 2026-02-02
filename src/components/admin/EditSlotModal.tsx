import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Save, MapPin, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AvailabilitySlot } from '@/lib/types';
import { useUpdateAvailabilitySlot } from '@/hooks/useAvailabilitySlots';
import { toast } from 'sonner';

interface EditSlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: AvailabilitySlot | null;
}

export function EditSlotModal({ open, onOpenChange, slot }: EditSlotModalProps) {
  const updateSlot = useUpdateAvailabilitySlot();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [totalTablesInput, setTotalTablesInput] = useState('1');
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);

  // Reset form when slot changes
  useEffect(() => {
    if (slot) {
      setName(slot.name);
      setDescription(slot.description || '');
      setLocation(slot.location || '');
      setEstimatedCost(slot.estimated_cost_per_person?.toString() || '');
      setDate(new Date(slot.date));
      setTime(slot.time.slice(0, 5)); // HH:MM format
      setEndTime(slot.end_time ? slot.end_time.slice(0, 5) : '');
      setTotalTablesInput(slot.total_tables.toString());
      setWaitlistEnabled(slot.waitlist_enabled);
    }
  }, [slot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!slot || !date) return;

    // Validation
    if (endTime && endTime <= time) {
      toast.error('End time must be after start time');
      return;
    }

    const parsedTables = parseInt(totalTablesInput) || 1;
    if (parsedTables < slot.booked_tables) {
      toast.error(`Cannot reduce tables below ${slot.booked_tables} (already booked)`);
      return;
    }

    const parsedCost = estimatedCost ? parseFloat(estimatedCost) : null;

    try {
      await updateSlot.mutateAsync({
        slotId: slot.id,
        updates: {
          name,
          description: description || null,
          date: format(date, 'yyyy-MM-dd'),
          time: time + ':00',
          end_time: endTime ? endTime + ':00' : null,
          total_tables: parsedTables,
          waitlist_enabled: waitlistEnabled,
          location: location || null,
          estimated_cost_per_person: parsedCost,
        },
      });
      toast.success('Event updated successfully');
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update event';
      if (message.includes('duplicate key') || message.includes('23505')) {
        toast.error('Another event already exists at this date and time');
      } else {
        toast.error(message);
      }
    }
  };

  if (!slot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update the details for this event. Existing bookings will be preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Event Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Wine Tasting Evening"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about this event..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-location">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Location (optional)
                  </div>
                </Label>
                <Input
                  id="edit-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., 123 Main St"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cost">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Est. Cost/Person
                  </div>
                </Label>
                <Input
                  id="edit-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="e.g., 25.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-time">Start Time</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end-time">End Time (optional)</Label>
                <Input
                  id="edit-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tables">Total Spots</Label>
              <Input
                id="edit-tables"
                type="number"
                min={slot.booked_tables || 1}
                value={totalTablesInput}
                onChange={(e) => setTotalTablesInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseInt(totalTablesInput);
                  const minVal = slot.booked_tables || 1;
                  if (isNaN(parsed) || parsed < minVal) {
                    setTotalTablesInput(minVal.toString());
                  }
                }}
                required
              />
              {slot.booked_tables > 0 && (
                <p className="text-xs text-muted-foreground">
                  Minimum: {slot.booked_tables} (already booked)
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-waitlist">Enable Waitlist</Label>
                <p className="text-xs text-muted-foreground">
                  Allow users to join a waitlist when full
                </p>
              </div>
              <Switch
                id="edit-waitlist"
                checked={waitlistEnabled}
                onCheckedChange={setWaitlistEnabled}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateSlot.isPending}>
              {updateSlot.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
