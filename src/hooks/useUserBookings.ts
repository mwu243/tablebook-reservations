import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserBooking {
  id: string;
  customer_name: string;
  customer_email: string;
  party_size: number;
  status: string;
  created_at: string;
  availability_slots: {
    id: string;
    date: string;
    time: string;
    end_time: string | null;
    name: string;
    booking_mode: string;
  } | null;
}

export function useUserBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-bookings', user?.id],
    queryFn: async (): Promise<UserBooking[]> => {
      if (!user) return [];

      // Use type assertion to avoid deep type instantiation issues
      const client = supabase as any;

      // Fetch bookings for the current user
      const bookingsResult = await client
        .from('bookings')
        .select('id, customer_name, customer_email, party_size, status, created_at, slot_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (bookingsResult.error) throw bookingsResult.error;
      
      const bookings = bookingsResult.data || [];
      if (bookings.length === 0) return [];

      // Get unique slot IDs
      const slotIds = [...new Set(bookings.map((b: any) => b.slot_id))];

      // Fetch availability slots for these bookings
      const slotsResult = await client
        .from('availability_slots')
        .select('id, date, time, end_time, name, booking_mode')
        .in('id', slotIds);

      if (slotsResult.error) throw slotsResult.error;

      const slotsMap = new Map(
        (slotsResult.data || []).map((slot: any) => [slot.id, slot])
      );

      // Combine bookings with their slots
      return bookings.map((booking: any) => ({
        id: booking.id,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        party_size: booking.party_size,
        status: booking.status,
        created_at: booking.created_at,
        availability_slots: slotsMap.get(booking.slot_id) || null,
      }));
    },
    enabled: !!user,
  });
}
