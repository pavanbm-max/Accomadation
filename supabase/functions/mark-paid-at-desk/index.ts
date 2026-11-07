// =============================================================================
// EDGE FUNCTION: mark-paid-at-desk (ADMIN ONLY)
//
// Allows an administrator to mark a registration as 'paid_at_desk'.
// Requires a mandatory note explaining cash/desk settlement.
// Enforces caller role = 'admin'.
// Automatically queues a confirmation QR email upon success.
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

    // Verify caller authentication & role
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

    const { registrationId, note, deskReceiptNumber } = await req.json();

    if (!registrationId) {
      return errorResponse('registrationId is required.');
    }

    if (!note || note.trim().length < 3) {
      return errorResponse('A mandatory desk note/receipt detail is required.');
    }

    // Fetch registration
    const { data: reg, error: regError } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError || !reg) {
      return errorResponse('Registration not found', 404);
    }

    if (reg.payment_status === 'paid' || reg.payment_status === 'paid_at_desk') {
      return errorResponse('Registration is already paid.');
    }

    const deskTxnId = deskReceiptNumber || `DESK-${Date.now()}`;
    const paidAt = new Date().toISOString();
    const adminNote = `Desk Payment marked by ${profile.full_name}: ${note.trim()}`;

    // Update status to 'paid_at_desk'
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        payment_status: 'paid_at_desk',
        payment_method: 'cash_or_desk',
        transaction_id: deskTxnId,
        paid_at: paidAt,
        admin_note: adminNote,
      })
      .eq('id', reg.id);

    if (updateError) {
      return errorResponse('Failed to update registration: ' + updateError.message);
    }

    // Queue confirmation QR email
    await supabase.from('email_outbox').insert({
      registration_id: reg.id,
      to_email: reg.email,
      subject: `Desk Payment Confirmed - Ref: ${reg.reference_id}`,
      body_html: `
        <div style="font-family:sans-serif;padding:24px;color:#1e293b;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#2563eb;margin-bottom:8px;">Desk Payment Confirmed!</h2>
          <p>Dear ${reg.full_name},</p>
          <p>Your payment of <strong>₹${Number(reg.amount).toLocaleString('en-IN')}</strong> was collected at the reception desk.</p>
          <p><strong>Reference ID:</strong> ${reg.reference_id}</p>
          <p><strong>Receipt / Transaction:</strong> ${deskTxnId}</p>
          <p><strong>Desk Note:</strong> ${note}</p>
          <p>Your booking is fully confirmed and check-in ready.</p>
        </div>
      `,
      type: 'confirmation',
      status: 'queued',
    });

    return jsonResponse({
      success: true,
      status: 'paid_at_desk',
      referenceId: reg.reference_id,
      transactionId: deskTxnId,
    });
  } catch (err: any) {
    console.error('mark-paid-at-desk error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
