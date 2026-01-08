import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface DateAvailability {
  date: string;
  hasAvailability: boolean;
}

export function useMonthAvailability(month: Date) {
  const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['month-availability', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('date, total_tables, booked_tables')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      // Aggregate by date: check if any slot has availability
      const availabilityByDate = new Map<string, boolean>();
      
      data?.forEach((slot) => {
        const hasOpenSlot = slot.booked_tables < slot.total_tables;
        if (hasOpenSlot) {
          availabilityByDate.set(slot.date, true);
        } else if (!availabilityByDate.has(slot.date)) {
          availabilityByDate.set(slot.date, false);
        }
      });

      return availabilityByDate;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}
