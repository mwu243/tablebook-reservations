-- Drop the existing foreign key constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_slot_id_fkey;

-- Re-add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE public.bookings 
  ADD CONSTRAINT bookings_slot_id_fkey 
  FOREIGN KEY (slot_id) 
  REFERENCES public.availability_slots(id) 
  ON DELETE CASCADE;