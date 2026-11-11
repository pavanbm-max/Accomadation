-- =============================================================================
-- Migration: Fix registrations RLS policies to allow paid_at_desk and ensure search_path
-- Description:
-- 1. Updates is_staff() and is_admin() to explicitly set search_path = public.
-- 2. Updates registrations INSERT RLS policy to include 'paid_at_desk' in allowed statuses.
-- 3. Updates registrations UPDATE RLS policy to permit desk walk-in records and staff updates.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'volunteer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Registrations INSERT policy
DROP POLICY IF EXISTS "Public and staff can insert registrations" ON public.registrations;

CREATE POLICY "Public and staff can insert registrations"
ON public.registrations
FOR INSERT
WITH CHECK (
  is_staff() OR (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'under_review'::text, 'paid_at_desk'::text]))
);

-- Registrations UPDATE policy
DROP POLICY IF EXISTS "Staff and public can update registrations" ON public.registrations;

CREATE POLICY "Staff and public can update registrations"
ON public.registrations
FOR UPDATE
USING (
  is_staff() OR (payment_status = ANY (ARRAY['pending'::text, 'under_review'::text, 'failed'::text, 'paid_at_desk'::text]))
);
