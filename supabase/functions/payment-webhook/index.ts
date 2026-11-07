// =============================================================================
// EDGE FUNCTION: payment-webhook (PLACEHOLDER)
//
// SECURITY NOTICE:
// Payment success must be confirmed on the server through the gateway webhook
// and signature verification, never trusted from the browser redirect.
// The gateway secret key lives in server-side environment secrets only.
//
// TODO: Connect real payment gateway webhook (e.g., Razorpay / Cashfree / Stripe).
// 1. Verify HMAC SHA256 signature using the raw request body and RAZORPAY_WEBHOOK_SECRET.
// 2. Extract event type ('payment.captured' or 'order.paid').
// 3. Idempotency check: If registration is already marked 'paid', respond 200 OK without re-processing.
// 4. Update payment_status to 'paid', record transaction_id and paid_at.
// 5. Trigger send-confirmation edge function / queue confirmation in email_outbox.
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

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    // TODO: Verify signature:
    // const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    // if (!verifyRazorpaySignature(rawBody, signature, secret)) {
    //   return errorResponse('Invalid webhook signature', 400);
    // }

    const payload = JSON.parse(rawBody || '{}');
    console.log('Received payment webhook event:', payload.event || 'test_payload');

    // Expected mock/gateway payload attributes
    const orderId = payload.payload?.payment?.entity?.order_id || payload.orderId;
    const paymentId = payload.payload?.payment?.entity?.id || payload.paymentId || `txn_${Date.now()}`;
    const scanToken = payload.scanToken;

    if (!orderId && !scanToken) {
      return errorResponse('Missing order or scanToken identifier in webhook payload');
    }

    const supabase = getAdminClient();

    let query = supabase.from('registrations').select('*');
    if (orderId) {
      query = query.eq('gateway_order_id', orderId);
    } else {
      query = query.eq('scan_token', scanToken);
    }

    const { data: reg, error } = await query.maybeSingle();

    if (error || !reg) {
      console.warn('Webhook received for unknown registration:', { orderId, scanToken });
      return jsonResponse({ status: 'ignored', reason: 'Registration not found' });
    }

    // IDEMPOTENCY CHECK:
    // If registration is already marked paid or paid_at_desk, do nothing!
    if (reg.payment_status === 'paid' || reg.payment_status === 'paid_at_desk') {
      console.log(`Registration ${reg.reference_id} already marked paid. Skipping.`);
      return jsonResponse({ status: 'already_processed', referenceId: reg.reference_id });
    }

    // Mark paid with transaction ID and paid timestamp
    const paidAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        payment_status: 'paid',
        payment_method: 'gateway_webhook',
        transaction_id: paymentId,
        paid_at: paidAt,
      })
      .eq('id', reg.id);

    if (updateError) {
      console.error('Failed to update registration status on webhook:', updateError);
      return errorResponse('Database update failed', 500);
    }

    // Queue confirmation email in email_outbox (runs once per registration)
    await supabase.from('email_outbox').insert({
      registration_id: reg.id,
      to_email: reg.email,
      subject: `Hostel Accommodation Confirmed - Ref: ${reg.reference_id}`,
      body_html: `
        <div style="font-family:sans-serif;padding:24px;color:#1e293b;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#10b981;">Accommodation Confirmed!</h2>
          <p>Dear ${reg.full_name},</p>
          <p>Your payment has been received and your hostel accommodation is confirmed.</p>
          <table style="width:100%;margin:16px 0;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#64748b;">Reference ID:</td><td style="padding:8px 0;font-weight:600;">${reg.reference_id}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Amount Paid:</td><td style="padding:8px 0;font-weight:600;">₹${Number(reg.amount).toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Transaction ID:</td><td style="padding:8px 0;font-weight:600;">${paymentId}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Check-in Date:</td><td style="padding:8px 0;font-weight:600;">${reg.check_in_date}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Check-out Date:</td><td style="padding:8px 0;font-weight:600;">${reg.check_out_date}</td></tr>
          </table>
          <p>Please present your digital QR code upon arrival at the accommodation desk.</p>
        </div>
      `,
      type: 'confirmation',
      status: 'queued',
    });

    return jsonResponse({
      success: true,
      status: 'paid',
      referenceId: reg.reference_id,
      transactionId: paymentId,
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return errorResponse(err.message || 'Webhook processing failed', 500);
  }
});
