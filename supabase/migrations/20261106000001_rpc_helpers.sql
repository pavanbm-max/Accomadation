-- =============================================================================
-- MIGRATION: Public Registration & Dev Simulator RPCs (SECURITY DEFINER)
-- Enables instant guest booking & test checkout even before Edge Functions are deployed!
-- =============================================================================

-- 1. Create Guest Registration (Security Definer)
CREATE OR REPLACE FUNCTION public.create_public_registration(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT := TRIM(payload->>'fullName');
  v_phone TEXT := TRIM(payload->>'phone');
  v_email TEXT := TRIM(LOWER(payload->>'email'));
  v_gender TEXT := payload->>'gender';
  v_college TEXT := payload->>'collegeOrOrganisation';
  v_emergency TEXT := payload->>'emergencyContact';
  v_check_in DATE := (payload->>'checkInDate')::DATE;
  v_check_out DATE := (payload->>'checkOutDate')::DATE;
  v_nights INT;
  v_rate NUMERIC;
  v_flat NUMERIC;
  v_amount NUMERIC;
  v_payments_enabled BOOLEAN;
  v_expiry_mins INT;
  v_payment_status TEXT := 'pending';
  v_paid_at TIMESTAMPTZ := NULL;
  v_txn_id TEXT := NULL;
  v_reg public.registrations%ROWTYPE;
BEGIN
  -- Expire stale pending registrations first
  PERFORM public.expire_stale_registrations();

  -- Validation
  IF v_full_name IS NULL OR v_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;
  IF v_phone IS NULL OR v_phone = '' THEN
    RAISE EXCEPTION 'Phone number is required.';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email is required.';
  END IF;
  IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_out <= v_check_in THEN
    RAISE EXCEPTION 'Check-out date must be strictly after check-in date.';
  END IF;

  -- Enforce Golden Rule: Check if a PAID registration already exists for phone or email
  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE (phone = v_phone OR LOWER(email) = v_email)
      AND payment_status IN ('paid', 'paid_at_desk')
  ) THEN
    RAISE EXCEPTION 'A confirmed accommodation registration already exists for this phone or email.';
  END IF;

  -- Calculate nights
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
  v_amount := (v_nights * v_rate) + v_flat;

  -- If payments disabled or amount is 0, auto-mark paid
  IF NOT v_payments_enabled OR v_amount = 0 THEN
    v_payment_status := 'paid';
    v_paid_at := timezone('utc'::text, now());
    v_txn_id := 'TXN_FREE_' || FLOOR(RANDOM() * 899999 + 100000)::TEXT;
  END IF;

  -- Insert registration row
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
    transaction_id,
    paid_at,
    expires_at
  ) VALUES (
    v_full_name,
    v_phone,
    v_email,
    v_gender,
    v_college,
    v_emergency,
    v_check_in,
    v_check_out,
    v_nights,
    v_rate,
    v_flat,
    v_amount,
    v_payment_status,
    v_txn_id,
    v_paid_at,
    timezone('utc'::text, now()) + (v_expiry_mins || ' minutes')::INTERVAL
  )
  RETURNING * INTO v_reg;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_reg.id,
    'referenceId', v_reg.reference_id,
    'scanToken', v_reg.scan_token,
    'amount', v_reg.amount,
    'expiresAt', v_reg.expires_at,
    'paymentStatus', v_reg.payment_status
  );
END;
$$;

-- 2. Dev Simulate Payment (Security Definer)
CREATE OR REPLACE FUNCTION public.dev_simulate_payment(p_scan_token TEXT, p_outcome TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg public.registrations%ROWTYPE;
  v_clean TEXT := TRIM(p_scan_token);
  v_txn TEXT;
BEGIN
  SELECT * INTO v_reg
  FROM public.registrations
  WHERE scan_token = v_clean OR reference_id = v_clean;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found for token or reference ID.';
  END IF;

  IF p_outcome = 'success' THEN
    v_txn := 'SIM_UPI_' || TO_CHAR(timezone('utc'::text, now()), 'YYYYMMDDHH24MISS') || '_' || LPAD(FLOOR(RANDOM()*1000)::TEXT, 3, '0');
    
    UPDATE public.registrations
    SET
      payment_status = 'paid',
      payment_method = 'simulated_upi',
      transaction_id = v_txn,
      paid_at = timezone('utc'::text, now())
    WHERE id = v_reg.id;

    -- Queue confirmation email
    INSERT INTO public.email_outbox (
      registration_id,
      to_email,
      subject,
      body_html,
      type,
      status
    ) VALUES (
      v_reg.id,
      v_reg.email,
      'Hostel Accommodation Confirmed - Ref: ' || v_reg.reference_id,
      'Accommodation Confirmed for ' || v_reg.full_name || '. Booking Ref: ' || v_reg.reference_id || ', Amount Paid: ₹' || v_reg.amount,
      'confirmation',
      'queued'
    ) ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'paid',
      'transactionId', v_txn,
      'referenceId', v_reg.reference_id
    );

  ELSIF p_outcome = 'failure' THEN
    v_txn := 'SIM_FAIL_' || TO_CHAR(timezone('utc'::text, now()), 'YYYYMMDDHH24MISS');
    UPDATE public.registrations
    SET
      payment_status = 'failed',
      transaction_id = v_txn
    WHERE id = v_reg.id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'failed',
      'transactionId', v_txn
    );

  ELSIF p_outcome = 'timeout' THEN
    UPDATE public.registrations
    SET
      payment_status = 'expired',
      expires_at = timezone('utc'::text, now()) - INTERVAL '1 second'
    WHERE id = v_reg.id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'expired'
    );
  ELSE
    RAISE EXCEPTION 'Invalid outcome specified: %', p_outcome;
  END IF;
END;
$$;
