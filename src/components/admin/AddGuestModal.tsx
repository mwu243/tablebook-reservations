import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface AddGuestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string | null;
  slotName: string;
}

const guestSchema = z.object({
  customer_name: z.string().trim().min(1, 'Name is required').max(100),
  customer_email: z.string().trim().email('Invalid email').max(255),
  party_size: z.number().int().min(1).max(2),
  dietary_restrictions: z.string().trim().max(500).optional(),
});

export function AddGuestModal({ open, onOpenChange, slotId, slotName }: AddGuestModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [dietary, setDietary] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setPartySize(1);
      setDietary('');
    }
  }, [open]);

  const addGuest = useMutation({
    mutationFn: async () => {
      if (!slotId) throw new Error('No slot selected');
      const parsed = guestSchema.parse({
        customer_name: name,
        customer_email: email,
        party_size: partySize,
        dietary_restrictions: dietary || undefined,
      });
      const { data, error } = await supabase.rpc('admin_add_booking', {
        p_slot_id: slotId,
        p_customer_name: parsed.customer_name,
        p_customer_email: parsed.customer_email,
        p_party_size: parsed.party_size,
        p_dietary_restrictions: parsed.dietary_restrictions ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Guest added successfully');
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['owner-all-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['user-owned-slots'] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to add guest';
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Guest Manually
          </DialogTitle>
          <DialogDescription>
            Add a guest to <span className="font-medium">{slotName}</span>. They will be marked as confirmed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="guest-name">Full Name *</Label>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-email">Email *</Label>
            <Input
              id="guest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-party">Party Size *</Label>
            <Select value={String(partySize)} onValueChange={(v) => setPartySize(Number(v))}>
              <SelectTrigger id="guest-party">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 guest</SelectItem>
                <SelectItem value="2">2 guests</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-dietary">Dietary Restrictions (optional)</Label>
            <Textarea
              id="guest-dietary"
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              placeholder="Vegetarian, allergies, etc."
              maxLength={500}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addGuest.isPending}>
            Cancel
          </Button>
          <Button onClick={() => addGuest.mutate()} disabled={addGuest.isPending}>
            {addGuest.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Guest
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
