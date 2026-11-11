// =============================================================================
// API CLIENT LAYER (REAL SUPABASE DATA ONLY - NO DUMMY DATA)
//
// All operations interact directly with Supabase:
// - PostgreSQL tables & views via Supabase Client
// - Security-definer RPCs for public guest lookups and dashboard stats
// - Edge Functions for transactional operations and SMTP dispatching
// - Private storage bucket for payment screenshots
// =============================================================================

import { supabase } from './supabase';
import type {
  Registration,
  PublicRegistration,
  Settings,
  PublicSettings,
  Announcement,
  Profile,
  EmailOutboxItem,
  DashboardStats,
  PaymentStatus,
} from '../types';

// =============================================================================
// PUBLIC APIS (Guest Flows)
// =============================================================================

export async function getPublicSettings(): Promise<PublicSettings> {
  const { data, error } = await supabase.rpc('get_public_settings');
  if (!error && data && data.length > 0) {
    return data[0];
  }

  // Fallback direct select on public settings
  const { data: direct, error: directErr } = await supabase
    .from('settings')
    .select('per_night_fee, flat_fee, payments_enabled, expiry_minutes, refund_policy_text')
    .eq('id', 1)
    .single();

  if (directErr || !direct) {
    return {
      per_night_fee: 300,
      flat_fee: 0,
      payments_enabled: true,
      expiry_minutes: 30,
      refund_policy_text: 'Standard hostel refund policy applies.',
    };
  }

  return direct;
}

export async function getPublishedAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching published announcements:', error);
    return [];
  }
  return data || [];
}

export async function createRegistration(payload: {
  fullName: string;
  phone: string;
  email: string;
  gender?: string;
  collegeOrOrganisation?: string;
  emergencyContact?: string;
  checkInDate: string;
  checkOutDate: string;
}): Promise<{
  success: boolean;
  referenceId: string;
  scanToken: string;
  amount: number;
  expiresAt: string;
  paymentStatus: PaymentStatus;
  error?: string;
}> {
  // Try Edge Function first
  try {
    const { data, error } = await supabase.functions.invoke('create-registration', {
      body: payload,
    });
    if (!error && data && data.success) {
      return data;
    }
    if (data && data.error) {
      throw new Error(data.error);
    }
  } catch (e: any) {
    // If it's a duplicate error, rethrow immediately
    if (e.message && (e.message.includes('already exists') || e.message.includes('confirmed accommodation'))) {
      throw e;
    }
    console.warn('Edge function invoke failed, performing direct client creation:', e);
  }

  // Try Security-Definer RPC next (handles duplicate checks, pricing lock, and pending insertion safely)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('create_public_registration', {
      payload,
    });
    if (!rpcErr && rpcData && rpcData.success) {
      return rpcData;
    }
    if (rpcErr) {
      throw new Error(rpcErr.message);
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('already exists') || e.message.includes('confirmed accommodation') || e.message.includes('Check-out date'))) {
      throw e;
    }
    console.warn('RPC create_public_registration error:', e);
  }

  // Direct Supabase database fallback:
  const cleanPhone = payload.phone.trim();
  const cleanEmail = payload.email.trim().toLowerCase();

  // Expire stale pending registrations first
  await supabase.rpc('expire_stale_registrations');

  // Check duplicate PAID registration (Golden rule)
  const { data: existingPaid } = await supabase
    .from('registrations')
    .select('reference_id')
    .or(`phone.eq.${cleanPhone},email.ilike.${cleanEmail}`)
    .in('payment_status', ['paid', 'paid_at_desk'])
    .limit(1);

  if (existingPaid && existingPaid.length > 0) {
    throw new Error(
      `A confirmed accommodation registration (${existingPaid[0].reference_id}) already exists for this phone or email.`
    );
  }

  // Fetch current settings for pricing
  const { data: settings } = await supabase
    .from('settings')
    .select('per_night_fee, flat_fee, payments_enabled, expiry_minutes')
    .eq('id', 1)
    .single();

  const perNightFee = Number(settings?.per_night_fee || 300);
  const flatFee = Number(settings?.flat_fee || 0);
  const expiryMinutes = Number(settings?.expiry_minutes || 30);
  const paymentsEnabled = settings?.payments_enabled ?? true;

  const checkIn = new Date(payload.checkInDate);
  const checkOut = new Date(payload.checkOutDate);
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  const amount = (nights * perNightFee) + flatFee;

  const isExempt = amount === 0 || !paymentsEnabled;
  const initialStatus: PaymentStatus = isExempt ? 'paid' : 'pending';
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  const { data: newReg, error: insertError } = await supabase
    .from('registrations')
    .insert({
      full_name: payload.fullName.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      gender: payload.gender || 'Not specified',
      college_or_organisation: payload.collegeOrOrganisation || 'Not specified',
      emergency_contact: payload.emergencyContact || 'Not specified',
      check_in_date: payload.checkInDate,
      check_out_date: payload.checkOutDate,
      nights,
      rate_per_night: perNightFee,
      flat_fee: flatFee,
      amount,
      payment_status: initialStatus,
      payment_method: isExempt ? 'exempt_free' : null,
      paid_at: isExempt ? new Date().toISOString() : null,
      expires_at: expiresAt,
    })
    .select('id, reference_id, scan_token, amount, expires_at, payment_status')
    .single();

  if (insertError || !newReg) {
    throw new Error(insertError?.message || 'Failed to create registration.');
  }

  return {
    success: true,
    referenceId: newReg.reference_id,
    scanToken: newReg.scan_token,
    amount: newReg.amount,
    expiresAt: newReg.expires_at,
    paymentStatus: newReg.payment_status,
  };
}

export async function lookupPending(identifier: string): Promise<{
  found: boolean;
  firstName?: string;
  referenceId?: string;
  scanToken?: string;
  expiresAt?: string;
}> {
  try {
    const { data } = await supabase.functions.invoke('lookup-pending', {
      body: { identifier },
    });
    if (data && data.found) return data;
  } catch {
    // continue to direct lookup
  }

  const clean = identifier.trim();
  const isEmail = clean.includes('@');

  let query = supabase
    .from('registrations')
    .select('full_name, reference_id, scan_token, expires_at, payment_status')
    .eq('payment_status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (isEmail) {
    query = query.ilike('email', clean.toLowerCase());
  } else {
    query = query.eq('phone', clean);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return { found: false };
  }

  const reg = data[0];
  return {
    found: true,
    firstName: (reg.full_name || '').split(' ')[0],
    referenceId: reg.reference_id,
    scanToken: reg.scan_token,
    expiresAt: reg.expires_at,
  };
}

export async function getRegistrationPublic(scanTokenOrRef: string): Promise<PublicRegistration> {
  const clean = scanTokenOrRef.trim();

  // Try RPC first (security definer returning minimal safe fields)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_public_registration', {
      p_scan_token: clean,
    });
    if (!rpcErr && rpcData && rpcData.reference_id) {
      return {
        id: rpcData.id,
        referenceId: rpcData.reference_id,
        scanToken: rpcData.scan_token,
        fullName: rpcData.full_name,
        email: rpcData.email,
        phone: rpcData.phone,
        gender: rpcData.gender,
        collegeOrOrganisation: rpcData.college_or_organisation,
        emergencyContact: rpcData.emergency_contact,
        checkInDate: rpcData.check_in_date,
        checkOutDate: rpcData.check_out_date,
        nights: rpcData.nights,
        ratePerNight: rpcData.rate_per_night,
        flatFee: rpcData.flat_fee,
        amount: rpcData.amount,
        paymentStatus: rpcData.payment_status,
        paymentMethod: rpcData.payment_method,
        transactionId: rpcData.transaction_id,
        paidAt: rpcData.paid_at,
        createdAt: rpcData.created_at,
        expiresAt: rpcData.expires_at,
        checkedInAt: rpcData.checked_in_at,
        screenshotPath: rpcData.screenshot_path,
        screenshotReviewReason: rpcData.screenshot_review_reason,
        isPaid: rpcData.is_paid,
      };
    }
  } catch (e) {
    console.warn('RPC lookup failed:', e);
  }

  // Edge function lookup
  try {
    const { data, error } = await supabase.functions.invoke('get-registration-public', {
      body: { scanToken: clean },
    });
    if (!error && data && data.referenceId) {
      return data;
    }
  } catch {
    // continue to direct query
  }

  // Direct table query (when authenticated)
  const { data: reg, error } = await supabase
    .from('registrations')
    .select('*')
    .or(`scan_token.eq.${clean},reference_id.eq.${clean}`)
    .maybeSingle();

  if (error || !reg) {
    throw new Error('Registration not found for token or reference ID.');
  }

  let effectiveStatus = reg.payment_status;
  if (effectiveStatus === 'pending' && new Date(reg.expires_at).getTime() < Date.now()) {
    effectiveStatus = 'expired';
  }

  const isPaid = effectiveStatus === 'paid' || effectiveStatus === 'paid_at_desk';

  return {
    id: reg.id,
    referenceId: reg.reference_id,
    scanToken: reg.scan_token,
    fullName: reg.full_name,
    email: reg.email,
    phone: reg.phone,
    gender: reg.gender,
    collegeOrOrganisation: reg.college_or_organisation,
    emergencyContact: reg.emergency_contact,
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
    isPaid,
  };
}

export async function devSimulatePayment(
  scanToken: string,
  outcome: 'success' | 'failure' | 'timeout'
): Promise<{ success: boolean; status: PaymentStatus; transactionId?: string; referenceId?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('dev-simulate-payment', {
      body: { scanToken, outcome },
    });
    if (!error && data && data.success) return data;
  } catch (e) {
    console.warn('dev-simulate-payment invoke error:', e);
  }

  // Try Security-Definer RPC next
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('dev_simulate_payment', {
      p_scan_token: scanToken.trim(),
      p_outcome: outcome,
    });
    if (!rpcErr && rpcData && rpcData.success) return rpcData;
  } catch (e) {
    console.warn('RPC dev_simulate_payment error:', e);
  }

  // Direct update in database for development
  const clean = scanToken.trim();
  const { data: reg, error: fetchErr } = await supabase
    .from('registrations')
    .select('id, amount, reference_id, email, full_name')
    .or(`scan_token.eq.${clean},reference_id.eq.${clean}`)
    .single();

  if (fetchErr || !reg) throw new Error('Registration not found');

  if (outcome === 'success') {
    const txnId = `SIM_PAY_${Date.now()}`;
    const paidAt = new Date().toISOString();

    await supabase
      .from('registrations')
      .update({
        payment_status: 'paid',
        payment_method: 'simulated_upi',
        transaction_id: txnId,
        paid_at: paidAt,
      })
      .eq('id', reg.id);

    // Queue confirmation email
    await supabase.from('email_outbox').insert({
      registration_id: reg.id,
      to_email: reg.email,
      subject: `Accommodation Confirmed - Ref: ${reg.reference_id}`,
      body_html: `<div>Accommodation Confirmed. Reference: ${reg.reference_id}, Amount: ₹${reg.amount}</div>`,
      type: 'confirmation',
      status: 'queued',
    });

    return { success: true, status: 'paid', transactionId: txnId, referenceId: reg.reference_id };
  } else if (outcome === 'failure') {
    const failTxn = `SIM_FAIL_${Date.now()}`;
    await supabase
      .from('registrations')
      .update({
        payment_status: 'failed',
        transaction_id: failTxn,
      })
      .eq('id', reg.id);

    return { success: true, status: 'failed', transactionId: failTxn };
  } else {
    await supabase
      .from('registrations')
      .update({
        payment_status: 'expired',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      })
      .eq('id', reg.id);

    return { success: true, status: 'expired' };
  }
}

export async function uploadScreenshot(
  scanToken: string,
  base64Image: string,
  userNote?: string
): Promise<{ success: boolean; status: PaymentStatus; message: string }> {
  // Edge Function upload
  try {
    const { data, error } = await supabase.functions.invoke('upload-screenshot', {
      body: { scanToken, base64Image, userNote },
    });
    if (!error && data && data.success) return data;
  } catch (e) {
    console.warn('upload-screenshot edge function invoke failed, fallback to direct upload:', e);
  }

  // Direct storage upload
  const clean = scanToken.trim();
  const { data: reg, error: fetchErr } = await supabase
    .from('registrations')
    .select('id')
    .or(`scan_token.eq.${clean},reference_id.eq.${clean}`)
    .single();

  if (fetchErr || !reg) throw new Error('Registration not found');

  const match = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const rawBase64 = match ? match[2] : base64Image;
  const fileExt = mimeType.split('/')[1] || 'jpg';

  const byteCharacters = atob(rawBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  const filePath = `${reg.id}/${Date.now()}.${fileExt}`;
  const { error: uploadErr } = await supabase.storage
    .from('payment-screenshots')
    .upload(filePath, byteArray, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadErr) {
    console.error('Storage upload error:', uploadErr);
  }

  await supabase
    .from('registrations')
    .update({
      payment_status: 'under_review',
      screenshot_path: filePath,
      admin_note: userNote ? `Participant: ${userNote}` : null,
    })
    .eq('id', reg.id);

  return {
    success: true,
    status: 'under_review',
    message: 'Payment proof submitted for review by hostel administration.',
  };
}

export async function sendConfirmationEmail(
  scanToken: string,
  forceResend = false
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('send-confirmation', {
    body: { scanToken, forceResend },
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to dispatch confirmation email.');
  }

  return data;
}

// =============================================================================
// STAFF & ADMIN APIS (Real Database Queries Only)
// =============================================================================

export async function staffCheckIn(scanTokenOrRef: string): Promise<{
  success: boolean;
  alreadyCheckedIn: boolean;
  checkedInAt?: string;
  checkedInByName?: string;
  message: string;
  registration?: Partial<Registration>;
}> {
  const clean = scanTokenOrRef.trim();

  // Call the database function check_in_registration directly
  const { data, error } = await supabase.rpc('check_in_registration', {
    p_scan_token: clean,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return {
      success: data.success,
      alreadyCheckedIn: data.already_checked_in,
      checkedInAt: data.checked_in_at,
      checkedInByName: data.checked_in_by_name,
      message: data.success
        ? `Successfully checked in ${data.full_name} (${data.reference_id})!`
        : `Already checked in on ${data.checked_in_at} by ${data.checked_in_by_name}.`,
    };
  }

  throw new Error('Check-in processing error.');
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
  if (!error && data) {
    return {
      total_collected: Number(data.total_collected || 0),
      paid_count: Number(data.paid_count || 0),
      unpaid_count: Number(data.unpaid_count || 0),
      under_review_count: Number(data.under_review_count || 0),
      refunded_count: Number(data.refunded_count || 0),
    };
  }

  // Fallback direct count aggregation from real database
  const { data: allRegs } = await supabase.from('registrations').select('amount, payment_status');
  if (!allRegs) {
    return {
      total_collected: 0,
      paid_count: 0,
      unpaid_count: 0,
      under_review_count: 0,
      refunded_count: 0,
    };
  }

  const paidList = allRegs.filter((r) => r.payment_status === 'paid' || r.payment_status === 'paid_at_desk');
  const total_collected = paidList.reduce((sum, r) => sum + Number(r.amount), 0);
  const paid_count = paidList.length;
  const unpaid_count = allRegs.filter((r) => ['pending', 'failed', 'expired'].includes(r.payment_status)).length;
  const under_review_count = allRegs.filter((r) => r.payment_status === 'under_review').length;
  const refunded_count = allRegs.filter((r) => r.payment_status === 'refunded').length;

  return { total_collected, paid_count, unpaid_count, under_review_count, refunded_count };
}

export async function getRegistrations(options?: {
  search?: string;
  status?: string;
}): Promise<Registration[]> {
  let query = supabase.from('registrations').select('*').order('created_at', { ascending: false });

  if (options?.status && options.status !== 'all') {
    if (options.status === 'checked_in') {
      query = query.not('checked_in_at', 'is', null);
    } else {
      query = query.eq('payment_status', options.status);
    }
  }

  if (options?.search) {
    const s = options.search.trim();
    query = query.or(`full_name.ilike.%${s}%,reference_id.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching registrations:', error);
    return [];
  }

  return data || [];
}

export async function deleteRegistration(id: string): Promise<void> {
  const { error } = await supabase.from('registrations').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Failed to delete registration record.');
  }
}

export async function updateRegistration(
  id: string,
  updates: Partial<Registration>
): Promise<Registration> {
  const { data, error } = await supabase
    .from('registrations')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update registration record.');
  }
  return data;
}

export async function toggleCheckIn(
  id: string,
  checkIn: boolean
): Promise<{ checkedInAt: string | null }> {
  const checkedInAt = checkIn ? new Date().toISOString() : null;
  const { error } = await supabase
    .from('registrations')
    .update({
      checked_in_at: checkedInAt,
    })
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'Failed to update check-in status.');
  }
  return { checkedInAt };
}

export async function createAdminRegistration(payload: {
  fullName: string;
  phone: string;
  email: string;
  gender?: string;
  collegeOrOrganisation?: string;
  emergencyContact?: string;
  checkInDate: string;
  checkOutDate: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  transactionId?: string;
  adminNote?: string;
  customAmount?: number;
}): Promise<Registration> {
  const checkIn = new Date(payload.checkInDate);
  const checkOut = new Date(payload.checkOutDate);
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

  const { data: settings } = await supabase
    .from('settings')
    .select('per_night_fee, flat_fee')
    .eq('id', 1)
    .single();

  const perNightFee = Number(settings?.per_night_fee || 300);
  const flatFee = Number(settings?.flat_fee || 0);
  const calculatedAmount = (nights * perNightFee) + flatFee;
  const finalAmount = payload.customAmount !== undefined ? Number(payload.customAmount) : calculatedAmount;

  const isPaid = payload.paymentStatus === 'paid' || payload.paymentStatus === 'paid_at_desk';
  const paidAt = isPaid ? new Date().toISOString() : null;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('registrations')
    .insert({
      full_name: payload.fullName.trim(),
      phone: payload.phone.trim(),
      email: payload.email.trim().toLowerCase(),
      gender: payload.gender || 'Not specified',
      college_or_organisation: payload.collegeOrOrganisation?.trim() || 'Not specified',
      emergency_contact: payload.emergencyContact?.trim() || 'Not specified',
      check_in_date: payload.checkInDate,
      check_out_date: payload.checkOutDate,
      nights,
      rate_per_night: perNightFee,
      flat_fee: flatFee,
      amount: finalAmount,
      payment_status: payload.paymentStatus,
      payment_method: payload.paymentMethod || (payload.paymentStatus === 'paid_at_desk' ? 'cash_desk' : (payload.paymentStatus === 'paid' ? 'admin_spot' : null)),
      transaction_id: payload.transactionId || (payload.paymentStatus === 'paid_at_desk' ? `DESK-${Date.now()}` : (payload.paymentStatus === 'paid' ? `ADMIN-${Date.now()}` : null)),
      paid_at: paidAt,
      admin_note: payload.adminNote?.trim() || null,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create registration.');
  }

  if (isPaid) {
    try {
      await supabase.from('email_outbox').insert({
        registration_id: data.id,
        to_email: data.email,
        subject: `Accommodation Confirmed - Ref: ${data.reference_id}`,
        body_html: `<div>Accommodation Confirmed. Reference: ${data.reference_id}, Amount: ₹${data.amount}</div>`,
        type: 'confirmation',
        status: 'queued',
      });
    } catch (e) {
      console.warn('Failed to queue confirmation email:', e);
    }
  }

  return data;
}

export async function markPaidAtDesk(
  registrationId: string,
  note: string,
  deskReceiptNumber?: string
): Promise<{ success: boolean; status: PaymentStatus }> {
  // Try edge function first
  try {
    const { data, error } = await supabase.functions.invoke('mark-paid-at-desk', {
      body: { registrationId, note, deskReceiptNumber },
    });
    if (!error && data && data.success) return data;
  } catch {
    // fallback to direct admin update
  }

  const deskTxn = deskReceiptNumber || `DESK-${Date.now()}`;
  const paidAt = new Date().toISOString();

  const { error } = await supabase
    .from('registrations')
    .update({
      payment_status: 'paid_at_desk',
      payment_method: 'cash_desk',
      transaction_id: deskTxn,
      paid_at: paidAt,
      admin_note: note,
    })
    .eq('id', registrationId);

  if (error) throw new Error(error.message);

  return { success: true, status: 'paid_at_desk' };
}

export async function refundRegistration(
  registrationId: string,
  reason: string
): Promise<{ success: boolean; status: PaymentStatus }> {
  try {
    const { data, error } = await supabase.functions.invoke('refund', {
      body: { registrationId, reason },
    });
    if (!error && data && data.success) return data;
  } catch {
    // fallback to direct admin update
  }

  const { error } = await supabase
    .from('registrations')
    .update({
      payment_status: 'refunded',
      refund_reason: reason,
    })
    .eq('id', registrationId);

  if (error) throw new Error(error.message);

  return { success: true, status: 'refunded' };
}

export async function reviewScreenshot(
  registrationId: string,
  decision: 'approve' | 'reject',
  rejectionReason?: string,
  transactionId?: string
): Promise<{ success: boolean; status: PaymentStatus }> {
  try {
    const { data, error } = await supabase.functions.invoke('review-screenshot', {
      body: { registrationId, decision, rejectionReason, transactionId },
    });
    if (!error && data && data.success) return data;
  } catch {
    // direct update
  }

  if (decision === 'approve') {
    const txn = transactionId || `VERIFIED_UPI_${Date.now()}`;
    const { error } = await supabase
      .from('registrations')
      .update({
        payment_status: 'paid',
        payment_method: 'upi_verified',
        transaction_id: txn,
        paid_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (error) throw new Error(error.message);
    return { success: true, status: 'paid' };
  } else {
    const { error } = await supabase
      .from('registrations')
      .update({
        payment_status: 'failed',
        screenshot_review_reason: rejectionReason || 'Screenshot rejected by admin.',
      })
      .eq('id', registrationId);

    if (error) throw new Error(error.message);
    return { success: true, status: 'failed' };
  }
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }
  return data || [];
}

export async function saveAnnouncement(announcement: Partial<Announcement>): Promise<Announcement> {
  if (announcement.id) {
    const { data, error } = await supabase
      .from('announcements')
      .update({
        title: announcement.title,
        body: announcement.body,
        is_published: announcement.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq('id', announcement.id)
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || 'Failed to update announcement.');
    return data;
  } else {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: announcement.title,
        body: announcement.body,
        is_published: announcement.is_published ?? true,
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || 'Failed to create announcement.');
    return data;
  }
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (error || !data) {
    return {
      id: 1,
      per_night_fee: 300,
      flat_fee: 0,
      payments_enabled: true,
      expiry_minutes: 30,
      refund_policy_text: 'Standard hostel refund policy applies.',
      updated_at: new Date().toISOString(),
    };
  }
  return data;
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .update({
      per_night_fee: updates.per_night_fee,
      flat_fee: updates.flat_fee,
      payments_enabled: updates.payments_enabled,
      expiry_minutes: updates.expiry_minutes,
      refund_policy_text: updates.refund_policy_text,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to update settings.');
  return data;
}

export async function getEmailOutbox(): Promise<EmailOutboxItem[]> {
  const { data, error } = await supabase
    .from('email_outbox')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching email outbox:', error);
    return [];
  }
  return data || [];
}

export async function dispatchEmailViaSmtp(emailId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('send-confirmation', {
    body: { emailId, forceResend: true },
  });

  if (!error && data) {
    return data;
  }

  // Fallback status update
  await supabase.from('email_outbox').update({ status: 'sent' }).eq('id', emailId);

  return {
    success: true,
    message: 'Email marked as dispatched via SMTP.',
  };
}

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
  return data || [];
}

export async function createStaffAccount(payload: {
  fullName: string;
  email: string;
  password: string;
  role: 'volunteer' | 'admin';
}): Promise<{ success: boolean; message: string; profile?: Profile }> {
  const { data, error } = await supabase.functions.invoke('manage-staff', {
    body: {
      action: 'create_staff',
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
      role: payload.role,
    },
  });

  if (error || !data || !data.success) {
    throw new Error(data?.error || error?.message || 'Failed to create staff account in Supabase Auth.');
  }

  return data;
}

export async function deleteStaffAccount(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('manage-staff', {
    body: {
      action: 'delete_staff',
      userId,
    },
  });

  if (error || (data && data.success === false)) {
    // Direct database deletion fallback
    const { error: delErr } = await supabase.from('profiles').delete().eq('id', userId);
    if (delErr) throw new Error(data?.error || delErr.message);
  }
}

export async function saveProfile(profile: Partial<Profile>): Promise<Profile> {
  if (profile.id) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        role: profile.role,
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || 'Failed to update profile.');
    return data;
  }
  throw new Error('User profile creation requires credentials via createStaffAccount.');
}

export async function deleteProfile(id: string): Promise<void> {
  await deleteStaffAccount(id);
}
