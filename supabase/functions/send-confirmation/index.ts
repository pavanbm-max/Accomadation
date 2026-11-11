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
import { buildConfirmationEmailHtml, buildConfirmationEmailText } from '../_shared/emailTemplate.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const { scanToken, emailId, forceResend, sendToTeam } = await req.json();
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

    const templatePayload = {
      hostelName: 'Ignitron Hostel Accommodation Desk',
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
      supportPhone: '+91 99807 45913',
    };

    const htmlBody = buildConfirmationEmailHtml(templatePayload);
    const plainTextBody = buildConfirmationEmailText(templatePayload);

    // 1. Insert/Update email_outbox table
    const subject = `[Ignitron 2K26] Accommodation Confirmed - Stay Pass Ref: ${reg.reference_id}`;
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

    // 2. Send directly via Gmail SMTP with anti-spam multipart headers!
    const smtpResult = await sendEmailViaSmtp({
      to: reg.email,
      subject,
      html: htmlBody,
      plainText: plainTextBody,
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

    // 3. If sendToTeam is true, sequentially dispatch individual passes to all teammates
    let teamMembersSent = 1;
    if (sendToTeam) {
      const batchMatch = reg.admin_note?.match(/\[TeamBatch:([^\]]+)\]/);
      const batchId = batchMatch ? batchMatch[1] : null;

      if (batchId) {
        const { data: teammates } = await supabase
          .from('registrations')
          .select('*')
          .ilike('admin_note', `%[TeamBatch:${batchId}]%`);

        if (teammates && teammates.length > 0) {
          for (const tm of teammates) {
            if (tm.id !== reg.id && (tm.payment_status === 'paid' || tm.payment_status === 'paid_at_desk')) {
              try {
                const tmScanUrl = `${origin}/confirmation/${tm.scan_token}`;
                const tmPayload = {
                  ...templatePayload,
                  fullName: tm.full_name,
                  firstName: (tm.full_name || '').split(' ')[0],
                  referenceId: tm.reference_id,
                  scanUrl: tmScanUrl,
                };
                const tmHtml = buildConfirmationEmailHtml(tmPayload);
                const tmPlain = buildConfirmationEmailText(tmPayload);
                const tmSubject = `[Ignitron 2K26] Accommodation Confirmed - Stay Pass Ref: ${tm.reference_id}`;

                // Upsert outbox for teammate
                const { data: tmOutbox } = await supabase
                  .from('email_outbox')
                  .upsert({
                    registration_id: tm.id,
                    to_email: tm.email,
                    subject: tmSubject,
                    body_html: tmHtml,
                    type: 'confirmation',
                    status: 'queued',
                  })
                  .select('id')
                  .single();

                // 600ms pause to comply with Gmail SMTP limits
                await new Promise((r) => setTimeout(r, 600));

                const tmSmtp = await sendEmailViaSmtp({
                  to: tm.email,
                  subject: tmSubject,
                  html: tmHtml,
                  plainText: tmPlain,
                  from: 'pavan.b.m1598@gmail.com',
                  fromName: 'Ignitron Accommodation Desk',
                });

                if (tmSmtp.success) {
                  teamMembersSent++;
                  if (tmOutbox?.id) {
                    await supabase
                      .from('email_outbox')
                      .update({ status: 'sent' })
                      .eq('id', tmOutbox.id);
                  }
                }
              } catch (tmError) {
                console.warn(`Error emailing teammate ${tm.email}:`, tmError);
              }
            }
          }
        }
      }
    }

    return jsonResponse({
      success: true,
      message: smtpResult.success
        ? `Confirmation email sent via SMTP to ${reg.email}!`
        : `Confirmation email queued in email_outbox. (SMTP note: ${smtpResult.error || 'Pending credentials'})`,
      emailId: outboxId,
      smtpDelivered: smtpResult.success,
      smtpError: smtpResult.error,
      teamMembersSent,
    });
  } catch (err: any) {
    console.error('send-confirmation error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
