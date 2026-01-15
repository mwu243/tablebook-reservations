import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminBooking {
  id: string;
  customer_name: string;
  customer_email: string;
  party_size: number;
  slot_id: string;
  status: string;
  created_at: string;
  slot_date: string | null;
  slot_time: string | null;
  slot_end_time: string | null;
  slot_name: string | null;
  slot_booking_mode: string | null;
  slot_total_tables: number | null;
  slot_booked_tables: number | null;
  // Mapped property for compatibility with existing components
  availability_slots?: {
    id: string;
    date: string;
    time: string;
    end_time: string | null;
    name: string;
    booking_mode: string;
    total_tables: number;
    booked_tables: number;
  };
}

function mapBookingWithSlot(booking: AdminBooking): AdminBooking {
  return {
    ...booking,
    availability_slots: booking.slot_date ? {
      id: booking.slot_id,
      date: booking.slot_date,
      time: booking.slot_time!,
      end_time: booking.slot_end_time,
      name: booking.slot_name!,
      booking_mode: booking.slot_booking_mode!,
      total_tables: booking.slot_total_tables!,
      booked_tables: booking.slot_booked_tables!,
    } : undefined,
  };
}

export function useAdminUpcomingBookings() {
  return useQuery({
    queryKey: ['admin-bookings', 'upcoming'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .rpc('get_admin_bookings');

      if (error) throw error;

      // Filter for confirmed bookings with future dates
      const filteredData = (data as AdminBooking[])
        .filter(b => b.status === 'confirmed' && b.slot_date && b.slot_date >= today)
        .map(mapBookingWithSlot);

      return filteredData;
    },
    refetchInterval: 5000,
  });
}

export function useAdminLotteryBookings() {
  return useQuery({
    queryKey: ['admin-bookings', 'lottery'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_admin_bookings');

      if (error) throw error;

      // Filter for pending lottery bookings
      const filteredData = (data as AdminBooking[])
        .filter(b => b.status === 'pending_lottery')
        .map(mapBookingWithSlot);

      return filteredData;
    },
    refetchInterval: 5000,
    staleTime: 0,
  });
}

export function useAdminConfirmLotteryWinner() {
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

      // Update booking status to confirmed via RPC
      const { error: bookingError } = await supabase
        .rpc('admin_update_booking_status', {
          booking_id: bookingId,
          new_status: 'confirmed'
        });

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
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
    },
  });
}

export function useAdminRejectLotteryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId }: { bookingId: string }) => {
      const { error } = await supabase
        .rpc('admin_update_booking_status', {
          booking_id: bookingId,
          new_status: 'cancelled'
        });

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    },
  });
}

export function useAdminPickRandomWinner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      slotId, 
      entries, 
      winnersCount = 1,
      rejectOthers = true 
    }: { 
      slotId: string; 
      entries: AdminBooking[]; 
      winnersCount?: number;
      rejectOthers?: boolean;
    }) => {
      if (entries.length === 0) {
        throw new Error('No entries to pick from');
      }

      // Get current slot info
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

      // Shuffle and pick winners
      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, actualWinnersCount);
      const losers = shuffled.slice(actualWinnersCount);

      // Update winners to confirmed
      const winnerIds = winners.map(w => w.id);
      const { error: winnerError } = await supabase
        .rpc('admin_update_bookings_status', {
          booking_ids: winnerIds,
          new_status: 'confirmed'
        });

      if (winnerError) throw winnerError;

      // Optionally reject others
      if (rejectOthers && losers.length > 0) {
        const loserIds = losers.map(l => l.id);
        const { error: loserError } = await supabase
          .rpc('admin_update_bookings_status', {
            booking_ids: loserIds,
            new_status: 'cancelled'
          });

        if (loserError) throw loserError;
      }

      // Update booked_tables count
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
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
    },
  });
}
