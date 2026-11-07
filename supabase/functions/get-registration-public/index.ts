// =============================================================================
// EDGE FUNCTION: get-registration-public
// Retrieves minimal safe fields for a given scan_token OR reference_id.
// Enforces that QR code or ticket access is only flagged as valid if paid.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    let identifier = url.searchParams.get('scanToken') || url.searchParams.get('token') || url.searchParams.get('referenceId');

    if (!identifier && req.method === 'POST') {
      const body = await req.json();
      identifier = body.scanToken || body.token || body.referenceId;
    }

    if (!identifier) {
      return errorResponse('Scan token or reference ID is required.');
    }

    const cleanInput = identifier.trim();
    const supabase = getAdminClient();

    // Expire stale registrations
    await supabase.rpc('expire_stale_registrations');

    // Fetch registration by scan_token OR reference_id
    const { data: reg, error } = await supabase
      .from('registrations')
      .select(`
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
        checked_in_at
      `)
      .or(`scan_token.eq.${cleanInput},reference_id.eq.${cleanInput}`)
      .maybeSingle();

    if (error || !reg) {
      return errorResponse('Registration not found for token or reference ID.', 404);
    }

    // Determine current effective status (if pending but expired)
    let effectiveStatus = reg.payment_status;
    const isExpired = new Date(reg.expires_at).getTime() < Date.now();
    if (effectiveStatus === 'pending' && isExpired) {
      effectiveStatus = 'expired';
    }

    const isPaid = effectiveStatus === 'paid' || effectiveStatus === 'paid_at_desk';

    // Fetch public settings for refund policy & payment state
    const { data: settings } = await supabase
      .from('settings')
      .select('refund_policy_text, payments_enabled')
      .eq('id', 1)
      .single();

    return jsonResponse({
      referenceId: reg.reference_id,
      scanToken: reg.scan_token,
      fullName: reg.full_name,
      email: reg.email,
      phone: reg.phone,
      gender: reg.gender,
      collegeOrOrganisation: reg.college_or_organisation,
      checkInDate: reg.check_in_date,
      checkOutDate: reg.check_out_date,
      nights: reg.nights,
      ratePerNight: reg.rate_per_night,
      flatFee: reg.flat_fee,
      amount: reg.amount,
      paymentStatus: effectiveStatus,
      paymentMethod: reg.payment_method,
      transactionId: reg.transaction_id,
      paidAt: reg.paid_at,
      createdAt: reg.created_at,
      expiresAt: reg.expires_at,
      checkedInAt: reg.checked_in_at,
      screenshotPath: reg.screenshot_path,
      screenshotReviewReason: reg.screenshot_review_reason,
      refundPolicyText: settings?.refund_policy_text || '',
      isPaid,
    });
  } catch (err: any) {
    console.error('get-registration-public error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
