// =============================================================================
// EDGE FUNCTION: send-confirmation (WITH GMAIL SMTP & CUSTOM TEMPLATE)
//
// Sender: pavan.b.m1598@gmail.com
// Uses confirmation-email.html template with real values replaced.
// Dispatches directly to the recipient email provided during registration.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { sendEmailViaSmtp } from '../_shared/smtp.ts';
import { buildConfirmationEmailHtml } from '../_shared/emailTemplate.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const { scanToken, emailId, forceResend } = await req.json();
    if (!scanToken && !emailId) {
      return errorResponse('Scan token, reference ID, or emailId is required.');
    }

    const supabase = getAdminClient();
    let reg: any = null;
    let targetOutboxId = emailId;

    if (emailId) {
      const { data: outboxItem } = await supabase
        .from('email_outbox')
        .select('registration_id, to_email')
        .eq('id', emailId)
        .maybeSingle();

      if (outboxItem?.registration_id) {
        const { data: regFound } = await supabase
          .from('registrations')
          .select('*')
          .eq('id', outboxItem.registration_id)
          .maybeSingle();
        reg = regFound;
      }
    }

    if (!reg && scanToken) {
      const { data: regFound } = await supabase
        .from('registrations')
        .select('*')
        .or(`scan_token.eq.${scanToken},reference_id.eq.${scanToken}`)
        .maybeSingle();
      reg = regFound;
    }

    if (!reg) {
      return errorResponse('Registration not found', 404);
    }

    // GOLDEN RULE: Never send confirmation email for unpaid registrations
    if (reg.payment_status !== 'paid' && reg.payment_status !== 'paid_at_desk') {
      return errorResponse(
        `Confirmation email blocked: Registration is not paid (Current status: ${reg.payment_status}).`,
        400
      );
    }

    // Fetch settings for refund policy
    const { data: settings } = await supabase
      .from('settings')
      .select('refund_policy_text')
      .eq('id', 1)
      .single();

    const refundPolicyText = settings?.refund_policy_text || 
      'Cancellations and refunds are processed at hostel administration discretion. Please present your reference ID at the accommodation desk.';

    // Check if already sent
    const { data: existingEmail } = await supabase
      .from('email_outbox')
      .select('id, status, created_at')
      .eq('registration_id', reg.id)
      .eq('type', 'confirmation')
      .maybeSingle();

    if (existingEmail && !forceResend && existingEmail.status === 'sent' && !emailId) {
      return jsonResponse({
        success: true,
        message: 'Confirmation email has already been sent to ' + reg.email,
        emailId: existingEmail.id,
        status: existingEmail.status,
      });
    }

    const origin = Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('SITE_URL') || req.headers.get('origin') || 'http://localhost:5173';
    const scanUrl = `${origin}/confirmation/${reg.scan_token}`;

    const paidDate = reg.paid_at 
      ? new Date(reg.paid_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    const paymentMethodText = reg.payment_status === 'paid_at_desk' 
      ? 'Paid at Desk' 
      : (reg.payment_method === 'simulated_upi' ? 'UPI (Simulated)' : (reg.payment_method || 'Online UPI'));

    const htmlBody = buildConfirmationEmailHtml({
      hostelName: 'Ignitron Hostel Accommodation',
      fullName: reg.full_name,
      firstName: (reg.full_name || '').split(' ')[0],
      referenceId: reg.reference_id,
      scanUrl: scanUrl,
      checkInDate: reg.check_in_date,
      checkOutDate: reg.check_out_date,
      nights: Number(reg.nights || 1),
      ratePerNight: Number(reg.rate_per_night || 300),
      flatFee: Number(reg.flat_fee || 0),
      amountPaid: Number(reg.amount),
      transactionId: reg.transaction_id || 'TXN_VERIFIED',
      paidDate: paidDate,
      paymentMethod: paymentMethodText,
      refundPolicyText: refundPolicyText,
      supportEmail: 'pavan.b.m1598@gmail.com',
      supportPhone: '+91 98765 43210',
    });

    // 1. Insert/Update email_outbox table
    const subject = `Booking confirmed – ${reg.reference_id}`;
    let outboxId = targetOutboxId || existingEmail?.id;

    if (outboxId) {
      await supabase
        .from('email_outbox')
        .update({
          subject,
          body_html: htmlBody,
          status: 'queued',
        })
        .eq('id', outboxId);
    } else {
      const { data: newEmail } = await supabase
        .from('email_outbox')
        .insert({
          registration_id: reg.id,
          to_email: reg.email,
          subject,
          body_html: htmlBody,
          type: 'confirmation',
          status: 'queued',
        })
        .select('id')
        .single();
      outboxId = newEmail?.id;
    }

    // 2. Send directly via Gmail SMTP to the recipient's filled email!
    const smtpResult = await sendEmailViaSmtp({
      to: reg.email,
      subject,
      html: htmlBody,
      from: 'pavan.b.m1598@gmail.com',
      fromName: 'Ignitron Accommodation Desk',
    });

    if (smtpResult.success) {
      if (outboxId) {
        await supabase
          .from('email_outbox')
          .update({ status: 'sent' })
          .eq('id', outboxId);
      }
    } else {
      console.warn('SMTP delivery deferred or failed:', smtpResult.error);
    }

    return jsonResponse({
      success: true,
      message: smtpResult.success
        ? `Confirmation email sent via SMTP to ${reg.email}!`
        : `Confirmation email queued in email_outbox. (SMTP note: ${smtpResult.error || 'Pending credentials'})`,
      emailId: outboxId,
      smtpDelivered: smtpResult.success,
      smtpError: smtpResult.error,
    });
  } catch (err: any) {
    console.error('send-confirmation error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
