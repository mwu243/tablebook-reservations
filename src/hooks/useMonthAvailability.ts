import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface DateAvailability {
  date: string;
  count: number;
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

      // Aggregate by date: count how many slots have availability
      const availabilityCountByDate = new Map<string, number>();
      
      data?.forEach((slot) => {
        const hasOpenSlot = slot.booked_tables < slot.total_tables;
        if (hasOpenSlot) {
          const currentCount = availabilityCountByDate.get(slot.date) || 0;
          availabilityCountByDate.set(slot.date, currentCount + 1);
        }
      });

      return availabilityCountByDate;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}
