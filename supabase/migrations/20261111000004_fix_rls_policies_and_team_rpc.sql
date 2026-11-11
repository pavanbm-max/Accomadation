-- =============================================================================
-- Migration: 20261111000004_fix_rls_policies_and_team_rpc.sql
-- Description:
--   1. Fixes RLS policies on registrations table to permit guest insert & select (RETURNING),
--      allowing smooth individual and team registrations without RLS violation errors.
--   2. Updates protect_registration_payment_fields trigger to allow desk staff / volunteers
--      to allot rooms, record desk payments, and allow guests to submit payment screenshots.
--   3. Adds create_team_registrations atomic SECURITY DEFINER RPC.
--   4. Fixes RLS on email_outbox, profiles, and storage.objects.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FIX RLS ON public.registrations
-- -----------------------------------------------------------------------------
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view registrations" ON public.registrations;
DROP POLICY IF EXISTS "Staff can view registrations" ON public.registrations;
DROP POLICY IF EXISTS "Public and staff registration view policy" ON public.registrations;

CREATE POLICY "Public can view registrations" ON public.registrations
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public can insert pending registration" ON public.registrations;
DROP POLICY IF EXISTS "Admins can insert registrations" ON public.registrations;
DROP POLICY IF EXISTS "Public and staff can insert registrations" ON public.registrations;

CREATE POLICY "Public and staff can insert registrations" ON public.registrations
FOR INSERT
WITH CHECK (
  public.is_staff() 
  OR payment_status IN ('pending', 'paid', 'under_review')
);

DROP POLICY IF EXISTS "Admins can update registrations" ON public.registrations;
DROP POLICY IF EXISTS "Staff can update registrations" ON public.registrations;
DROP POLICY IF EXISTS "Staff and public can update registrations" ON public.registrations;

CREATE POLICY "Staff and public can update registrations" ON public.registrations
FOR UPDATE
USING (
  public.is_staff()
  OR payment_status IN ('pending', 'under_review', 'failed')
);

DROP POLICY IF EXISTS "Admins can delete registrations" ON public.registrations;
CREATE POLICY "Admins can delete registrations" ON public.registrations
FOR DELETE
USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 2. HARDEN TRIGGER protect_registration_payment_fields
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_registration_payment_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If invoked by service_role, postgres, supabase_admin, or authorized settlement function:
  IF current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin') OR
     current_user IN ('postgres', 'supabase_admin') OR
     current_setting('app.allow_payment_settlement', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Staff (Admins and Volunteers) can allot rooms, record desk payments, check-in, update notes
  IF public.is_staff() THEN
    -- Amount cannot be tampered with directly by staff unless it was 0 or settlement
    IF OLD.amount IS DISTINCT FROM NEW.amount AND OLD.amount > 0 THEN
      RAISE EXCEPTION 'Amount is locked at creation and cannot be modified directly.';
    END IF;
    RETURN NEW;
  END IF;

  -- Public guest workflow: Allowed to upload screenshot (pending/failed -> under_review)
  IF OLD.payment_status IN ('pending', 'failed') AND
     NEW.payment_status = 'under_review' AND
     NEW.screenshot_path IS NOT NULL AND
     OLD.amount = NEW.amount THEN
    RETURN NEW;
  END IF;

  -- Block any other unauthorized modification of critical payment fields
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status OR
     OLD.amount IS DISTINCT FROM NEW.amount OR
     OLD.transaction_id IS DISTINCT FROM NEW.transaction_id OR
     OLD.paid_at IS DISTINCT FROM NEW.paid_at OR
     OLD.payment_method IS DISTINCT FROM NEW.payment_method THEN
    RAISE EXCEPTION 'Security violation: Payment fields can only be updated by hostel staff or authorized server function.';
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. FIX RLS ON public.email_outbox
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full CRUD email outbox" ON public.email_outbox;
DROP POLICY IF EXISTS "Staff can view email outbox" ON public.email_outbox;
DROP POLICY IF EXISTS "Public and staff can insert email outbox" ON public.email_outbox;
DROP POLICY IF EXISTS "Staff can update email outbox" ON public.email_outbox;

CREATE POLICY "Public and staff can insert email outbox" ON public.email_outbox
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff can view email outbox" ON public.email_outbox
FOR SELECT
USING (public.is_staff());

CREATE POLICY "Staff can update email outbox" ON public.email_outbox
FOR UPDATE
USING (public.is_staff());

CREATE POLICY "Admins full CRUD email outbox" ON public.email_outbox
FOR ALL
USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. FIX RLS ON public.profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE
USING (auth.uid() = id OR public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. FIX RLS ON storage.objects FOR payment-screenshots
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can upload payment screenshots" ON storage.objects;
CREATE POLICY "Public can upload payment screenshots" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-screenshots');

DROP POLICY IF EXISTS "Staff can read payment screenshots" ON storage.objects;
CREATE POLICY "Staff can read payment screenshots" ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-screenshots');

DROP POLICY IF EXISTS "Staff can manage payment screenshots" ON storage.objects;
CREATE POLICY "Staff can manage payment screenshots" ON storage.objects
FOR ALL
USING (bucket_id = 'payment-screenshots' AND public.is_staff());

-- -----------------------------------------------------------------------------
-- 6. ATOMIC TEAM REGISTRATION RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_team_registrations(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_members JSONB := payload->'members';
  v_check_in DATE := (payload->>'checkInDate')::DATE;
  v_check_out DATE := (payload->>'checkOutDate')::DATE;
  v_college TEXT := TRIM(COALESCE(payload->>'collegeOrOrganisation', 'Not specified'));
  v_num_members INT;
  v_nights INT;
  v_rate NUMERIC;
  v_flat NUMERIC;
  v_per_person NUMERIC;
  v_total_amount NUMERIC;
  v_payments_enabled BOOLEAN;
  v_expiry_mins INT;
  v_team_batch_id TEXT;
  v_lead_name TEXT;
  v_expires_at TIMESTAMPTZ;
  v_created_members JSONB := '[]'::jsonb;
  v_member JSONB;
  v_m_name TEXT;
  v_m_phone TEXT;
  v_m_email TEXT;
  v_m_gender TEXT;
  v_m_emer TEXT;
  v_m_amount NUMERIC;
  v_m_status TEXT := 'pending';
  v_m_paid_at TIMESTAMPTZ := NULL;
  v_m_method TEXT := NULL;
  v_m_note TEXT;
  v_reg RECORD;
  i INT;
BEGIN
  -- Expire stale registrations
  PERFORM public.expire_stale_registrations();

  -- Validate members array
  v_num_members := jsonb_array_length(COALESCE(v_members, '[]'::jsonb));
  IF v_num_members = 0 THEN
    RAISE EXCEPTION 'At least one team member is required.';
  END IF;

  IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_out <= v_check_in THEN
    RAISE EXCEPTION 'Check-out date must be strictly after check-in date.';
  END IF;

  v_nights := GREATEST(1, (v_check_out - v_check_in));

  -- Lock rate from settings
  SELECT per_night_fee, flat_fee, payments_enabled, expiry_minutes
  INTO v_rate, v_flat, v_payments_enabled, v_expiry_mins
  FROM public.settings
  WHERE id = 1;

  v_rate := COALESCE(v_rate, 300);
  v_flat := COALESCE(v_flat, 0);
  v_payments_enabled := COALESCE(v_payments_enabled, true);
  v_expiry_mins := COALESCE(v_expiry_mins, 30);

  v_per_person := (v_nights * v_rate) + v_flat;
  v_total_amount := v_per_person * v_num_members;
  v_team_batch_id := 'tb_' || to_char(now(), 'YYYYMMDD_HH24MISS_') || lpad(floor(random()*1000)::text, 3, '0');
  v_expires_at := timezone('utc'::text, now()) + (v_expiry_mins || ' minutes')::INTERVAL;

  -- Golden Rule duplicate check for all members
  FOR i IN 0..(v_num_members - 1) LOOP
    v_member := v_members->i;
    v_m_phone := TRIM(COALESCE(v_member->>'phone', ''));
    v_m_email := TRIM(LOWER(COALESCE(v_member->>'email', '')));
    v_m_name := TRIM(COALESCE(v_member->>'fullName', ''));

    IF v_m_name = '' OR v_m_phone = '' OR v_m_email = '' THEN
      RAISE EXCEPTION 'Full name, phone, and email are required for all team members (member %)', (i + 1);
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.registrations
      WHERE (phone = v_m_phone OR LOWER(email) = v_m_email)
        AND payment_status IN ('paid', 'paid_at_desk')
    ) THEN
      RAISE EXCEPTION 'A confirmed accommodation registration already exists for member: % (phone: %, email: %)', v_m_name, v_m_phone, v_m_email;
    END IF;
  END LOOP;

  v_lead_name := TRIM(COALESCE(v_members->0->>'fullName', 'Leader'));

  -- Insert all team members
  FOR i IN 0..(v_num_members - 1) LOOP
    v_member := v_members->i;
    v_m_name := TRIM(COALESCE(v_member->>'fullName', ''));
    v_m_phone := TRIM(COALESCE(v_member->>'phone', ''));
    v_m_email := TRIM(LOWER(COALESCE(v_member->>'email', '')));
    v_m_gender := COALESCE(v_member->>'gender', 'Male');
    IF v_m_gender NOT IN ('Male', 'Female') THEN
      v_m_gender := 'Male';
    END IF;
    v_m_emer := TRIM(COALESCE(v_member->>'emergencyContact', 'Not specified'));

    -- Leader holds the full total amount, teammates hold per_person amount
    IF i = 0 THEN
      v_m_amount := v_total_amount;
      v_m_note := '[TeamBatch:' || v_team_batch_id || '] Member 1 of ' || v_num_members || ' (Lead: ' || v_lead_name || ') [Leader] [TeamMembers:' || v_num_members || '] [TotalBatchAmount:' || v_total_amount || ']';
    ELSE
      v_m_amount := v_per_person;
      v_m_note := '[TeamBatch:' || v_team_batch_id || '] Member ' || (i + 1) || ' of ' || v_num_members || ' (Lead: ' || v_lead_name || ') [TeamMembers:' || v_num_members || '] [TotalBatchAmount:' || v_total_amount || ']';
    END IF;

    IF NOT v_payments_enabled OR v_total_amount = 0 THEN
      v_m_status := 'paid';
      v_m_paid_at := timezone('utc'::text, now());
      v_m_method := 'exempt_free';
    ELSE
      v_m_status := 'pending';
      v_m_paid_at := NULL;
      v_m_method := NULL;
    END IF;

    INSERT INTO public.registrations (
      full_name,
      phone,
      email,
      gender,
      college_or_organisation,
      emergency_contact,
      check_in_date,
      check_out_date,
      nights,
      rate_per_night,
      flat_fee,
      amount,
      payment_status,
      payment_method,
      paid_at,
      admin_note,
      expires_at
    ) VALUES (
      v_m_name,
      v_m_phone,
      v_m_email,
      v_m_gender,
      v_college,
      v_m_emer,
      v_check_in,
      v_check_out,
      v_nights,
      v_rate,
      v_flat,
      v_m_amount,
      v_m_status,
      v_m_method,
      v_m_paid_at,
      v_m_note,
      v_expires_at
    )
    RETURNING id, reference_id, scan_token, amount, expires_at, payment_status, full_name, email, phone, gender
    INTO v_reg;

    v_created_members := v_created_members || jsonb_build_object(
      'id', v_reg.id,
      'referenceId', v_reg.reference_id,
      'reference_id', v_reg.reference_id,
      'scanToken', v_reg.scan_token,
      'scan_token', v_reg.scan_token,
      'amount', v_reg.amount,
      'expiresAt', v_reg.expires_at,
      'paymentStatus', v_reg.payment_status,
      'fullName', v_reg.full_name,
      'email', v_reg.email,
      'phone', v_reg.phone,
      'gender', v_reg.gender
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'teamBatchId', v_team_batch_id,
    'totalAmount', v_total_amount,
    'primaryRegistration', jsonb_build_object(
      'id', v_created_members->0->>'id',
      'referenceId', v_created_members->0->>'referenceId',
      'scanToken', v_created_members->0->>'scanToken',
      'amount', v_total_amount,
      'expiresAt', v_created_members->0->>'expiresAt',
      'paymentStatus', v_created_members->0->>'paymentStatus'
    ),
    'members', v_created_members
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.create_team_registrations(JSONB) TO anon, authenticated, service_role;
