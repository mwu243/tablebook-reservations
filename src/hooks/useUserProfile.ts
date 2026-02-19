import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  venmo_username: string | null;
  zelle_identifier: string | null;
  payment_sharing_consent: boolean;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useUserProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as UserProfile | null;
    },
    enabled: !!user?.id,
  });
}

interface CreateProfileInput {
  user_id: string;
  display_name?: string | null;
  venmo_username?: string | null;
  zelle_identifier?: string | null;
}

export function useCreateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProfileInput) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-profile', data.user_id], data);
    },
  });
}

interface UpdateProfileInput {
  display_name?: string | null;
  venmo_username?: string | null;
  zelle_identifier?: string | null;
  payment_sharing_consent?: boolean;
  webhook_url?: string | null;
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_profiles')
        .update(input)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-profile', data.user_id], data);
    },
  });
}
