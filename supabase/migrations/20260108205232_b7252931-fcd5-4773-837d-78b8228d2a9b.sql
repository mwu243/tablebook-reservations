-- Add end_time and booking_mode columns to availability_slots
ALTER TABLE public.availability_slots
ADD COLUMN end_time time without time zone,
ADD COLUMN booking_mode text NOT NULL DEFAULT 'fcfs';

-- Add a check constraint for booking_mode values
ALTER TABLE public.availability_slots
ADD CONSTRAINT booking_mode_check CHECK (booking_mode IN ('fcfs', 'lottery'));