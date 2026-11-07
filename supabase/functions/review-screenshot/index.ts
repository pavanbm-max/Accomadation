// =============================================================================
// EDGE FUNCTION: review-screenshot (ADMIN ONLY)
//
// Allows an administrator to approve or reject a payment screenshot.
// - Approve: transitions status to 'paid', records txn details, queues QR confirmation email.
// - Reject: transitions status to 'failed', records rejection reason visible to user.
// - Also generates signed storage URLs for viewing the private screenshot.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
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

    // Handle GET: Get signed URL for screenshot preview
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const filePath = url.searchParams.get('path');
      if (!filePath) {
        return errorResponse('Screenshot path parameter is required.');
      }

      const { data: signedData, error: signErr } = await supabase.storage
        .from('payment-screenshots')
        .createSignedUrl(filePath, 3600); // 1 hour valid

      if (signErr || !signedData) {
        return errorResponse('Failed to create signed URL: ' + (signErr?.message || 'Not found'));
      }

      return jsonResponse({ signedUrl: signedData.signedUrl });
    }

    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const { registrationId, decision, rejectionReason, transactionId } = await req.json();

    if (!registrationId || !decision) {
      return errorResponse('registrationId and decision ("approve" or "reject") are required.');
    }

    const { data: reg, error: regError } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError || !reg) {
      return errorResponse('Registration not found', 404);
    }

    if (decision === 'approve') {
      const verifiedTxnId = transactionId || `VERIFIED_UPI_${Date.now()}`;
      const paidAt = new Date().toISOString();

      const { error: updErr } = await supabase
        .from('registrations')
        .update({
          payment_status: 'paid',
          payment_method: 'upi_screenshot_verified',
          transaction_id: verifiedTxnId,
          paid_at: paidAt,
          screenshot_review_reason: null,
          admin_note: `Screenshot approved by ${profile.full_name}. Verified Txn: ${verifiedTxnId}`,
        })
        .eq('id', reg.id);

      if (updErr) {
        return errorResponse('Failed to approve registration: ' + updErr.message);
      }

      // Queue confirmation email
      await supabase.from('email_outbox').insert({
        registration_id: reg.id,
        to_email: reg.email,
        subject: `Payment Verified & Confirmed - Ref: ${reg.reference_id}`,
        body_html: `
          <div style="font-family:sans-serif;padding:24px;color:#1e293b;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;">
            <h2 style="color:#10b981;margin-bottom:8px;">Payment Screenshot Verified!</h2>
            <p>Dear ${reg.full_name},</p>
            <p>Your payment screenshot has been reviewed and verified by the hostel administration.</p>
            <p><strong>Reference ID:</strong> ${reg.reference_id}</p>
            <p><strong>Verified Transaction:</strong> ${verifiedTxnId}</p>
            <p><strong>Amount:</strong> ₹${Number(reg.amount).toLocaleString('en-IN')}</p>
            <p>Your accommodation is now confirmed. Please present your digital QR code upon arrival.</p>
          </div>
        `,
        type: 'confirmation',
        status: 'queued',
      });

      return jsonResponse({
        success: true,
        status: 'paid',
        referenceId: reg.reference_id,
        message: 'Payment approved. Registration marked as paid and QR confirmation queued.',
      });
    }

    if (decision === 'reject') {
      if (!rejectionReason || rejectionReason.trim().length < 5) {
        return errorResponse('A clear rejection reason is required (minimum 5 characters).');
      }

      const { error: updErr } = await supabase
        .from('registrations')
        .update({
          payment_status: 'failed',
          screenshot_review_reason: rejectionReason.trim(),
          admin_note: `Screenshot rejected by ${profile.full_name}: ${rejectionReason.trim()}`,
        })
        .eq('id', reg.id);

      if (updErr) {
        return errorResponse('Failed to reject registration: ' + updErr.message);
      }

      return jsonResponse({
        success: true,
        status: 'failed',
        referenceId: reg.reference_id,
        message: 'Screenshot rejected. Status set to failed.',
      });
    }

    return errorResponse('Invalid decision. Choose "approve" or "reject".');
  } catch (err: any) {
    console.error('review-screenshot error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
