import { useState, useEffect } from 'react';
import { Loader2, Link2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUserProfile, useUpdateUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';

interface WebhookSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebhookSettings({ open, onOpenChange }: WebhookSettingsProps) {
  const { data: profile, isLoading } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (profile?.webhook_url) {
      setUrl(profile.webhook_url);
    }
  }, [profile?.webhook_url]);

  const handleSave = async () => {
    const trimmed = url.trim();
    if (trimmed && !trimmed.startsWith('https://')) {
      toast.error('Webhook URL must start with https://');
      return;
    }

    try {
      await updateProfile.mutateAsync({ webhook_url: trimmed || null });
      toast.success('Webhook URL saved');
      onOpenChange(false);
    } catch {
      toast.error('Failed to save webhook URL');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Webhook Settings
          </DialogTitle>
          <DialogDescription>
            Configure the URL where participant data will be sent for bill splitting.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-app.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Must be an HTTPS URL. Only participants who consented to data sharing will be included.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
