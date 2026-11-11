-- =============================================================================
-- MIGRATION: Database Hardening, Search Path Sanitization & Redundancy Cleanup
-- =============================================================================

-- 1. Drop redundant duplicate index on scan_token (covered by unique constraint registrations_scan_token_key)
DROP INDEX IF EXISTS public.registrations_scan_token_idx;

-- 2. Drop duplicate RLS policy on settings
DROP POLICY IF EXISTS "Public read settings" ON public.settings;

-- 3. Drop duplicate RLS policy on announcements
DROP POLICY IF EXISTS "Public can view published announcements" ON public.announcements;

-- 4. Add missing staff view policy on email_outbox
DROP POLICY IF EXISTS "Staff can view email outbox" ON public.email_outbox;
CREATE POLICY "Staff can view email outbox" ON public.email_outbox 
FOR SELECT 
USING (public.is_staff());

-- 5. Harden protect_registration_payment_fields trigger function with explicit search_path
CREATE OR REPLACE FUNCTION public.protect_registration_payment_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If invoked by service_role, allow updates
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If user is admin, allow status changes and notes, but never arbitrary tampering of locked amount
  IF public.is_admin() THEN
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      RAISE EXCEPTION 'Amount is locked at creation and cannot be changed directly.';
    END IF;
    RETURN NEW;
  END IF;

  -- For any non-admin / non-service_role caller:
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status OR
     OLD.amount IS DISTINCT FROM NEW.amount OR
     OLD.transaction_id IS DISTINCT FROM NEW.transaction_id OR
     OLD.paid_at IS DISTINCT FROM NEW.paid_at OR
     OLD.payment_method IS DISTINCT FROM NEW.payment_method THEN
    RAISE EXCEPTION 'Security violation: Payment fields can only be updated by the server or an administrator.';
  END IF;

  RETURN NEW;
END;
$$;
