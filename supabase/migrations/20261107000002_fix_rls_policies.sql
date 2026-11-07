-- =============================================================================
-- FIX RLS POLICIES FOR PUBLIC REGISTRATION & PERMISSIONS
-- =============================================================================

-- 1. Allow public/anon to insert registrations (guest booking)
DROP POLICY IF EXISTS "Public can insert pending registration" ON public.registrations;
CREATE POLICY "Public can insert pending registration" ON public.registrations
FOR INSERT
WITH CHECK (
  payment_status IN ('pending', 'paid')
);

-- 2. Allow public to read registration details (required for checkout & confirmation screens)
DROP POLICY IF EXISTS "Public can view registrations" ON public.registrations;
CREATE POLICY "Public can view registrations" ON public.registrations
FOR SELECT
USING (true);

-- 3. Allow public to read public settings (pricing, fees, expiry)
DROP POLICY IF EXISTS "Public can view settings" ON public.settings;
CREATE POLICY "Public can view settings" ON public.settings
FOR SELECT
USING (true);

-- 4. Allow public to read active announcements
DROP POLICY IF EXISTS "Public can view published announcements" ON public.announcements;
CREATE POLICY "Public can view published announcements" ON public.announcements
FOR SELECT
USING (is_published = true);

-- 5. Grant execute permissions on RPC helpers
GRANT EXECUTE ON FUNCTION public.create_public_registration(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dev_simulate_payment(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_registrations() TO anon, authenticated, service_role;
