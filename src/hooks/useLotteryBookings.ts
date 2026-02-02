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

      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

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
      const { error: winnerError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .in('id', winnerIds);

      if (winnerError) throw winnerError;

      if (rejectOthers && losers.length > 0) {
        const loserIds = losers.map(l => l.id);
        const { error: loserError } = await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .in('id', loserIds);

        if (loserError) throw loserError;
      }

      const { error: updateError } = await supabase
        .from('availability_slots')
        .update({ booked_tables: slot.booked_tables + actualWinnersCount })
        .eq('id', slotId);

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