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
import { supabase } from '@/integrations/supabase/client';
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

  useEffect(() => {
    if (slot) {
      setName(slot.name);
      setDescription(slot.description || '');
      setLocation(slot.location || '');
      setEstimatedCost(slot.estimated_cost_per_person?.toString() || '');
      // Parse date without timezone shift: "2026-02-25" → local midnight
      const [year, month, day] = slot.date.split('-').map(Number);
      setDate(new Date(year, month - 1, day));
      setTime(slot.time.slice(0, 5));
      setEndTime(slot.end_time ? slot.end_time.slice(0, 5) : '');
      setTotalTablesInput(slot.total_tables.toString());
      setWaitlistEnabled(slot.waitlist_enabled);
    }
  }, [slot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!slot || !date) return;

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

      supabase.functions.invoke('send-booking-notification', {
        body: { slotId: slot.id, bookingType: 'event_update' },
      }).then(({ error }) => {
        if (error) {
          console.error('Failed to send event update notifications:', error);
        }
      });

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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update event details. Existing bookings will be preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs font-medium">Event Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Wine Tasting Evening"
                className="h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-description" className="text-xs font-medium">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about this event..."
                rows={2}
                className="min-h-[60px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-location" className="text-xs font-medium">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Location
                  </span>
                </Label>
                <Input
                  id="edit-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., 123 Main St"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-cost" className="text-xs font-medium">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Cost/Person
                  </span>
                </Label>
                <Input
                  id="edit-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="25.00"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal h-9',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {date ? format(date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-time" className="text-xs font-medium">Start Time</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-9"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-end-time" className="text-xs font-medium">End Time</Label>
                <Input
                  id="edit-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="edit-tables" className="text-xs font-medium">Total Spots</Label>
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
                  className="h-9"
                  required
                />
                {slot.booked_tables > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Min: {slot.booked_tables} (booked)
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="edit-waitlist" className="text-xs font-medium cursor-pointer">Waitlist</Label>
                <Switch
                  id="edit-waitlist"
                  checked={waitlistEnabled}
                  onCheckedChange={setWaitlistEnabled}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={updateSlot.isPending}>
              {updateSlot.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
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
