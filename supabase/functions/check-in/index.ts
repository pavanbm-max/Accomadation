// =============================================================================
// EDGE FUNCTION: check-in (STAFF / VOLUNTEER / ADMIN)
//
// Invoked by staff at the check-in desk when scanning participant QR tokens.
// STRICT GOLDEN RULE:
// Registration MUST be 'paid' or 'paid_at_desk'.
// Unpaid, failed, expired, under_review, or refunded registrations are rejected
// with an unambiguous blocked message.
// Records checked_in_at and checked_in_by staff user ID.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    // Verify staff role
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = getAdminClient();

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('Unauthorized: Staff login required', 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'volunteer'].includes(profile.role)) {
      return errorResponse('Forbidden: Only authorized staff and volunteers can perform check-in.', 403);
    }

    const { scanToken } = await req.json();
    if (!scanToken) {
      return errorResponse('Scan token or reference ID is required');
    }

    const cleanInput = scanToken.trim();

    // Expire stale registrations
    await supabase.rpc('expire_stale_registrations');

    // Fetch registration by scan_token OR reference_id
    const { data: reg, error: fetchErr } = await supabase
      .from('registrations')
      .select(`
        id,
        reference_id,
        full_name,
        email,
        phone,
        gender,
        college_or_organisation,
        check_in_date,
        check_out_date,
        nights,
        amount,
        payment_status,
        checked_in_at,
        checked_in_by
      `)
      .or(`scan_token.eq.${cleanInput},reference_id.eq.${cleanInput}`)
      .maybeSingle();

    if (fetchErr || !reg) {
      return errorResponse('Registration not found for the provided scan token.', 404);
    }

    // STRICT GOLDEN RULE CHECK:
    if (reg.payment_status !== 'paid' && reg.payment_status !== 'paid_at_desk') {
      if (reg.payment_status === 'refunded') {
        return errorResponse('Check-in blocked: This booking has been refunded.', 403);
      }
      return errorResponse(
        `Payment not completed. Check-in not allowed. Current status: ${reg.payment_status.toUpperCase()}`,
        403
      );
    }

    // Check if already checked in
    if (reg.checked_in_at) {
      let checkerName = 'Staff Member';
      if (reg.checked_in_by) {
        const { data: checkerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', reg.checked_in_by)
          .maybeSingle();
        if (checkerProfile?.full_name) {
          checkerName = checkerProfile.full_name;
        }
      }

      return jsonResponse({
        success: false,
        alreadyCheckedIn: true,
        checkedInAt: reg.checked_in_at,
        checkedInByName: checkerName,
        registration: reg,
        message: `Already checked in at ${new Date(reg.checked_in_at).toLocaleString('en-IN')} by ${checkerName}.`,
      });
    }

    // Perform check-in
    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('registrations')
      .update({
        checked_in_at: now,
        checked_in_by: user.id,
      })
      .eq('id', reg.id);

    if (updErr) {
      return errorResponse('Failed to record check-in: ' + updErr.message);
    }

    return jsonResponse({
      success: true,
      alreadyCheckedIn: false,
      checkedInAt: now,
      checkedInByName: profile.full_name,
      registration: {
        ...reg,
        checked_in_at: now,
        checked_in_by: user.id,
      },
      message: `Successfully checked in ${reg.full_name}!`,
    });
  } catch (err: any) {
    console.error('check-in error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
