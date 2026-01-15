-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table to store user roles
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can only view their own roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Drop existing permissive policies on availability_slots
DROP POLICY IF EXISTS "Anyone can create availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Anyone can update availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Anyone can delete availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Anyone can view availability slots" ON public.availability_slots;

-- Create new secure policies for availability_slots
-- Everyone can view (needed for customers to see available slots)
CREATE POLICY "Anyone can view availability slots" 
ON public.availability_slots 
FOR SELECT 
USING (true);

-- Only admins can create slots
CREATE POLICY "Admins can create availability slots" 
ON public.availability_slots 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_admin());

-- Only admins can update slots (except booked_tables which needs separate handling)
CREATE POLICY "Admins can update availability slots" 
ON public.availability_slots 
FOR UPDATE 
TO authenticated
USING (public.is_admin());

-- Only admins can delete slots
CREATE POLICY "Admins can delete availability slots" 
ON public.availability_slots 
FOR DELETE 
TO authenticated
USING (public.is_admin());

-- Create a security definer function to increment booked_tables (for customer bookings)
CREATE OR REPLACE FUNCTION public.increment_booked_tables(slot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_slot RECORD;
BEGIN
  SELECT * INTO current_slot FROM public.availability_slots WHERE id = slot_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;
  
  IF current_slot.booked_tables >= current_slot.total_tables THEN
    RAISE EXCEPTION 'No tables available';
  END IF;
  
  UPDATE public.availability_slots
  SET booked_tables = booked_tables + 1
  WHERE id = slot_id;
END;
$$;

-- Update bookings policy to require authentication for insert
DROP POLICY IF EXISTS "Customers can create bookings" ON public.bookings;

CREATE POLICY "Authenticated users can create bookings" 
ON public.bookings 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for admins (via RPC functions, but also direct for flexibility)
DROP POLICY IF EXISTS "Allow updates via service role only" ON public.bookings;

CREATE POLICY "Admins can update bookings" 
ON public.bookings 
FOR UPDATE 
TO authenticated
USING (public.is_admin());