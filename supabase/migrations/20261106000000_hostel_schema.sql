-- =============================================================================
-- Migration: Hostel Accommodation Registration System
-- Includes: Tables, Sequences, Constraints, Triggers, RLS, Storage & Helpers
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequence for human-readable reference IDs: HST-2026-000001
CREATE SEQUENCE IF NOT EXISTS registration_ref_seq START WITH 101 INCREMENT BY 1;

-- 1. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'volunteer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. SETTINGS TABLE (Single-row configuration)
CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  per_night_fee NUMERIC NOT NULL DEFAULT 300,
  flat_fee NUMERIC NOT NULL DEFAULT 0,
  payments_enabled BOOLEAN NOT NULL DEFAULT true,
  expiry_minutes INT NOT NULL DEFAULT 30,
  refund_policy_text TEXT NOT NULL DEFAULT 'Cancellations and refunds are processed at hostel administration discretion. Please present your reference ID at the accommodation desk.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id TEXT UNIQUE NOT NULL,
  scan_token TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  gender TEXT,
  college_or_organisation TEXT,
  emergency_contact TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INT NOT NULL CHECK (nights > 0),
  rate_per_night NUMERIC NOT NULL CHECK (rate_per_night >= 0),
  flat_fee NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    payment_status IN (
      'pending',
      'paid',
      'failed',
      'expired',
      'under_review',
      'refunded',
      'paid_at_desk'
    )
  ),
  payment_method TEXT,
  transaction_id TEXT,
  gateway_order_id TEXT,
  paid_at TIMESTAMPTZ,
  admin_note TEXT,
  refund_reason TEXT,
  screenshot_path TEXT,
  screenshot_review_reason TEXT,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 4. ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. EMAIL_OUTBOX TABLE
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('confirmation', 'refund', 'other')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- INDEXES & CONSTRAINTS (PART 1 & 2: THE GOLDEN RULE)
-- Partial unique indexes ensure only PAID registrations block duplicates.
-- Pending, failed, expired, under_review and refunded NEVER block duplicate registrations.
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS registrations_paid_phone_idx 
  ON public.registrations (phone) 
  WHERE payment_status IN ('paid', 'paid_at_desk');

CREATE UNIQUE INDEX IF NOT EXISTS registrations_paid_email_idx 
  ON public.registrations (lower(email)) 
  WHERE payment_status IN ('paid', 'paid_at_desk');

CREATE INDEX IF NOT EXISTS registrations_scan_token_idx 
  ON public.registrations (scan_token);

CREATE INDEX IF NOT EXISTS registrations_payment_status_idx 
  ON public.registrations (payment_status);

CREATE INDEX IF NOT EXISTS registrations_created_at_idx 
  ON public.registrations (created_at DESC);

-- =============================================================================
-- HELPER FUNCTIONS FOR ROLES
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'volunteer')
  );
$$;

-- =============================================================================
-- EXPIRY MANAGEMENT
-- Stale pending registrations past expires_at are marked expired.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.expire_stale_registrations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.registrations
  SET payment_status = 'expired'
  WHERE payment_status = 'pending'
    AND expires_at < timezone('utc'::text, now());
    
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- Trigger to auto-generate reference_id if not supplied
CREATE OR REPLACE FUNCTION public.set_registration_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq INT;
BEGIN
  IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
    SELECT nextval('registration_ref_seq') INTO v_seq;
    NEW.reference_id := 'HST-2026-' || LPAD(v_seq::text, 6, '0');
  END IF;

  IF NEW.scan_token IS NULL OR NEW.scan_token = '' THEN
    NEW.scan_token := encode(gen_random_bytes(24), 'hex');
  END IF;

  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + INTERVAL '30 minutes';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_registration_defaults ON public.registrations;
CREATE TRIGGER trg_set_registration_defaults
  BEFORE INSERT ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_registration_defaults();

-- =============================================================================
-- GOLDEN RULE SECURITY TRIGGER:
-- Block any client-side modification of payment_status, amount, transaction_id,
-- or paid_at unless caller is an admin or service_role!
-- =============================================================================
CREATE OR REPLACE FUNCTION public.protect_registration_payment_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trg_protect_registration_payment_fields ON public.registrations;
CREATE TRIGGER trg_protect_registration_payment_fields
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_registration_payment_fields();

-- =============================================================================
-- DATABASE FUNCTION: CHECK-IN
-- ENFORCES: Check-in is impossible unless paid (paid or paid_at_desk).
-- Records checked_in_at and checked_in_by.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_in_registration(p_scan_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg RECORD;
  v_staff_name TEXT;
  v_clean_token TEXT;
BEGIN
  -- Verify caller is staff (admin or volunteer)
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only staff or volunteers can perform check-in.';
  END IF;

  v_clean_token := TRIM(p_scan_token);

  -- Expire stale pending registrations first
  PERFORM public.expire_stale_registrations();

  -- Fetch registration by scan_token OR reference_id
  SELECT * INTO v_reg
  FROM public.registrations
  WHERE scan_token = v_clean_token OR reference_id = v_clean_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found for token or reference ID.';
  END IF;

  -- Enforce Golden Rule
  IF v_reg.payment_status NOT IN ('paid', 'paid_at_desk') THEN
    IF v_reg.payment_status = 'refunded' THEN
      RAISE EXCEPTION 'Check-in blocked: Registration has been refunded.';
    ELSE
      RAISE EXCEPTION 'Payment not completed. Check-in not allowed. Current status: %', v_reg.payment_status;
    END IF;
  END IF;

  -- Check if already checked in
  IF v_reg.checked_in_at IS NOT NULL THEN
    SELECT full_name INTO v_staff_name FROM public.profiles WHERE id = v_reg.checked_in_by;
    RETURN jsonb_build_object(
      'success', false,
      'already_checked_in', true,
      'checked_in_at', v_reg.checked_in_at,
      'checked_in_by_name', COALESCE(v_staff_name, 'Staff Member'),
      'reference_id', v_reg.reference_id,
      'full_name', v_reg.full_name
    );
  END IF;

  -- Record check-in
  UPDATE public.registrations
  SET
    checked_in_at = timezone('utc'::text, now()),
    checked_in_by = auth.uid()
  WHERE id = v_reg.id;

  SELECT full_name INTO v_staff_name FROM public.profiles WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'already_checked_in', false,
    'checked_in_at', timezone('utc'::text, now()),
    'checked_in_by_name', COALESCE(v_staff_name, 'Staff Member'),
    'reference_id', v_reg.reference_id,
    'full_name', v_reg.full_name
  );
END;
$$;

-- =============================================================================
-- PUBLIC RPCs: Safe data access for unauthenticated guests
-- =============================================================================

-- 1. Public Settings
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (
  per_night_fee NUMERIC,
  flat_fee NUMERIC,
  payments_enabled BOOLEAN,
  expiry_minutes INT,
  refund_policy_text TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    per_night_fee,
    flat_fee,
    payments_enabled,
    expiry_minutes,
    refund_policy_text
  FROM public.settings
  WHERE id = 1;
$$;

-- 2. Public Registration Lookup by scan_token OR reference_id
CREATE OR REPLACE FUNCTION public.get_public_registration(p_scan_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg RECORD;
  v_clean TEXT;
BEGIN
  PERFORM public.expire_stale_registrations();
  v_clean := TRIM(p_scan_token);

  SELECT 
    id,
    reference_id,
    scan_token,
    full_name,
    email,
    phone,
    gender,
    college_or_organisation,
    check_in_date,
    check_out_date,
    nights,
    rate_per_night,
    flat_fee,
    amount,
    payment_status,
    payment_method,
    transaction_id,
    paid_at,
    screenshot_path,
    screenshot_review_reason,
    created_at,
    expires_at
  INTO v_reg
  FROM public.registrations
  WHERE scan_token = v_clean OR reference_id = v_clean;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_reg.id,
    'reference_id', v_reg.reference_id,
    'scan_token', v_reg.scan_token,
    'full_name', v_reg.full_name,
    'email', v_reg.email,
    'phone', v_reg.phone,
    'gender', v_reg.gender,
    'college_or_organisation', v_reg.college_or_organisation,
    'check_in_date', v_reg.check_in_date,
    'check_out_date', v_reg.check_out_date,
    'nights', v_reg.nights,
    'rate_per_night', v_reg.rate_per_night,
    'flat_fee', v_reg.flat_fee,
    'amount', v_reg.amount,
    'payment_status', v_reg.payment_status,
    'payment_method', v_reg.payment_method,
    'transaction_id', v_reg.transaction_id,
    'paid_at', v_reg.paid_at,
    'screenshot_path', v_reg.screenshot_path,
    'screenshot_review_reason', v_reg.screenshot_review_reason,
    'created_at', v_reg.created_at,
    'expires_at', v_reg.expires_at,
    'is_paid', v_reg.payment_status IN ('paid', 'paid_at_desk')
  );
END;
$$;

-- 3. Admin Dashboard Statistics RPC
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_total_collected NUMERIC;
  v_paid_count INT;
  v_unpaid_count INT;
  v_under_review_count INT;
  v_refunded_count INT;
BEGIN
  -- Total collected: only paid and paid_at_desk count
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_total_collected, v_paid_count
  FROM public.registrations
  WHERE payment_status IN ('paid', 'paid_at_desk');

  SELECT COUNT(*)
  INTO v_unpaid_count
  FROM public.registrations
  WHERE payment_status IN ('pending', 'failed', 'expired');

  SELECT COUNT(*)
  INTO v_under_review_count
  FROM public.registrations
  WHERE payment_status = 'under_review';

  SELECT COUNT(*)
  INTO v_refunded_count
  FROM public.registrations
  WHERE payment_status = 'refunded';

  RETURN jsonb_build_object(
    'total_collected', v_total_collected,
    'paid_count', v_paid_count,
    'unpaid_count', v_unpaid_count,
    'under_review_count', v_under_review_count,
    'refunded_count', v_refunded_count
  );
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- --- PROFILES POLICIES ---
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Staff can read all profiles" ON public.profiles;
CREATE POLICY "Staff can read all profiles" ON public.profiles FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Admins have full CRUD on profiles" ON public.profiles;
CREATE POLICY "Admins have full CRUD on profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- --- SETTINGS POLICIES ---
DROP POLICY IF EXISTS "Public read settings" ON public.settings;
CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;
CREATE POLICY "Admins can update settings" ON public.settings FOR UPDATE USING (public.is_admin());

-- --- ANNOUNCEMENTS POLICIES ---
DROP POLICY IF EXISTS "Public read published announcements" ON public.announcements;
CREATE POLICY "Public read published announcements" ON public.announcements FOR SELECT USING (is_published = true OR public.is_staff());

DROP POLICY IF EXISTS "Admins full CRUD announcements" ON public.announcements;
CREATE POLICY "Admins full CRUD announcements" ON public.announcements FOR ALL USING (public.is_admin());

-- --- REGISTRATIONS POLICIES ---
DROP POLICY IF EXISTS "Staff can view registrations" ON public.registrations;
CREATE POLICY "Staff can view registrations" ON public.registrations FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can update registrations" ON public.registrations;
CREATE POLICY "Admins can update registrations" ON public.registrations FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert registrations" ON public.registrations;
CREATE POLICY "Admins can insert registrations" ON public.registrations FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete registrations" ON public.registrations;
CREATE POLICY "Admins can delete registrations" ON public.registrations FOR DELETE USING (public.is_admin());

-- --- EMAIL_OUTBOX POLICIES ---
DROP POLICY IF EXISTS "Staff can view email outbox" ON public.email_outbox;
CREATE POLICY "Staff can view email outbox" ON public.email_outbox FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Admins full CRUD email outbox" ON public.email_outbox;
CREATE POLICY "Admins full CRUD email outbox" ON public.email_outbox FOR ALL USING (public.is_admin());

-- =============================================================================
-- STORAGE: payment-screenshots private bucket
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-screenshots',
  'payment-screenshots',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- Storage RLS:
DROP POLICY IF EXISTS "Staff can read payment screenshots" ON storage.objects;
CREATE POLICY "Staff can read payment screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'payment-screenshots' AND public.is_staff());
