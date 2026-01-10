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
}

export function useCreateAvailabilitySlots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slots: CreateSlotInput[]) => {
      const { data, error } = await supabase
        .from('availability_slots')
        .insert(
          slots.map(slot => ({ ...slot, booked_tables: 0 }))
        )
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
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
      isLottery = false,
    }: {
      slotId: string;
      customerName: string;
      customerEmail: string;
      partySize: number;
      isLottery?: boolean;
    }) => {
      // First, get the current slot
      const { data: slot, error: slotError } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('id', slotId)
        .single();

      if (slotError) throw slotError;
      if (!slot) throw new Error('Slot not found');
      
      // For FCFS, check availability. For lottery, no limit check needed.
      if (!isLottery && slot.booked_tables >= slot.total_tables) {
        throw new Error('No tables available');
      }

      // Create booking with appropriate status
      const status = isLottery ? 'pending_lottery' : 'confirmed';
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          slot_id: slotId,
          customer_name: customerName,
          customer_email: customerEmail,
          party_size: partySize,
          status,
        });

      if (bookingError) throw bookingError;

      // Only update booked_tables for FCFS bookings
      if (!isLottery) {
        const { error: updateError } = await supabase
          .from('availability_slots')
          .update({ booked_tables: slot.booked_tables + 1 })
          .eq('id', slotId);

        if (updateError) throw updateError;
      }

      return { success: true, isLottery };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
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
