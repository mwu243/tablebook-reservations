-- Add name and description columns to availability_slots
ALTER TABLE public.availability_slots 
ADD COLUMN name text NOT NULL DEFAULT 'Available Table',
ADD COLUMN description text;