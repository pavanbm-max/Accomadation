// =============================================================================
// EDGE FUNCTION: refund (ADMIN ONLY)
//
// Processes a refund for a previously paid registration.
// Requires an explicit refund reason.
// Sets payment_status = 'refunded', stops counting in totals, blocks check-in.
// Queues a refund notification email in email_outbox.
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

    // Verify admin role
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = getAdminClient();

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('Unauthorized: Valid admin token required', 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return errorResponse('Forbidden: Admin privilege required.', 403);
    }

    const { registrationId, reason } = await req.json();

    if (!registrationId) {
      return errorResponse('registrationId is required.');
    }

    if (!reason || reason.trim().length < 5) {
      return errorResponse('A clear reason for the refund is required (minimum 5 characters).');
    }

    const { data: reg, error: regError } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError || !reg) {
      return errorResponse('Registration not found', 404);
    }

    if (reg.payment_status !== 'paid' && reg.payment_status !== 'paid_at_desk') {
      return errorResponse(`Cannot refund a registration with status '${reg.payment_status}'. Only paid registrations can be refunded.`);
    }

    // Update status to 'refunded'
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        payment_status: 'refunded',
        refund_reason: reason.trim(),
        admin_note: `Refund issued by ${profile.full_name}: ${reason.trim()}`,
      })
      .eq('id', reg.id);

    if (updateError) {
      return errorResponse('Failed to update registration: ' + updateError.message);
    }

    // Queue refund notification email
    await supabase.from('email_outbox').insert({
      registration_id: reg.id,
      to_email: reg.email,
      subject: `Hostel Accommodation Refund Processed - Ref: ${reg.reference_id}`,
      body_html: `
        <div style="font-family:sans-serif;padding:24px;color:#1e293b;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#ef4444;margin-bottom:8px;">Refund Notification</h2>
          <p>Dear ${reg.full_name},</p>
          <p>Your hostel accommodation booking (Ref: <strong>${reg.reference_id}</strong>) has been cancelled and refunded.</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;margin:16px 0;">
            <strong>Refund Reason:</strong> ${reason.trim()}
          </div>
          <p>Refund Amount: <strong>₹${Number(reg.amount).toLocaleString('en-IN')}</strong></p>
          <p>The amount will be credited back to your original payment method or cash returned as per hostel desk policy.</p>
        </div>
      `,
      type: 'refund',
      status: 'queued',
    });

    return jsonResponse({
      success: true,
      status: 'refunded',
      referenceId: reg.reference_id,
      message: 'Registration refunded successfully. Check-in is now blocked.',
    });
  } catch (err: any) {
    console.error('refund error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
