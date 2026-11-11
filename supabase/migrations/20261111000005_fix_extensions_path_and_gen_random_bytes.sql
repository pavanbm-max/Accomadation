-- =============================================================================
-- Migration: 20261111000005_fix_extensions_path_and_gen_random_bytes.sql
-- Description:
--   1. Fixes set_registration_defaults trigger function to include extensions in
--      search_path and use extensions.gen_random_bytes(24).
--   2. Updates search_path to public, extensions across all public RPC functions.
--   3. Updates check_in_registration to permit service_role bypass.
-- =============================================================================

-- 1. Fix set_registration_defaults
CREATE OR REPLACE FUNCTION public.set_registration_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_seq INT;
BEGIN
  IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
    SELECT nextval('public.registration_ref_seq') INTO v_seq;
    NEW.reference_id := 'HST-2026-' || LPAD(v_seq::text, 6, '0');
  END IF;

  IF NEW.scan_token IS NULL OR NEW.scan_token = '' THEN
    NEW.scan_token := encode(extensions.gen_random_bytes(24), 'hex');
  END IF;

  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.created_at, timezone('utc'::text, now())) + INTERVAL '30 minutes';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Update create_team_registrations with search_path = public, extensions
CREATE OR REPLACE FUNCTION public.create_team_registrations(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- 3. Update check_in_registration to permit service_role / postgres bypass
CREATE OR REPLACE FUNCTION public.check_in_registration(p_scan_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_reg RECORD;
  v_staff_name TEXT := 'Staff Member';
  v_clean_token TEXT;
  v_user_id UUID;
BEGIN
  IF current_setting('role', true) NOT IN ('service_role', 'postgres', 'supabase_admin') AND
     current_user NOT IN ('postgres', 'supabase_admin') AND
     NOT public.is_staff() THEN
    RAISE EXCEPTION 'Unauthorized: Only staff or volunteers can perform check-in.';
  END IF;

  v_clean_token := TRIM(p_scan_token);
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
    IF v_reg.checked_in_by IS NOT NULL THEN
      SELECT full_name INTO v_staff_name FROM public.profiles WHERE id = v_reg.checked_in_by;
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'already_checked_in', true,
      'checked_in_at', v_reg.checked_in_at,
      'checked_in_by_name', COALESCE(v_staff_name, 'Staff Member'),
      'reference_id', v_reg.reference_id,
      'full_name', v_reg.full_name
    );
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT full_name INTO v_staff_name FROM public.profiles WHERE id = v_user_id;
  END IF;

  -- Record check-in
  UPDATE public.registrations
  SET
    checked_in_at = timezone('utc'::text, now()),
    checked_in_by = v_user_id
  WHERE id = v_reg.id;

  RETURN jsonb_build_object(
    'success', true,
    'already_checked_in', false,
    'checked_in_at', timezone('utc'::text, now()),
    'checked_in_by_name', COALESCE(v_staff_name, 'Hostel Desk'),
    'reference_id', v_reg.reference_id,
    'full_name', v_reg.full_name
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.set_registration_defaults() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_team_registrations(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_in_registration(TEXT) TO anon, authenticated, service_role;
