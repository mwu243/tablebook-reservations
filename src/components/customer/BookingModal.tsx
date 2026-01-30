import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Loader2, Shuffle, Ticket, PartyPopper, Users, AlertCircle, LogIn, Pencil, User, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AvailabilitySlot } from '@/lib/types';
import { useBookSlot } from '@/hooks/useAvailabilitySlots';
import { useJoinWaitlist } from '@/hooks/useWaitlist';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSlotBooking } from '@/hooks/useUserSlotBooking';
import { useCreateUserProfile, useUserProfile } from '@/hooks/useUserProfile';
import { useLastCustomerName } from '@/hooks/useLastCustomerName';
import { useAuthUser } from '@/hooks/useAuthUser';
import { supabase } from '@/integrations/supabase/client';

interface BookingModalProps {
  slot: AvailabilitySlot | null;
  partySize: number;
  onClose: () => void;
  isWaitlist?: boolean;
}

export function BookingModal({ slot, partySize, onClose, isWaitlist = false }: BookingModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: authUser } = useAuthUser();
  const effectiveUser = authUser ?? user;
  const { data: userProfile, isLoading: profileLoading } = useUserProfile();
  const createProfile = useCreateUserProfile();
  const { data: lastCustomerName } = useLastCustomerName();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const prevSlotIdRef = useRef<string | null>(null);
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; type: 'booking' | 'lottery' | 'waitlist' }>({
    open: false,
    type: 'booking',
  });
  const bookSlot = useBookSlot();
  const joinWaitlist = useJoinWaitlist();
  const { data: existingBooking, isLoading: checkingBooking } = useUserSlotBooking(slot?.id ?? null);
  
  const getAuthDisplayName = () => {
    const meta = effectiveUser?.user_metadata as Record<string, unknown> | undefined;
    const candidate =
      (typeof meta?.display_name === 'string' ? meta.display_name : undefined) ||
      (typeof meta?.full_name === 'string' ? meta.full_name : undefined) ||
      (typeof (meta as any)?.fullName === 'string' ? (meta as any).fullName : undefined) ||
      (typeof meta?.name === 'string' ? meta.name : undefined);
    return candidate?.trim() || '';
  };

  const deriveDisplayNameFromEmail = (emailAddress?: string | null) => {
    const emailSafe = (emailAddress ?? '').trim();
    if (!emailSafe) return '';

    const local = emailSafe.split('@')[0] ?? '';
    const words = local
      .replace(/[._-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) return local.trim();

    const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return words.map(titleCase).join(' ');
  };

  const pickFirstNonEmpty = (...candidates: Array<string | null | undefined>) => {
    for (const c of candidates) {
      const v = (c ?? '').trim();
      if (v) return v;
    }
    return '';
  };

  const hasExistingBooking = !!existingBooking;
  const authDisplayName = getAuthDisplayName();
  const profileDisplayName = (userProfile?.display_name ?? '').trim();
  const bookingDisplayName = (lastCustomerName ?? '').trim();
  const derivedEmailName = deriveDisplayNameFromEmail(effectiveUser?.email);
  // NOTE: Don't use `??` here because empty-string values would block later fallbacks.
  // We want: profile -> auth metadata -> last booking -> derived from email.
  const inferredDisplayName = pickFirstNonEmpty(
    profileDisplayName,
    authDisplayName,
    bookingDisplayName,
    derivedEmailName
  );
  // "Trusted" = came from a user-provided source (profile, account metadata, or past booking).
  // Email-derived names are acceptable for pre-fill but shouldn't auto-skip the form.
  const hasTrustedName = !!pickFirstNonEmpty(profileDisplayName, authDisplayName, bookingDisplayName);
  const hasCompleteProfile = hasTrustedName;

  const maybePersistProfile = async (displayName: string) => {
    const userId = effectiveUser?.id;
    if (!userId || userProfile?.id) return;
    const safeName = displayName.trim();
    if (!safeName) return;

    try {
      await createProfile.mutateAsync({
        user_id: userId,
        display_name: safeName,
      });
    } catch {
      // If it already exists (race/duplicate) or policy blocks, ignore — booking still succeeded.
    }
  };

  const maybePersistAuthMetadata = async (displayName: string) => {
    if (!effectiveUser) return;
    const safeName = displayName.trim();
    if (!safeName) return;
    // Avoid extra writes if we already have it in metadata
    if (getAuthDisplayName()) return;

    try {
      await supabase.auth.updateUser({ data: { display_name: safeName, full_name: safeName, name: safeName } });
    } catch {
      // Non-fatal; the booking should still succeed.
    }
  };

  // Pre-fill from user profile and auth when modal opens
  useEffect(() => {
    if (slot) {
      if (prevSlotIdRef.current !== slot.id) {
        prevSlotIdRef.current = slot.id;
        setNameTouched(false);
        setEmailTouched(false);
      }

      // Always try to populate from profile/auth when modal opens
      if (effectiveUser?.email && !emailTouched) {
        setEmail(effectiveUser.email);
      }

      if (!nameTouched) {
        if (inferredDisplayName) setName(inferredDisplayName);
      }
    }
  }, [slot, effectiveUser, inferredDisplayName, nameTouched, emailTouched]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const isLottery = slot?.booking_mode === 'lottery';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = effectiveUser?.id;
    if (!slot || !name.trim() || !email.trim() || !userId || hasExistingBooking) return;

    try {
      if (isWaitlist) {
        await joinWaitlist.mutateAsync({
          slotId: slot.id,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim() || undefined,
          partySize,
          userId,
        });

        await Promise.all([maybePersistProfile(name.trim()), maybePersistAuthMetadata(name.trim())]);
        
        onClose();
        setName('');
        setEmail('');
        setPhone('');
        setSuccessDialog({ open: true, type: 'waitlist' });
      } else {
        await bookSlot.mutateAsync({
          slotId: slot.id,
          customerName: name.trim(),
          customerEmail: email.trim(),
          partySize,
          userId,
          isLottery,
        });

        await Promise.all([maybePersistProfile(name.trim()), maybePersistAuthMetadata(name.trim())]);
        
        onClose();
        setName('');
        setEmail('');
        setPhone('');
        setSuccessDialog({ open: true, type: isLottery ? 'lottery' : 'booking' });
      }
    } catch (error) {
      console.error('Booking failed:', error);
    }
  };

  const handleOneClickBook = async () => {
    const userId = effectiveUser?.id;
    if (!slot || !name.trim() || !email.trim() || !userId || hasExistingBooking) return;

    try {
      if (isWaitlist) {
        await joinWaitlist.mutateAsync({
          slotId: slot.id,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim() || undefined,
          partySize,
          userId,
        });

        await Promise.all([maybePersistProfile(name.trim()), maybePersistAuthMetadata(name.trim())]);
        
        onClose();
        setSuccessDialog({ open: true, type: 'waitlist' });
      } else {
        await bookSlot.mutateAsync({
          slotId: slot.id,
          customerName: name.trim(),
          customerEmail: email.trim(),
          partySize,
          userId,
          isLottery,
        });

        await Promise.all([maybePersistProfile(name.trim()), maybePersistAuthMetadata(name.trim())]);
        
        onClose();
        setSuccessDialog({ open: true, type: isLottery ? 'lottery' : 'booking' });
      }
    } catch (error) {
      console.error('Booking failed:', error);
    }
  };

  const handleCloseSuccessDialog = () => {
    setSuccessDialog({ open: false, type: 'booking' });
  };

  if (!slot) return null;

  const isPending = bookSlot.isPending || joinWaitlist.isPending || checkingBooking || profileLoading;

  // Show sign-in prompt if user is not authenticated
  if (!effectiveUser) {
    return (
      <Dialog open={!!slot} onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Sign In Required</DialogTitle>
            <DialogDescription>
              Please sign in or create an account to book this experience.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 rounded-lg bg-muted p-4">
            <p className="font-medium">{slot.name}</p>
            {slot.description && (
              <p className="mt-1 text-sm text-muted-foreground">{slot.description}</p>
            )}
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">
                {formatTime(slot.time)}
                {slot.end_time && ` – ${formatTime(slot.end_time)}`}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Party Size</span>
              <span className="font-medium">{partySize} {partySize === 1 ? 'Guest' : 'Guests'}</span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                onClose();
                navigate('/auth');
              }}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In to Book
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // One-click booking view for users with complete profile
  const showOneClickView = hasCompleteProfile && !isEditing && !hasExistingBooking;

  return (
    <>
      <Dialog open={!!slot} onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {isWaitlist ? 'Join Waitlist' : isLottery ? 'Enter Lottery' : 'Complete Your Reservation'}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 rounded-lg bg-muted p-4">
            <div className="mb-2 flex items-center gap-2">
              {isWaitlist ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  <Users className="h-3 w-3" />
                  Waitlist
                </span>
              ) : isLottery ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  <Shuffle className="h-3 w-3" />
                  Lottery
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  <Ticket className="h-3 w-3" />
                  Instant Booking
                </span>
              )}
            </div>
            <p className="font-medium">{slot.name}</p>
            {slot.description && (
              <p className="mt-1 text-sm text-muted-foreground">{slot.description}</p>
            )}
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">
                {formatTime(slot.time)}
                {slot.end_time && ` – ${formatTime(slot.end_time)}`}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Party Size</span>
              <span className="font-medium">{partySize} {partySize === 1 ? 'Guest' : 'Guests'}</span>
            </div>
          </div>

          {hasExistingBooking ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You already have a reservation for this event. Each person can only book once per event.
              </AlertDescription>
            </Alert>
          ) : isWaitlist ? (
            <p className="text-sm text-muted-foreground">
              This event is currently full. Join the waitlist and you'll be notified if a spot opens up.
            </p>
          ) : isLottery ? (
            <p className="text-sm text-muted-foreground">
              This is a lottery event. Submitting your details enters you for a chance to be selected. You will be notified by email if you win.
            </p>
          ) : null}

          {showOneClickView ? (
            // One-click confirmation view
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Booking as</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <User className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-muted-foreground">{email}</p>
                  </div>
                </div>
              </div>

              {isWaitlist && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                  <p className="text-xs text-muted-foreground">
                    For text notifications when a spot opens up
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-accent hover:bg-accent/90"
                  disabled={isPending}
                  onClick={handleOneClickBook}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isWaitlist ? 'Joining...' : isLottery ? 'Entering...' : 'Booking...'}
                    </>
                  ) : isWaitlist ? (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      Join Waitlist
                    </>
                  ) : isLottery ? (
                    <>
                      <Shuffle className="mr-2 h-4 w-4" />
                      Enter Lottery
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Editable form view (legacy users or when editing)
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setNameTouched(true);
                    setName(e.target.value);
                  }}
                  placeholder="John Smith"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmailTouched(true);
                    setEmail(e.target.value);
                  }}
                  placeholder="john@example.com"
                  required
                />
              </div>
              {isWaitlist && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                  <p className="text-xs text-muted-foreground">
                    For text notifications when a spot opens up
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                {isEditing && hasCompleteProfile && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      // Reset to profile values
                      if (inferredDisplayName) setName(inferredDisplayName);
                      if (effectiveUser?.email) setEmail(effectiveUser.email);
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent/90"
                  disabled={isPending || hasExistingBooking}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isWaitlist ? 'Joining...' : isLottery ? 'Entering...' : 'Booking...'}
                    </>
                  ) : isWaitlist ? (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      Join Waitlist
                    </>
                  ) : isLottery ? (
                    <>
                      <Shuffle className="mr-2 h-4 w-4" />
                      Enter Lottery
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Dialog - Shows after form closes */}
      <AlertDialog open={successDialog.open} onOpenChange={handleCloseSuccessDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              {successDialog.type === 'waitlist' ? (
                <Users className="h-8 w-8 text-success" />
              ) : successDialog.type === 'lottery' ? (
                <Shuffle className="h-8 w-8 text-success" />
              ) : (
                <PartyPopper className="h-8 w-8 text-success" />
              )}
            </div>
            <AlertDialogTitle className="text-xl">
              {successDialog.type === 'waitlist' 
                ? 'You\'re on the Waitlist!' 
                : successDialog.type === 'lottery' 
                  ? 'Fingers Crossed!' 
                  : 'Reservation Confirmed!'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {successDialog.type === 'waitlist'
                ? 'We\'ll notify you by email if a spot opens up.'
                : successDialog.type === 'lottery'
                  ? 'You have been entered into the lottery. Winners will be notified via email.'
                  : 'We look forward to seeing you.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <Button onClick={handleCloseSuccessDialog} className="min-w-32">
              Got it!
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
