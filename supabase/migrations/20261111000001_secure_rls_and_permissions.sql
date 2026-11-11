-- =============================================================================
-- MIGRATION: Secure RLS Policies, Permissions & Room Number Projection
-- =============================================================================

-- 1. Drop the overly permissive public select policy on registrations
DROP POLICY IF EXISTS "Public can view registrations" ON public.registrations;

-- 2. Strictly restrict direct table SELECT on public.registrations to staff
DROP POLICY IF EXISTS "Staff can view registrations" ON public.registrations;
CREATE POLICY "Staff can view registrations" ON public.registrations
FOR SELECT
USING (public.is_staff());

-- 3. Revoke execution of developer payment simulator from public anonymous users
REVOKE EXECUTE ON FUNCTION public.dev_simulate_payment(TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dev_simulate_payment(TEXT, TEXT) TO service_role;

-- 4. Update get_public_registration RPC to include room_number
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
    expires_at,
    room_number
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
    'room_number', v_reg.room_number,
    'is_paid', v_reg.payment_status IN ('paid', 'paid_at_desk')
  );
END;
$$;

-- Grant execution of get_public_registration to anon, authenticated and service_role
GRANT EXECUTE ON FUNCTION public.get_public_registration(TEXT) TO anon, authenticated, service_role;
