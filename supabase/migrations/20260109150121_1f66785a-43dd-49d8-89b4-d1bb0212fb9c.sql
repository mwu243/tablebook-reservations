-- Drop the existing check constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Add a new check constraint that includes all valid statuses
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('confirmed', 'pending_lottery', 'cancelled', 'rejected'));