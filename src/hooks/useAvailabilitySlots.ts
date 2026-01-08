import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AvailabilitySlot, MealTime, MEAL_TIME_RANGES } from '@/lib/types';
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

export function useCreateAvailabilitySlots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slots: Omit<AvailabilitySlot, 'id' | 'created_at' | 'booked_tables'>[]) => {
      const { data, error } = await supabase
        .from('availability_slots')
        .upsert(
          slots.map(slot => ({ ...slot, booked_tables: 0 })),
          { onConflict: 'date,time', ignoreDuplicates: false }
        )
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
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
    }: {
      slotId: string;
      customerName: string;
      customerEmail: string;
      partySize: number;
    }) => {
      // First, get the current slot
      const { data: slot, error: slotError } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('id', slotId)
        .single();

      if (slotError) throw slotError;
      if (!slot) throw new Error('Slot not found');
      if (slot.booked_tables >= slot.total_tables) throw new Error('No tables available');

      // Create booking
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          slot_id: slotId,
          customer_name: customerName,
          customer_email: customerEmail,
          party_size: partySize,
        });

      if (bookingError) throw bookingError;

      // Update slot booked_tables
      const { error: updateError } = await supabase
        .from('availability_slots')
        .update({ booked_tables: slot.booked_tables + 1 })
        .eq('id', slotId);

      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
