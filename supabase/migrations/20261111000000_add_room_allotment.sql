-- =============================================================================
-- MIGRATION: Add room_number to registrations
-- =============================================================================

ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS room_number TEXT;

COMMENT ON COLUMN public.registrations.room_number IS 'Allotted hostel room or bed number (e.g. Room 204, Block A)';
