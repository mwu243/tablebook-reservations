import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface UpcomingEventWithHost {
  id: string;
  name: string;
  description: string | null;
  date: string;
  time: string;
  end_time: string | null;
  total_tables: number;
  booked_tables: number;
  booking_mode: string;
  waitlist_enabled: boolean;
  user_id: string | null;
  host_name: string | null;
  location: string | null;
  estimated_cost_per_person: number | null;
}

export function useUpcomingEventsWithHosts(limit = 10) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['upcoming-events-with-hosts', today, limit],
    queryFn: async () => {
      // Fetch upcoming slots
      const { data: slots, error: slotsError } = await supabase
        .from('availability_slots')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(limit);

      if (slotsError) throw slotsError;
      if (!slots || slots.length === 0) return [];

      // Get unique user IDs for hosts
      const hostUserIds = [...new Set(slots.filter(s => s.user_id).map(s => s.user_id))];

      // Fetch host profiles
      let hostProfiles: Map<string, string | null> = new Map();
      
      if (hostUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', hostUserIds);

        if (profiles) {
          profiles.forEach(p => hostProfiles.set(p.user_id, p.display_name));
        }
      }

      // Combine data
      const eventsWithHosts: UpcomingEventWithHost[] = slots.map(slot => ({
        id: slot.id,
        name: slot.name,
        description: slot.description,
        date: slot.date,
        time: slot.time,
        end_time: slot.end_time,
        total_tables: slot.total_tables,
        booked_tables: slot.booked_tables,
        booking_mode: slot.booking_mode,
        waitlist_enabled: slot.waitlist_enabled,
        user_id: slot.user_id,
        host_name: slot.user_id ? hostProfiles.get(slot.user_id) || null : null,
        location: (slot as any).location ?? null,
        estimated_cost_per_person: (slot as any).estimated_cost_per_person ?? null,
      }));

      return eventsWithHosts;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
