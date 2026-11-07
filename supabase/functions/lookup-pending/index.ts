// =============================================================================
// EDGE FUNCTION: lookup-pending
// Given phone or email, returns ONLY first name, reference ID and scan token
// for an unexpired pending registration so the user can resume checkout.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

// TODO: Rate limiting per IP / phone identifier to prevent brute force lookups.

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const { identifier } = await req.json();
    if (!identifier || typeof identifier !== 'string') {
      return errorResponse('Phone number or email is required.');
    }

    const cleanInput = identifier.trim();
    const isEmail = cleanInput.includes('@');
    const supabase = getAdminClient();

    // Expire stale pending registrations first
    await supabase.rpc('expire_stale_registrations');

    let query = supabase
      .from('registrations')
      .select('full_name, reference_id, scan_token, expires_at, payment_status')
      .eq('payment_status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (isEmail) {
      query = query.ilike('email', cleanInput.toLowerCase());
    } else {
      query = query.eq('phone', cleanInput);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error looking up pending registration:', error);
      return errorResponse('Database error looking up pending registration');
    }

    if (!data || data.length === 0) {
      return jsonResponse({ found: false });
    }

    const reg = data[0];
    const firstName = (reg.full_name || '').split(' ')[0] || 'Guest';

    return jsonResponse({
      found: true,
      firstName,
      referenceId: reg.reference_id,
      scanToken: reg.scan_token,
      expiresAt: reg.expires_at,
    });
  } catch (err: any) {
    console.error('Lookup pending exception:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
