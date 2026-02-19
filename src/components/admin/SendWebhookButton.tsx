import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendWebhookButtonProps {
  slotId: string;
  slotName: string;
}

export function SendWebhookButton({ slotId, slotName }: SendWebhookButtonProps) {
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-webhook', {
        body: { slotId },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.success) {
        const msg = `Sent ${data.sent_count} participant(s) to bill splitter.`;
        const excluded = data.excluded_count > 0
          ? ` ${data.excluded_count} participant(s) excluded (no consent).`
          : '';
        toast.success(msg + excluded);
      } else {
        toast.error('Webhook call failed. Check your webhook URL.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send webhook');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSend}
      disabled={isSending}
      title={`Send ${slotName} participants to bill splitter`}
    >
      {isSending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      Bill Split
    </Button>
  );
}
