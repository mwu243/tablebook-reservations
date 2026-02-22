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
          availability_slots (*)
        `)
        .eq('status', 'pending_lottery')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Booking[];
    },
    refetchInterval: 5000,
    staleTime: 0,
  });
}

export function useConfirmLotteryWinner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, slotId }: { bookingId: string; slotId: string }) => {
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      const { error: updateError } = await supabase
        .rpc('increment_booked_tables', { slot_id: slotId });

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

export function usePickRandomWinner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      slotId, 
      entries, 
      winnersCount = 1,
      rejectOthers = true 
    }: { 
      slotId: string; 
      entries: Booking[]; 
      winnersCount?: number;
      rejectOthers?: boolean;
    }) => {
      if (entries.length === 0) {
        throw new Error('No entries to pick from');
      }

      const { data: slot, error: slotError } = await supabase
        .from('availability_slots')
        .select('booked_tables, total_tables')
        .eq('id', slotId)
        .single();

      if (slotError) throw slotError;
      if (!slot) throw new Error('Slot not found');

      const availableSpots = slot.total_tables - slot.booked_tables;
      const actualWinnersCount = Math.min(winnersCount, entries.length, availableSpots);

      if (actualWinnersCount <= 0) {
        throw new Error('No spots available for winners');
      }

      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, actualWinnersCount);
      const losers = shuffled.slice(actualWinnersCount);

      const winnerIds = winners.map(w => w.id);
      for (const wId of winnerIds) {
        const { error } = await supabase
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', wId);
        if (error) throw error;
      }

      if (rejectOthers && losers.length > 0) {
        for (const l of losers) {
          const { error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', l.id);
          if (error) throw error;
        }
      }

      const { error: updateError } = await supabase
        .rpc('increment_booked_tables', { slot_id: slotId, amount: actualWinnersCount });

      if (updateError) throw updateError;

      return { 
        winners, 
        rejected: rejectOthers ? losers : [],
        winnersCount: actualWinnersCount 
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
    },
  });
}