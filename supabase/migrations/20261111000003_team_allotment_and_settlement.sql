-- =============================================================================
-- Migration: 20261111000003_team_allotment_and_settlement.sql
-- Description: 
--   1. Enhances get_public_registration to look up all team batch members,
--      calculate correct total team fees, and project individual member passes.
--   2. Adds atomic settle_team_payment RPC to settle whole team in single TX.
--   3. Updates protect_registration_payment_fields trigger to permit
--      authorized server functions using app.allow_payment_settlement.
-- =============================================================================

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

  -- If user is admin, allow status changes and notes
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

CREATE OR REPLACE FUNCTION public.get_public_registration(p_scan_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg RECORD;
  v_clean TEXT;
  v_batch_id TEXT;
  v_team_members JSONB := '[]'::jsonb;
  v_team_count INT := 1;
  v_is_leader BOOLEAN := false;
  v_final_amount NUMERIC;
  v_total_batch_amount NUMERIC;
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
    emergency_contact,
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
    expires_at,
    room_number,
    admin_note
  INTO v_reg
  FROM public.registrations
  WHERE scan_token = v_clean OR reference_id = v_clean;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_final_amount := v_reg.amount;

  -- Extract team batch ID from admin_note if present
  v_batch_id := substring(v_reg.admin_note from '\[TeamBatch:([^\]]+)\]');

  IF v_batch_id IS NOT NULL THEN
    -- Find all teammates in the same batch
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'reference_id', reference_id,
        'referenceId', reference_id,
        'scan_token', scan_token,
        'scanToken', scan_token,
        'full_name', full_name,
        'fullName', full_name,
        'email', email,
        'phone', phone,
        'gender', gender,
        'room_number', room_number,
        'roomNumber', room_number,
        'amount', amount,
        'payment_status', payment_status,
        'paymentStatus', payment_status,
        'is_paid', payment_status IN ('paid', 'paid_at_desk')
      ) ORDER BY created_at ASC
    )
    INTO v_team_members
    FROM public.registrations
    WHERE admin_note ILIKE '%[TeamBatch:' || v_batch_id || ']%';

    v_team_count := jsonb_array_length(COALESCE(v_team_members, '[]'::jsonb));
    IF v_team_count = 0 THEN
      v_team_count := 1;
      v_team_members := '[]'::jsonb;
    END IF;

    -- Check if leader
    IF v_reg.admin_note ILIKE '%[Leader]%' OR v_reg.admin_note ILIKE '%Member 1 of%' THEN
      v_is_leader := true;
    END IF;

    -- Calculate total batch amount if team leader
    IF v_is_leader AND v_team_count > 1 THEN
      v_total_batch_amount := (v_reg.nights * v_reg.rate_per_night + COALESCE(v_reg.flat_fee, 0)) * v_team_count;
      IF v_final_amount < v_total_batch_amount THEN
        v_final_amount := v_total_batch_amount;
        -- Allow internal auto-repair
        PERFORM set_config('app.allow_payment_settlement', 'true', true);
        UPDATE public.registrations SET amount = v_total_batch_amount WHERE id = v_reg.id;
      END IF;
    END IF;
  ELSE
    v_team_count := 1;
    v_team_members := '[]'::jsonb;
    v_is_leader := false;
  END IF;

  RETURN jsonb_build_object(
    'id', v_reg.id,
    'reference_id', v_reg.reference_id,
    'referenceId', v_reg.reference_id,
    'scan_token', v_reg.scan_token,
    'scanToken', v_reg.scan_token,
    'full_name', v_reg.full_name,
    'fullName', v_reg.full_name,
    'email', v_reg.email,
    'phone', v_reg.phone,
    'gender', v_reg.gender,
    'college_or_organisation', v_reg.college_or_organisation,
    'emergency_contact', v_reg.emergency_contact,
    'check_in_date', v_reg.check_in_date,
    'check_out_date', v_reg.check_out_date,
    'nights', v_reg.nights,
    'rate_per_night', v_reg.rate_per_night,
    'flat_fee', v_reg.flat_fee,
    'amount', v_final_amount,
    'payment_status', v_reg.payment_status,
    'payment_method', v_reg.payment_method,
    'transaction_id', v_reg.transaction_id,
    'paid_at', v_reg.paid_at,
    'screenshot_path', v_reg.screenshot_path,
    'screenshot_review_reason', v_reg.screenshot_review_reason,
    'created_at', v_reg.created_at,
    'expires_at', v_reg.expires_at,
    'room_number', v_reg.room_number,
    'admin_note', v_reg.admin_note,
    'is_paid', v_reg.payment_status IN ('paid', 'paid_at_desk'),
    'team_batch_id', v_batch_id,
    'team_members_count', v_team_count,
    'is_team_leader', v_is_leader,
    'team_members', COALESCE(v_team_members, '[]'::jsonb)
  );
END;
$$;

-- Atomic team settlement function
CREATE OR REPLACE FUNCTION public.settle_team_payment(
  p_scan_token TEXT,
  p_transaction_id TEXT,
  p_payment_method TEXT DEFAULT 'simulated_upi'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_batch_id TEXT;
  v_paid_at TIMESTAMPTZ := NOW();
  v_settled_count INT := 0;
  v_teammates JSONB;
BEGIN
  -- Authorize update within this secure function
  PERFORM set_config('app.allow_payment_settlement', 'true', true);

  SELECT * INTO v_lead
  FROM public.registrations
  WHERE scan_token = TRIM(p_scan_token) OR reference_id = TRIM(p_scan_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
  END IF;

  -- Settle primary registration
  UPDATE public.registrations
  SET 
    payment_status = 'paid',
    payment_method = COALESCE(p_payment_method, 'simulated_upi'),
    transaction_id = p_transaction_id,
    paid_at = v_paid_at
  WHERE id = v_lead.id;

  v_settled_count := 1;

  -- Extract team batch if any
  v_batch_id := substring(v_lead.admin_note from '\[TeamBatch:([^\]]+)\]');

  IF v_batch_id IS NOT NULL THEN
    -- Update all teammates in this batch to paid
    UPDATE public.registrations
    SET
      payment_status = 'paid',
      payment_method = 'team_shared',
      transaction_id = p_transaction_id,
      paid_at = v_paid_at
    WHERE admin_note ILIKE '%[TeamBatch:' || v_batch_id || ']%'
      AND id <> v_lead.id;

    GET DIAGNOSTICS v_settled_count = ROW_COUNT;
    v_settled_count := v_settled_count + 1; -- include lead

    -- Gather all members for outbox queueing
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'reference_id', reference_id,
        'referenceId', reference_id,
        'scan_token', scan_token,
        'scanToken', scan_token,
        'full_name', full_name,
        'fullName', full_name,
        'email', email,
        'room_number', room_number
      )
    )
    INTO v_teammates
    FROM public.registrations
    WHERE admin_note ILIKE '%[TeamBatch:' || v_batch_id || ']%';
  ELSE
    v_teammates := jsonb_build_array(
      jsonb_build_object(
        'id', v_lead.id,
        'reference_id', v_lead.reference_id,
        'referenceId', v_lead.reference_id,
        'scan_token', v_lead.scan_token,
        'scanToken', v_lead.scan_token,
        'full_name', v_lead.full_name,
        'fullName', v_lead.full_name,
        'email', v_lead.email,
        'room_number', v_lead.room_number
      )
    );
  END IF;

  -- Queue emails in email_outbox for each team member
  INSERT INTO public.email_outbox (registration_id, to_email, subject, body_html, type, status)
  SELECT 
    (m->>'id')::UUID,
    m->>'email',
    '[Ignitron 2K26] Accommodation Confirmed - Stay Pass Ref: ' || (m->>'reference_id'),
    '<div>Accommodation Confirmed for ' || (m->>'full_name') || '. Reference: ' || (m->>'reference_id') || '</div>',
    'confirmation',
    'queued'
  FROM jsonb_array_elements(v_teammates) AS m
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'settled_count', v_settled_count,
    'transaction_id', p_transaction_id,
    'paid_at', v_paid_at,
    'members', v_teammates
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_registration(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_team_payment(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
