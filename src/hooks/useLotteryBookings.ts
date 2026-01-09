import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/lib/types';

export function useLotteryBookings() {
  return useQuery({
    queryKey: ['bookings', 'lottery'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          availability_slots (
            id,
            date,
            time,
            end_time,
            total_tables,
            booked_tables,
            name,
            booking_mode
          )
        `)
        .eq('status', 'pending_lottery')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Booking[];
    },
    refetchInterval: 5000,
  });
}

export function useConfirmLotteryWinner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, slotId }: { bookingId: string; slotId: string }) => {
      // Get current slot to update booked_tables
      const { data: slot, error: slotError } = await supabase
        .from('availability_slots')
        .select('booked_tables, total_tables')
        .eq('id', slotId)
        .single();

      if (slotError) throw slotError;
      if (!slot) throw new Error('Slot not found');

      if (slot.booked_tables >= slot.total_tables) {
        throw new Error('No tables available - slot is fully booked');
      }

      // Update booking status to confirmed
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Increment booked_tables
      const { error: updateError } = await supabase
        .from('availability_slots')
        .update({ booked_tables: slot.booked_tables + 1 })
        .eq('id', slotId);

      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
    },
  });
}

export function useRejectLotteryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId }: { bookingId: string }) => {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
