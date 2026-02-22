import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AvailabilitySlot, MealTime, MEAL_TIME_RANGES, BookingMode } from '@/lib/types';
import { format } from 'date-fns';

export function useAvailabilitySlots(date: Date | undefined, mealTime: MealTime) {
  return useQuery({
    queryKey: ['availability-slots', date ? format(date, 'yyyy-MM-dd') : null, mealTime],
    queryFn: async () => {
      if (!date) return [];

      let query = supabase
        .from('availability_slots')
        .select('*')
        .eq('date', format(date, 'yyyy-MM-dd'))
        .order('time', { ascending: true });

      if (mealTime !== 'all') {
        const range = MEAL_TIME_RANGES[mealTime];
        query = query.gte('time', range.start).lte('time', range.end);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AvailabilitySlot[];
    },
    enabled: !!date,
    refetchInterval: 5000,
  });
}

interface CreateSlotInput {
  date: string;
  time: string;
  end_time: string | null;
  total_tables: number;
  name: string;
  description: string | null;
  booking_mode: BookingMode;
  user_id: string;
  waitlist_enabled?: boolean;
  location?: string | null;
  estimated_cost_per_person?: number | null;
}

export function useCreateAvailabilitySlots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slots: CreateSlotInput[]) => {
      const { data, error } = await supabase
        .from('availability_slots')
        .insert(
          slots.map(slot => ({ 
            ...slot, 
            booked_tables: 0,
            waitlist_enabled: slot.waitlist_enabled ?? false,
            location: slot.location ?? null,
            estimated_cost_per_person: slot.estimated_cost_per_person ?? null,
          }))
        )
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
      queryClient.invalidateQueries({ queryKey: ['user-owned-slots'] });
    },
  });
}

export function useBookSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slotId,
      customerName,
      customerEmail,
      partySize,
      userId,
      isLottery = false,
      dietaryRestrictions,
    }: {
      slotId: string;
      customerName: string;
      customerEmail: string;
      partySize: number;
      userId?: string;
      isLottery?: boolean;
      dietaryRestrictions?: string;
    }) => {
      // Create booking with appropriate status and user_id
      const status = isLottery ? 'pending_lottery' : 'confirmed';
      
      // Build the insert object - dietary_restrictions may not be in schema cache yet
      const bookingData: Record<string, unknown> = {
        slot_id: slotId,
        customer_name: customerName,
        customer_email: customerEmail,
        party_size: partySize,
        user_id: userId,
        status,
      };
      
      // Try to include dietary_restrictions if available
      if (dietaryRestrictions) {
        bookingData.dietary_restrictions = dietaryRestrictions;
      }
      
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData as any);

      if (bookingError) throw bookingError;

      // Only update booked_tables for FCFS bookings using the RPC function
      if (!isLottery) {
        const { error: updateError } = await supabase.rpc('increment_booked_tables', {
          slot_id: slotId,
          amount: partySize,
        });

        if (updateError) throw updateError;
      }

      // Send email notifications (fire and forget - don't block on this)
      supabase.functions.invoke('send-booking-notification', {
        body: {
          slotId,
          customerName,
          customerEmail,
          partySize,
          bookingType: 'booking',
        },
      }).then(({ error }) => {
        if (error) {
          console.error('Failed to send booking notification:', error);
        }
      });

      return { success: true, isLottery };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
    },
  });
}

export function useDeleteAvailabilitySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slotId: string) => {
      // The cascade delete will automatically remove associated bookings
      const { error } = await supabase
        .from('availability_slots')
        .delete()
        .eq('id', slotId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['user-owned-slots'] });
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
    },
  });
}

interface UpdateSlotInput {
  slotId: string;
  updates: {
    name?: string;
    description?: string | null;
    date?: string;
    time?: string;
    end_time?: string | null;
    total_tables?: number;
    waitlist_enabled?: boolean;
    location?: string | null;
    estimated_cost_per_person?: number | null;
  };
}

export function useUpdateAvailabilitySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slotId, updates }: UpdateSlotInput) => {
      const { data, error } = await supabase
        .from('availability_slots')
        .update(updates)
        .eq('id', slotId)
        .select()
        .single();

      if (error) throw error;
      return data as AvailabilitySlot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['user-owned-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-events-with-hosts'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-slots'] });
    },
  });
}

export function useAllUpcomingSlots() {
  return useQuery({
    queryKey: ['upcoming-slots'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;
      return data as AvailabilitySlot[];
    },
    refetchInterval: 5000,
  });
}
