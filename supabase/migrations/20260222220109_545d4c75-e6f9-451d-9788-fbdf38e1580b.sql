
ALTER TABLE public.availability_slots
ADD COLUMN location text DEFAULT NULL,
ADD COLUMN estimated_cost_per_person numeric DEFAULT NULL;
