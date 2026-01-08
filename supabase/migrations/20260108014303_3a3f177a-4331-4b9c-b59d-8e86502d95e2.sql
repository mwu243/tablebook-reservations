-- Create availability_slots table
CREATE TABLE public.availability_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  time TIME NOT NULL,
  total_tables INTEGER NOT NULL DEFAULT 1,
  booked_tables INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date, time)
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES public.availability_slots(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size >= 1 AND party_size <= 10),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Since this is a public demo without authentication, allow all operations
-- Availability slots policies
CREATE POLICY "Anyone can view availability slots"
  ON public.availability_slots FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create availability slots"
  ON public.availability_slots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update availability slots"
  ON public.availability_slots FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete availability slots"
  ON public.availability_slots FOR DELETE
  USING (true);

-- Bookings policies
CREATE POLICY "Anyone can view bookings"
  ON public.bookings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update bookings"
  ON public.bookings FOR UPDATE
  USING (true);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;