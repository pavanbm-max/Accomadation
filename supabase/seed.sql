-- =============================================================================
-- SEED DATA: Hostel Accommodation System (Settings & Initial Admin Only)
-- All volunteer and staff accounts are created dynamically by the Admin
-- via the Admin Portal (/admin/users). No hardcoded volunteers.
-- =============================================================================

-- 1. Default Pricing Settings (₹300/night, 30 min payment window)
INSERT INTO public.settings (id, per_night_fee, flat_fee, payments_enabled, expiry_minutes, refund_policy_text, updated_at)
VALUES (
  1,
  300,
  0,
  true,
  30,
  'Full refund is permitted up to 24 hours prior to check-in date. A handling fee of ₹50 may apply. For queries, contact hostel administration with your reference ID.',
  timezone('utc'::text, now())
)
ON CONFLICT (id) DO UPDATE SET
  per_night_fee = EXCLUDED.per_night_fee,
  flat_fee = EXCLUDED.flat_fee,
  payments_enabled = EXCLUDED.payments_enabled,
  expiry_minutes = EXCLUDED.expiry_minutes,
  refund_policy_text = EXCLUDED.refund_policy_text;

-- 2. Hostel Administrator Account (Single initial staff account)
-- Email: admin@hostel.in
-- Password: Admin@Hostel2026
DO $$
DECLARE
  v_user_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id OR email = 'admin@hostel.in') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@hostel.in',
      crypt('Admin@Hostel2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Hostel Warden"}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated'
    );

    -- Create matching identity for Supabase Auth email provider
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_user_id::text,
      v_user_id,
      format('{"sub":"%s","email":"%s"}', v_user_id, 'admin@hostel.in')::jsonb,
      'email',
      now(),
      now(),
      now()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Ensure profile row exists with admin role
  INSERT INTO public.profiles (id, full_name, role)
  SELECT id, 'Hostel Warden', 'admin'
  FROM auth.users
  WHERE email = 'admin@hostel.in'
  ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Hostel Warden';
END $$;
