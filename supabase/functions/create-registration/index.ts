// =============================================================================
// EDGE FUNCTION: create-registration
// Validates guest input, enforces duplicate check (paid only), locks rate from
// settings, creates pending registration with unique token & reference ID.
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

    const body = await req.json();
    const {
      fullName,
      phone,
      email,
      gender,
      collegeOrOrganisation,
      emergencyContact,
      checkInDate,
      checkOutDate,
    } = body;

    // 1. Validation
    if (!fullName || !phone || !email || !checkInDate || !checkOutDate) {
      return errorResponse('Full name, phone, email, check-in and check-out dates are required.');
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const diffTime = checkOut.getTime() - checkIn.getTime();
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (isNaN(nights) || nights <= 0) {
      return errorResponse('Check-out date must be after check-in date (minimum 1 night stay).');
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    const supabase = getAdminClient();

    // Expire stale pending registrations first
    await supabase.rpc('expire_stale_registrations');

    // 2. GOLDEN RULE: Check for duplicate PAID registration
    // Pending, expired, failed registrations NEVER block duplicates!
    const { data: existingPaid, error: dupError } = await supabase
      .from('registrations')
      .select('id, reference_id, payment_status')
      .or(`phone.eq.${cleanPhone},email.ilike.${cleanEmail}`)
      .in('payment_status', ['paid', 'paid_at_desk'])
      .limit(1);

    if (dupError) {
      console.error('Error checking duplicate:', dupError);
      return errorResponse('Unable to verify registration status. Please try again.');
    }

    if (existingPaid && existingPaid.length > 0) {
      return errorResponse(
        `A confirmed accommodation registration (${existingPaid[0].reference_id}) already exists for this phone or email.`,
        409
      );
    }

    // 3. Read current system settings (locked pricing)
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('per_night_fee, flat_fee, payments_enabled, expiry_minutes')
      .eq('id', 1)
      .single();

    if (settingsError || !settings) {
      return errorResponse('System settings currently unavailable. Please contact hostel admin.');
    }

    const ratePerNight = Number(settings.per_night_fee);
    const flatFee = Number(settings.flat_fee || 0);
    const amount = (nights * ratePerNight) + flatFee;
    const expiryMinutes = settings.expiry_minutes || 30;

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    const scanToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    const isExemptOrFree = amount === 0 || !settings.payments_enabled;
    const initialStatus = isExemptOrFree ? 'paid' : 'pending';

    // 4. Insert registration
    const { data: newReg, error: insertError } = await supabase
      .from('registrations')
      .insert({
        full_name: fullName.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        gender: gender || 'Not specified',
        college_or_organisation: collegeOrOrganisation || 'Not specified',
        emergency_contact: emergencyContact || 'Not specified',
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        nights,
        rate_per_night: ratePerNight,
        flat_fee: flatFee,
        amount,
        payment_status: initialStatus,
        payment_method: isExemptOrFree ? 'system_exempt' : null,
        transaction_id: isExemptOrFree ? `EXEMPT_${Date.now()}` : null,
        paid_at: isExemptOrFree ? new Date().toISOString() : null,
        scan_token: scanToken,
        expires_at: expiresAt,
      })
      .select('id, reference_id, scan_token, amount, expires_at, payment_status')
      .single();

    if (insertError) {
      console.error('Error inserting registration:', insertError);
      return errorResponse('Failed to create registration. Please verify details and try again.');
    }

    // If zero or payments disabled, queue confirmation immediately
    if (isExemptOrFree) {
      try {
        await supabase.from('email_outbox').insert({
          registration_id: newReg.id,
          to_email: cleanEmail,
          subject: `Accommodation Confirmed - Ref: ${newReg.reference_id}`,
          body_html: `
            <div style="font-family:sans-serif;padding:24px;color:#1e293b;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;">
              <h2 style="color:#4f46e5;margin-bottom:8px;">Accommodation Confirmed!</h2>
              <p>Dear ${fullName},</p>
              <p>Your hostel stay has been approved. Reference ID: <strong>${newReg.reference_id}</strong>.</p>
              <p>Amount Paid: ₹0 (Exempt/Free).</p>
              <p>Please present your scan token at the check-in desk upon arrival.</p>
            </div>
          `,
          type: 'confirmation',
          status: 'queued',
        });
      } catch (e) {
        console.error('Error queuing exempt confirmation email:', e);
      }
    }

    return jsonResponse({
      success: true,
      referenceId: newReg.reference_id,
      scanToken: newReg.scan_token,
      amount: newReg.amount,
      expiresAt: newReg.expires_at,
      paymentStatus: newReg.payment_status,
      nights,
      ratePerNight,
    });
  } catch (err: any) {
    console.error('Unexpected error in create-registration:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
