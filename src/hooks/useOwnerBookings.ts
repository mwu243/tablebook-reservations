import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Booking, WaitlistEntry } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

// Fetch all bookings for slots owned by the current user
export function useOwnerBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['owner-bookings', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: ownedSlots, error: slotsError } = await supabase
        .from('availability_slots')
        .select('id')
        .eq('user_id', user.id);

      if (slotsError) throw slotsError;
      if (!ownedSlots || ownedSlots.length === 0) return [];

      const slotIds = ownedSlots.map(s => s.id);

      const { data, error } = await supabase
        .from('bookings')
        .select(`*, availability_slots (*)`)
        .in('slot_id', slotIds)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Booking[];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

// Fetch ALL bookings (including past events) for slots owned by the current user
export function useOwnerAllBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['owner-all-bookings', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: ownedSlots, error: slotsError } = await supabase
        .from('availability_slots')
        .select('id')
        .eq('user_id', user.id);

      if (slotsError) throw slotsError;
      if (!ownedSlots || ownedSlots.length === 0) return [];

      const slotIds = ownedSlots.map(s => s.id);

      const { data, error } = await supabase
        .from('bookings')
        .select(`*, availability_slots (*)`)
        .in('slot_id', slotIds)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Booking[];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

// Fetch lottery entries for slots owned by the current user
export function useOwnerLotteryBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['owner-lottery-bookings', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: ownedSlots, error: slotsError } = await supabase
        .from('availability_slots')
        .select('id')
        .eq('user_id', user.id)
        .eq('booking_mode', 'lottery');

      if (slotsError) throw slotsError;
      if (!ownedSlots || ownedSlots.length === 0) return [];

      const slotIds = ownedSlots.map(s => s.id);

      const { data, error } = await supabase
        .from('bookings')
        .select(`*, availability_slots (*)`)
        .in('slot_id', slotIds)
        .eq('status', 'pending_lottery')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Booking[];
    },
    enabled: !!user,
    refetchInterval: 5000,
    staleTime: 0,
  });
}

// Fetch waitlist entries for slots owned by the current user
export function useOwnerWaitlistEntries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['owner-waitlist-entries', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: ownedSlots, error: slotsError } = await supabase
        .from('availability_slots')
        .select('id')
        .eq('user_id', user.id)
        .eq('waitlist_enabled', true);

      if (slotsError) throw slotsError;
      if (!ownedSlots || ownedSlots.length === 0) return [];

      const slotIds = ownedSlots.map(s => s.id);

      const { data, error } = await supabase
        .from('waitlist_entries')
        .select(`*, availability_slots (*)`)
        .in('slot_id', slotIds)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as (WaitlistEntry & { availability_slots: any })[];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

// Update booking status for owned slots
export function useOwnerUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['owner-lottery-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['user-owned-slots'] });
    },
  });
}