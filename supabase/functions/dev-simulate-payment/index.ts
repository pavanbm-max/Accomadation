// =============================================================================
// EDGE FUNCTION: dev-simulate-payment (DEV ONLY)
//
// Allows testing checkout payment states (success, failure, timeout) in development
// without an external gateway.
// Strictly checks DEV_SIMULATE_PAYMENTS === 'true'; rejects in all other cases.
// On success, automatically generates the real HTML email template and sends via SMTP.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { sendEmailViaSmtp } from '../_shared/smtp.ts';
import { buildConfirmationEmailHtml } from '../_shared/emailTemplate.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const isDevEnabled = Deno.env.get('DEV_SIMULATE_PAYMENTS') === 'true';

  if (req.method === 'GET') {
    return jsonResponse({
      simulationEnabled: isDevEnabled,
    });
  }

  if (!isDevEnabled) {
    return errorResponse('Payment simulation is disabled in this environment.', 403);
  }

  try {
    const { scanToken, outcome } = await req.json();
    if (!scanToken) {
      return errorResponse('Scan token is required');
    }

    const cleanToken = scanToken.trim();
    const supabase = getAdminClient();

    const { data: reg, error: fetchErr } = await supabase
      .from('registrations')
      .select('*')
      .or(`scan_token.eq.${cleanToken},reference_id.eq.${cleanToken}`)
      .maybeSingle();

    if (fetchErr || !reg) {
      return errorResponse('Registration not found', 404);
    }

    if (outcome === 'success') {
      const mockTxnId = `SIM_PAY_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const paidAt = new Date().toISOString();

      const { error: updErr } = await supabase
        .from('registrations')
        .update({
          payment_status: 'paid',
          payment_method: 'simulated_upi',
          transaction_id: mockTxnId,
          paid_at: paidAt,
        })
        .eq('id', reg.id);

      if (updErr) {
        return errorResponse('Failed to update registration status: ' + updErr.message);
      }

      // Fetch refund policy from settings
      const { data: settings } = await supabase
        .from('settings')
        .select('refund_policy_text')
        .eq('id', 1)
        .single();

      const origin = req.headers.get('origin') || 'http://localhost:5173';
      const scanUrl = `${origin}/scan/${reg.scan_token}`;

      const htmlBody = buildConfirmationEmailHtml({
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
        transactionId: mockTxnId,
        paidDate: new Date(paidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        paymentMethod: 'UPI (Simulated)',
        refundPolicyText: settings?.refund_policy_text || 'Standard hostel refund policy applies.',
        supportEmail: 'pavan.b.m1598@gmail.com',
        supportPhone: '+91 99807 45913',
      });

      const subject = `Booking confirmed – ${reg.reference_id}`;

      // Insert or update email_outbox
      const { data: outboxItem } = await supabase
        .from('email_outbox')
        .upsert({
          registration_id: reg.id,
          to_email: reg.email,
          subject,
          body_html: htmlBody,
          type: 'confirmation',
          status: 'queued',
        })
        .select('id')
        .single();

      // Send directly via Gmail SMTP to recipient!
      const smtpRes = await sendEmailViaSmtp({
        to: reg.email,
        subject,
        html: htmlBody,
        from: 'pavan.b.m1598@gmail.com',
        fromName: 'Ignitron Accommodation Desk',
      });

      if (smtpRes.success && outboxItem?.id) {
        await supabase
          .from('email_outbox')
          .update({ status: 'sent' })
          .eq('id', outboxItem.id);
      }

      // Check if this registration belongs to a TeamBatch and settle all teammates
      const batchMatch = reg.admin_note?.match(/\[TeamBatch:([^\]]+)\]/);
      const batchId = batchMatch ? batchMatch[1] : null;

      if (batchId) {
        const { data: teammates } = await supabase
          .from('registrations')
          .select('*')
          .ilike('admin_note', `%[TeamBatch:${batchId}]%`);

        if (teammates && teammates.length > 0) {
          for (const tm of teammates) {
            if (tm.id !== reg.id) {
              await supabase
                .from('registrations')
                .update({
                  payment_status: 'paid',
                  payment_method: 'team_shared',
                  transaction_id: mockTxnId,
                  paid_at: paidAt,
                })
                .eq('id', tm.id);

              const tmScanUrl = `${origin}/confirmation/${tm.scan_token}`;
              const tmSubject = `[Ignitron 2K26] Accommodation Confirmed - Stay Pass Ref: ${tm.reference_id}`;
              const tmHtml = buildConfirmationEmailHtml({
                hostelName: 'Ignitron Hostel Accommodation Desk',
                fullName: tm.full_name,
                firstName: (tm.full_name || '').split(' ')[0],
                referenceId: tm.reference_id,
                scanUrl: tmScanUrl,
                checkInDate: tm.check_in_date,
                checkOutDate: tm.check_out_date,
                nights: Number(tm.nights || 1),
                ratePerNight: Number(tm.rate_per_night || 300),
                flatFee: Number(tm.flat_fee || 0),
                amountPaid: Number(tm.amount),
                transactionId: mockTxnId,
                paidDate: new Date(paidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
                paymentMethod: 'UPI (Team Booking)',
                refundPolicyText: settings?.refund_policy_text || 'Standard hostel refund policy applies.',
                supportEmail: 'pavan.b.m1598@gmail.com',
                supportPhone: '+91 99807 45913',
              });

              // Record in outbox
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

              // Await SMTP dispatch to teammate with brief delay to avoid rate limits
              try {
                await new Promise((resolve) => setTimeout(resolve, 600));
                const tmSmtpRes = await sendEmailViaSmtp({
                  to: tm.email,
                  subject: tmSubject,
                  html: tmHtml,
                  from: 'pavan.b.m1598@gmail.com',
                  fromName: 'Ignitron Accommodation Desk',
                });

                if (tmSmtpRes.success && tmOutbox?.id) {
                  await supabase
                    .from('email_outbox')
                    .update({ status: 'sent' })
                    .eq('id', tmOutbox.id);
                }
              } catch (tmErr) {
                console.warn(`Teammate email dispatch notice for ${tm.email}:`, tmErr);
              }
            }
          }
        }
      }

      return jsonResponse({
        success: true,
        status: 'paid',
        transactionId: mockTxnId,
        referenceId: reg.reference_id,
        smtpSent: smtpRes.success,
        smtpError: smtpRes.error,
      });
    }

    if (outcome === 'failure') {
      const failTxnId = `SIM_FAIL_${Date.now()}`;
      await supabase
        .from('registrations')
        .update({
          payment_status: 'failed',
          transaction_id: failTxnId,
        })
        .eq('id', reg.id);

      return jsonResponse({
        success: true,
        status: 'failed',
        transactionId: failTxnId,
      });
    }

    if (outcome === 'timeout') {
      await supabase
        .from('registrations')
        .update({
          payment_status: 'expired',
          expires_at: new Date(Date.now() - 60000).toISOString(),
        })
        .eq('id', reg.id);

      return jsonResponse({
        success: true,
        status: 'expired',
      });
    }

    return errorResponse('Invalid outcome requested. Use "success", "failure", or "timeout".');
  } catch (err: any) {
    console.error('Simulation error:', err);
    return errorResponse(err.message || 'Simulation error', 500);
  }
});
