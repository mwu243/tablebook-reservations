import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({ open, onOpenChange }: ProfileSettingsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useUserProfile();

  const [displayName, setDisplayName] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [zelleIdentifier, setZelleIdentifier] = useState('');
  const [paymentSharingConsent, setPaymentSharingConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setVenmoUsername(profile.venmo_username ?? '');
      setZelleIdentifier(profile.zelle_identifier ?? '');
      setPaymentSharingConsent(profile.payment_sharing_consent);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          display_name: displayName.trim() || null,
          venmo_username: venmoUsername.trim() || null,
          zelle_identifier: zelleIdentifier.trim() || null,
          payment_sharing_consent: paymentSharingConsent,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] });
      toast.success('Profile updated successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Profile save error:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
          <DialogDescription>
            Manage your display name, payment info, and data sharing preferences.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venmo">Venmo Username</Label>
              <Input
                id="venmo"
                value={venmoUsername}
                onChange={(e) => setVenmoUsername(e.target.value)}
                placeholder="@your-venmo-handle"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zelle">Zelle Email or Phone</Label>
              <Input
                id="zelle"
                value={zelleIdentifier}
                onChange={(e) => setZelleIdentifier(e.target.value)}
                placeholder="email@example.com or phone number"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-1">
                <Label htmlFor="consent" className="text-sm font-medium">
                  Share payment info with hosts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow event hosts to see your Venmo/Zelle for bill splitting
                </p>
              </div>
              <Switch
                id="consent"
                checked={paymentSharingConsent}
                onCheckedChange={setPaymentSharingConsent}
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
