import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { WaitlistEntry } from '@/lib/types';

export function useUserWaitlistEntries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-waitlist-entries', user?.id],
    queryFn: async (): Promise<(WaitlistEntry & { availability_slots: any })[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('waitlist_entries')
        .select(`
          *,
          availability_slots (
            id, date, time, end_time, name, booking_mode
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });
}

export function useJoinWaitlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slotId,
      customerName,
      customerEmail,
      customerPhone,
      partySize,
      userId,
    }: {
      slotId: string;
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      partySize: number;
      userId: string;
    }) => {
      // Get the next position
      const { data: position, error: posError } = await supabase.rpc(
        'get_next_waitlist_position',
        { p_slot_id: slotId }
      );

      if (posError) throw posError;

      const { data, error } = await supabase
        .from('waitlist_entries')
        .insert({
          slot_id: slotId,
          user_id: userId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone || null,
          party_size: partySize,
          position: position || 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Send email notifications (fire and forget - don't block on this)
      supabase.functions.invoke('send-booking-notification', {
        body: {
          slotId,
          customerName,
          customerEmail,
          partySize,
          bookingType: 'waitlist',
        },
      }).then(({ error: notifError }) => {
        if (notifError) {
          console.error('Failed to send waitlist notification:', notifError);
        }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-waitlist-entries'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
    },
  });
}

export function useLeaveWaitlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('waitlist_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-waitlist-entries'] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc('cancel_booking_with_waitlist', {
        p_booking_id: bookingId,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; promoted?: boolean };
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel booking');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
      queryClient.invalidateQueries({ queryKey: ['user-waitlist-entries'] });
    },
  });
}
