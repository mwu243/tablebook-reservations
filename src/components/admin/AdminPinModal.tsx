import { useState } from 'react';
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
import { Lock, ShieldAlert } from 'lucide-react';

interface AdminPinModalProps {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

const ADMIN_PIN = '2027';

export function AdminPinModal({ open, onSuccess, onCancel }: AdminPinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin === ADMIN_PIN) {
      setPin('');
      setError(false);
      setAttempts(0);
      onSuccess();
    } else {
      setError(true);
      setAttempts(prev => prev + 1);
      setPin('');
    }
  };

  const handleCancel = () => {
    setPin('');
    setError(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Admin Access Required
          </DialogTitle>
          <DialogDescription>
            Enter the admin PIN to access the dashboard.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">Admin PIN</Label>
            <Input
              id="pin"
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              className={error ? 'border-destructive' : ''}
              autoFocus
              maxLength={10}
            />
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4" />
                Incorrect PIN. {attempts >= 3 ? 'Please try again later.' : 'Please try again.'}
              </p>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!pin || attempts >= 5}>
              Unlock
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
