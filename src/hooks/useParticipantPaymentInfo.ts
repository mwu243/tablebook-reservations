import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ParticipantPaymentInfo {
  booking_id: string;
  customer_name: string;
  customer_email: string;
  party_size: number;
  venmo_username: string | null;
  zelle_identifier: string | null;
  dietary_restrictions: string | null;
}

export function useParticipantPaymentInfo(slotId: string | null) {
  return useQuery({
    queryKey: ['participant-payment-info', slotId],
    queryFn: async () => {
      if (!slotId) return [];

      const { data, error } = await supabase
        .rpc('get_participant_payment_info', { p_slot_id: slotId });

      if (error) throw error;
      return data as ParticipantPaymentInfo[];
    },
    enabled: !!slotId,
  });
}
