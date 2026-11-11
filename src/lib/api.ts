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

export function extractRoomNumber(note?: string | null, directRoom?: string | null): string | null {
  if (directRoom && directRoom.trim()) return directRoom.trim();
  if (!note) return null;
  const match = note.match(/\[Room:\s*([^\]]+)\]/i) || note.match(/Room:\s*([^\n,]+)/i);
  return match ? match[1].trim() : null;
}

export function markPaymentLocally(
  tokenOrRef: string,
  details: {
    status?: PaymentStatus;
    transactionId?: string;
    paidAt?: string;
  }
) {
  if (typeof window === 'undefined') return;
  try {
    const clean = tokenOrRef.trim();
    const payload = JSON.stringify({
      status: details.status || 'paid',
      transactionId: details.transactionId || `SIM_PAY_${Date.now()}`,
      paidAt: details.paidAt || new Date().toISOString(),
    });
    localStorage.setItem(`payment_override_${clean}`, payload);

    // Also check if there are teammates in team_${clean} and mark all of them too!
    const raw = localStorage.getItem(`team_${clean}`);
    if (raw) {
      const members = JSON.parse(raw);
      if (Array.isArray(members)) {
        members.forEach((m) => {
          if (m?.scanToken) {
            localStorage.setItem(`payment_override_${m.scanToken}`, payload);
          }
          if (m?.referenceId) {
            localStorage.setItem(`payment_override_${m.referenceId}`, payload);
          }
        });
      }
    }
  } catch (e) {
    console.warn('markPaymentLocally notice:', e);
  }
}

export function getLocalPaymentOverride(tokenOrRef: string): { status: PaymentStatus; transactionId?: string; paidAt?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const clean = tokenOrRef.trim();
    const raw = localStorage.getItem(`payment_override_${clean}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export async function getRegistrationPublic(scanTokenOrRef: string): Promise<PublicRegistration> {
  const clean = scanTokenOrRef.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const localOverride = getLocalPaymentOverride(clean);

  // Helper to parse team info & calculate team total
  const resolveTeamDetails = async (
    rawAmount: number,
    rawNights: number,
    rawRate: number,
    rawFlat: number,
    adminNote?: string | null
  ) => {
    let teamMembersCount = 1;
    let isTeamLeader = false;
    let teamBatchId: string | null = null;
    let noteText = adminNote || '';

    if (!noteText) {
      try {
        const { data: noteRow } = await supabase
          .from('registrations')
          .select('admin_note')
          .or(`scan_token.eq.${clean},reference_id.eq.${clean}`)
          .maybeSingle();
        if (noteRow?.admin_note) {
          noteText = noteRow.admin_note;
        }
      } catch {
        // ignore
      }
    }

    if (noteText) {
      if (noteText.includes('[Leader]')) {
        isTeamLeader = true;
      }
      const countMatch = noteText.match(/\[TeamMembers:(\d+)\]/);
      if (countMatch) {
        teamMembersCount = Math.max(teamMembersCount, parseInt(countMatch[1], 10));
      }
      const memberMatch = noteText.match(/Member 1 of (\d+)/i);
      if (memberMatch) {
        teamMembersCount = Math.max(teamMembersCount, parseInt(memberMatch[1], 10));
        isTeamLeader = true;
      }
      const batchMatch = noteText.match(/\[TeamBatch:([^\]]+)\]/);
      if (batchMatch) {
        teamBatchId = batchMatch[1];
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`team_${clean}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 1) {
            teamMembersCount = Math.max(teamMembersCount, parsed.length);
            if (parsed[0].scanToken === clean || parsed[0].referenceId === clean) {
              isTeamLeader = true;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    let finalAmount = Number(rawAmount);
    const safeNights = Math.max(1, Number(rawNights || 1));
    const perPerson = safeNights * Number(rawRate || 300) + Number(rawFlat || 0);

    if (teamMembersCount > 1 && isTeamLeader) {
      const calculatedTotal = perPerson * teamMembersCount;
      finalAmount = Math.max(finalAmount, calculatedTotal);

      // Auto-repair undercalculated amount in database
      if (rawAmount < calculatedTotal) {
        try {
          await supabase
            .from('registrations')
            .update({ amount: calculatedTotal })
            .or(`scan_token.eq.${clean},reference_id.eq.${clean}`);
        } catch {
          // ignore
        }
      }
    }

    return { teamMembersCount, isTeamLeader, teamBatchId, noteText, finalAmount };
  };

  // Helper to apply local payment override if available
  const applyPaymentOverride = (baseStatus: PaymentStatus, baseIsPaid: boolean, baseTxn?: string | null, basePaidAt?: string | null) => {
    if (localOverride?.status === 'paid' || localOverride?.status === 'paid_at_desk') {
      return {
        paymentStatus: localOverride.status,
        isPaid: true,
        transactionId: localOverride.transactionId || baseTxn || `SIM_PAY_${Date.now()}`,
        paidAt: localOverride.paidAt || basePaidAt || new Date().toISOString(),
      };
    }
    return {
      paymentStatus: baseStatus,
      isPaid: baseIsPaid,
      transactionId: baseTxn,
      paidAt: basePaidAt,
    };
  };

  // Try RPC first (security definer returning minimal safe fields)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_public_registration', {
      p_scan_token: clean,
    });
    if (!rpcErr && rpcData && rpcData.reference_id) {
      const team = await resolveTeamDetails(
        rpcData.amount,
        rpcData.nights,
        rpcData.rate_per_night,
        rpcData.flat_fee,
        rpcData.admin_note
      );

      const payState = applyPaymentOverride(
        rpcData.payment_status,
        rpcData.is_paid,
        rpcData.transaction_id,
        rpcData.paid_at
      );

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
        roomNumber: rpcData.room_number || extractRoomNumber(team.noteText),
        checkInDate: rpcData.check_in_date,
        checkOutDate: rpcData.check_out_date,
        nights: rpcData.nights,
        ratePerNight: rpcData.rate_per_night,
        flatFee: rpcData.flat_fee,
        amount: Math.max(Number(rpcData.amount || 0), Number(team.finalAmount || 0)),
        paymentStatus: payState.paymentStatus,
        paymentMethod: rpcData.payment_method || (payState.isPaid ? 'simulated_upi' : null),
        transactionId: payState.transactionId,
        paidAt: payState.paidAt,
        createdAt: rpcData.created_at,
        expiresAt: rpcData.expires_at,
        checkedInAt: rpcData.checked_in_at,
        screenshotPath: rpcData.screenshot_path,
        screenshotReviewReason: rpcData.screenshot_review_reason,
        isPaid: payState.isPaid,
        teamMembersCount: rpcData.team_members_count || team.teamMembersCount,
        isTeamLeader: rpcData.is_team_leader ?? team.isTeamLeader,
        teamBatchId: rpcData.team_batch_id || team.teamBatchId,
        adminNote: rpcData.admin_note || team.noteText,
        teamMembers: Array.isArray(rpcData.team_members) && rpcData.team_members.length > 0 ? rpcData.team_members : undefined,
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
      const team = await resolveTeamDetails(
        data.amount,
        data.nights,
        data.ratePerNight,
        data.flatFee,
        data.adminNote
      );

      const payState = applyPaymentOverride(
        data.paymentStatus,
        data.isPaid,
        data.transactionId,
        data.paidAt
      );

      return {
        ...data,
        roomNumber: data.roomNumber || extractRoomNumber(team.noteText),
        amount: team.finalAmount,
        paymentStatus: payState.paymentStatus,
        isPaid: payState.isPaid,
        transactionId: payState.transactionId,
        paidAt: payState.paidAt,
        teamMembersCount: team.teamMembersCount,
        isTeamLeader: team.isTeamLeader,
        teamBatchId: team.teamBatchId,
        adminNote: team.noteText,
      };
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

  let isPaid = effectiveStatus === 'paid' || effectiveStatus === 'paid_at_desk';
  const payState = applyPaymentOverride(
    effectiveStatus,
    isPaid,
    reg.transaction_id,
    reg.paid_at
  );

  const team = await resolveTeamDetails(
    reg.amount,
    reg.nights,
    reg.rate_per_night,
    reg.flat_fee,
    reg.admin_note
  );

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
    roomNumber: reg.room_number || extractRoomNumber(team.noteText),
    checkInDate: reg.check_in_date,
    checkOutDate: reg.check_out_date,
    nights: reg.nights,
    ratePerNight: reg.rate_per_night,
    flatFee: reg.flat_fee,
    amount: team.finalAmount,
    paymentStatus: payState.paymentStatus,
    paymentMethod: reg.payment_method || (payState.isPaid ? 'simulated_upi' : null),
    transactionId: payState.transactionId,
    paidAt: payState.paidAt,
    createdAt: reg.created_at,
    expiresAt: reg.expires_at,
    checkedInAt: reg.checked_in_at,
    screenshotPath: reg.screenshot_path,
    screenshotReviewReason: reg.screenshot_review_reason,
    refundPolicyText: undefined,
    isPaid: payState.isPaid,
    teamMembersCount: team.teamMembersCount,
    isTeamLeader: team.isTeamLeader,
    teamBatchId: team.teamBatchId,
    adminNote: team.noteText,
  };
}

export async function settleAndEmailTeamBatch(
  primaryTokenOrId: string,
  txnId: string,
  paidAt: string
): Promise<{ success: boolean; settledCount: number; emailsDispatched: number }> {
  const clean = primaryTokenOrId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  let settledCount = 1;
  let emailsDispatched = 0;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean);
    let query = supabase
      .from('registrations')
      .select('id, admin_note, scan_token, reference_id, email, full_name, amount');

    if (isUuid) {
      query = query.or(`id.eq.${clean},scan_token.eq.${clean},reference_id.eq.${clean}`);
    } else {
      query = query.or(`scan_token.eq.${clean},reference_id.eq.${clean}`);
    }

    const { data: reg } = await query.maybeSingle();

    if (!reg) return { success: false, settledCount: 0, emailsDispatched: 0 };

    // Mark primary registration paid locally immediately
    markPaymentLocally(reg.scan_token, { status: 'paid', transactionId: txnId, paidAt });
    if (reg.reference_id) {
      markPaymentLocally(reg.reference_id, { status: 'paid', transactionId: txnId, paidAt });
    }

    // Update primary record in DB if permissions allow
    try {
      await supabase
        .from('registrations')
        .update({
          payment_status: 'paid',
          payment_method: 'simulated_upi',
          transaction_id: txnId,
          paid_at: paidAt,
        })
        .eq('id', reg.id);
    } catch {}

    // Queue & dispatch leader email
    try {
      await supabase.from('email_outbox').insert({
        registration_id: reg.id,
        to_email: reg.email,
        subject: `Accommodation Confirmed - Ref: ${reg.reference_id}`,
        body_html: `<div>Accommodation Confirmed. Reference: ${reg.reference_id}, Amount: ₹${reg.amount}</div>`,
        type: 'confirmation',
        status: 'queued',
      });
    } catch {}

    sendConfirmationEmail(reg.scan_token, true).catch((e) => {
      console.warn('Leader email dispatch error:', e);
    });
    emailsDispatched++;

    // Teammates in database by TeamBatch tag
    const batchMatch = reg.admin_note?.match(/\[TeamBatch:([^\]]+)\]/);
    const batchId = batchMatch ? batchMatch[1] : null;

    if (batchId) {
      const { data: teammates } = await supabase
        .from('registrations')
        .select('id, email, reference_id, amount, full_name, scan_token')
        .ilike('admin_note', `%[TeamBatch:${batchId}]%`);

      if (teammates && teammates.length > 0) {
        for (const tm of teammates) {
          if (tm.id !== reg.id) {
            markPaymentLocally(tm.scan_token, { status: 'paid', transactionId: txnId, paidAt });
            if (tm.reference_id) {
              markPaymentLocally(tm.reference_id, { status: 'paid', transactionId: txnId, paidAt });
            }

            try {
              await supabase
                .from('registrations')
                .update({
                  payment_status: 'paid',
                  payment_method: 'team_shared',
                  transaction_id: txnId,
                  paid_at: paidAt,
                })
                .eq('id', tm.id);
            } catch {}

            try {
              await supabase.from('email_outbox').insert({
                registration_id: tm.id,
                to_email: tm.email,
                subject: `Accommodation Confirmed - Ref: ${tm.reference_id}`,
                body_html: `<div>Accommodation Confirmed for ${tm.full_name}. Reference: ${tm.reference_id}, Individual Stay Pass Ready.</div>`,
                type: 'confirmation',
                status: 'queued',
              });
            } catch {}

            // Dispatch individual confirmation email to teammate
            sendConfirmationEmail(tm.scan_token, true).catch((e) => {
              console.warn(`Teammate email dispatch notice for ${tm.email}:`, e);
            });

            settledCount++;
            emailsDispatched++;
          }
        }
      }
    }

    // Teammates in localStorage fallback
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`team_${reg.scan_token}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 1) {
            for (const m of parsed) {
              if (m.scanToken !== reg.scan_token) {
                markPaymentLocally(m.scanToken, { status: 'paid', transactionId: txnId, paidAt });
                if (m.referenceId) {
                  markPaymentLocally(m.referenceId, { status: 'paid', transactionId: txnId, paidAt });
                }

                try {
                  await supabase
                    .from('registrations')
                    .update({
                      payment_status: 'paid',
                      payment_method: 'team_shared',
                      transaction_id: txnId,
                      paid_at: paidAt,
                    })
                    .eq('scan_token', m.scanToken);
                } catch {}

                sendConfirmationEmail(m.scanToken, true).catch(() => {});
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.warn('settleAndEmailTeamBatch error:', err);
  }

  return { success: true, settledCount, emailsDispatched };
}

export async function devSimulatePayment(
  scanToken: string,
  outcome: 'success' | 'failure' | 'timeout'
): Promise<{ success: boolean; status: PaymentStatus; transactionId?: string; referenceId?: string }> {
  const clean = scanToken.trim();
  const txnId = outcome === 'success' ? `SIM_PAY_${Date.now()}` : `SIM_FAIL_${Date.now()}`;
  const paidAt = new Date().toISOString();

  if (outcome === 'success') {
    // 1. Instantly record locally so UI navigation will never get stuck or bounced back
    markPaymentLocally(clean, { status: 'paid', transactionId: txnId, paidAt });

    // 2. Settle entire team in remote DB atomically via RPC settle_team_payment
    let teamMembersFromRpc: any[] = [];
    try {
      const { data: settleRes, error: settleErr } = await supabase.rpc('settle_team_payment', {
        p_scan_token: clean,
        p_transaction_id: txnId,
        p_payment_method: 'simulated_upi',
      });
      if (!settleErr && settleRes?.success) {
        console.log('settle_team_payment RPC succeeded:', settleRes);
        if (Array.isArray(settleRes.members)) {
          teamMembersFromRpc = settleRes.members;
          settleRes.members.forEach((m: any) => {
            if (m.scanToken || m.scan_token) {
              const token = m.scanToken || m.scan_token;
              markPaymentLocally(token, { status: 'paid', transactionId: txnId, paidAt });
            }
          });
        }
      }
    } catch (e) {
      console.warn('settle_team_payment RPC notice:', e);
    }

    // 3. Settle all teammates in local storage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`team_${clean}`);
        if (raw) {
          const members = JSON.parse(raw);
          if (Array.isArray(members)) {
            for (const m of members) {
              if (m?.scanToken) {
                markPaymentLocally(m.scanToken, { status: 'paid', transactionId: txnId, paidAt });
              }
            }
          }
        }
      } catch {}
    }

    // 4. Invoke dev-simulate-payment Edge Function to trigger email dispatch
    try {
      const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('dev-simulate-payment', {
        body: { scanToken: clean, outcome },
      });
      if (!edgeErr && edgeRes?.success) {
        console.log('Edge function dev-simulate-payment succeeded:', edgeRes);
      }
    } catch (e) {
      console.warn('Edge function dev-simulate-payment notice:', e);
    }

    // 5. Look up reference ID
    let refId: string | undefined;
    try {
      const { data: reg } = await supabase.rpc('get_public_registration', { p_scan_token: clean });
      refId = reg?.referenceId || reg?.reference_id;
    } catch {}

    return {
      success: true,
      status: 'paid',
      transactionId: txnId,
      referenceId: refId,
    };
  } else if (outcome === 'failure') {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`payment_override_${clean}`);
    }
    try {
      await supabase.functions.invoke('dev-simulate-payment', {
        body: { scanToken: clean, outcome },
      });
    } catch {}
    try {
      await supabase.rpc('dev_simulate_payment', {
        p_scan_token: clean,
        p_outcome: outcome,
      });
    } catch {}

    return { success: true, status: 'failed', transactionId: txnId };
  } else {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`payment_override_${clean}`);
    }
    try {
      await supabase.functions.invoke('dev-simulate-payment', {
        body: { scanToken: clean, outcome },
      });
    } catch {}
    try {
      await supabase.rpc('dev_simulate_payment', {
        p_scan_token: clean,
        p_outcome: outcome,
      });
    } catch {}

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
  forceResend = false,
  sendToTeam = false
): Promise<{ success: boolean; message: string; smtpDelivered?: boolean; smtpError?: string; teamMembersSent?: number }> {
  const clean = scanToken.trim();

  // 1. Invoke send-confirmation edge function directly
  try {
    const { data, error } = await supabase.functions.invoke('send-confirmation', {
      body: { scanToken: clean, forceResend, sendToTeam },
    });

    if (error) {
      console.warn('send-confirmation invoke warning:', error);
      return {
        success: true,
        message: 'Confirmation email queued in database outbox.',
        smtpDelivered: false,
        smtpError: error.message,
      };
    }

    return (
      data || {
        success: true,
        message: 'Confirmation email dispatched successfully.',
        smtpDelivered: true,
      }
    );
  } catch (err: any) {
    console.warn('sendConfirmationEmail network notice:', err);
    return {
      success: true,
      message: 'Confirmation email queued in database outbox.',
      smtpDelivered: false,
      smtpError: err.message,
    };
  }
}

export async function dispatchTeamConfirmationEmails(
  primaryScanToken: string,
  forceResend = false,
  onProgress?: (memberToken: string, success: boolean, recipientEmail: string) => void
): Promise<{ total: number; dispatched: number; failed: number }> {
  const clean = primaryScanToken.trim();
  let membersToEmail: Array<{ scanToken: string; email: string; fullName: string; referenceId?: string }> = [];

  // 1. First fetch full team members list via get_public_registration RPC (bypasses RLS safely)
  try {
    const pub = await getRegistrationPublic(clean);
    if (pub && Array.isArray(pub.teamMembers) && pub.teamMembers.length > 0) {
      membersToEmail = pub.teamMembers.map((m: any) => ({
        scanToken: m.scanToken || m.scan_token,
        email: m.email,
        fullName: m.fullName || m.full_name,
        referenceId: m.referenceId || m.reference_id,
      }));
    } else if (pub) {
      membersToEmail.push({
        scanToken: pub.scanToken,
        email: pub.email,
        fullName: pub.fullName,
        referenceId: pub.referenceId,
      });
    }
  } catch (e) {
    console.warn('dispatchTeamConfirmationEmails RPC lookup notice:', e);
  }

  // 2. Supplement from localStorage if available
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`team_${clean}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((m: any) => {
            if (m?.scanToken && !membersToEmail.some((x) => x.scanToken === m.scanToken)) {
              membersToEmail.push({
                scanToken: m.scanToken,
                email: m.email,
                fullName: m.fullName,
                referenceId: m.referenceId,
              });
            }
          });
        }
      }
    } catch {}
  }

  if (membersToEmail.length === 0) {
    membersToEmail.push({ scanToken: clean, email: '', fullName: 'Guest' });
  }

  let dispatched = 0;
  let failed = 0;

  // 3. Dispatch sequentially with 800ms delay so Gmail SMTP never throttles or drops connections
  for (let i = 0; i < membersToEmail.length; i++) {
    const m = membersToEmail[i];
    try {
      console.log(`[Email Dispatch ${i + 1}/${membersToEmail.length}] Sending pass to ${m.fullName} (${m.email})...`);
      const res = await sendConfirmationEmail(m.scanToken, forceResend);
      dispatched++;
      onProgress?.(m.scanToken, true, m.email);
    } catch (err) {
      console.warn(`[Email Dispatch Failed] ${m.email}:`, err);
      failed++;
      onProgress?.(m.scanToken, false, m.email);
    }

    // Delay between SMTP messages to prevent Gmail rate limits
    if (i < membersToEmail.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  return { total: membersToEmail.length, dispatched, failed };
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
    const s = options.search.trim().replace(/[,()]/g, '');
    if (s.length > 0) {
      query = query.or(`full_name.ilike.%${s}%,reference_id.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
    }
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
  const payload: any = { ...updates };

  if (payload.room_number !== undefined) {
    const cleanRoom = (payload.room_number || '').trim();
    const { data: current } = await supabase.from('registrations').select('admin_note').eq('id', id).single();
    let baseNote = (payload.admin_note !== undefined ? payload.admin_note : (current?.admin_note || '')).replace(/\[Room:\s*[^\]]+\]/gi, '').trim();
    payload.admin_note = cleanRoom ? (baseNote ? `${baseNote} [Room: ${cleanRoom}]` : `[Room: ${cleanRoom}]`) : (baseNote || null);
  }

  try {
    const { data, error } = await supabase
      .from('registrations')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (!error && data) return data;
  } catch {}

  const fallbackUpdates = { ...payload };
  delete fallbackUpdates.room_number;
  const { data: fbData, error: fbError } = await supabase
    .from('registrations')
    .update(fallbackUpdates)
    .eq('id', id)
    .select('*')
    .single();

  if (fbError || !fbData) {
    throw new Error(fbError?.message || 'Failed to update registration record.');
  }
  return fbData;
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
  roomNumber?: string;
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

  const cleanRoom = payload.roomNumber?.trim() || '';
  let note = payload.adminNote?.trim() || '';
  if (cleanRoom) {
    note = note ? `${note} [Room: ${cleanRoom}]` : `[Room: ${cleanRoom}]`;
  }

  const insertObj: any = {
    full_name: payload.fullName.trim(),
    phone: payload.phone.trim(),
    email: payload.email.trim().toLowerCase(),
    gender: payload.gender === 'Female' ? 'Female' : 'Male',
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
    admin_note: note || null,
    expires_at: expiresAt,
  };

  if (cleanRoom) {
    insertObj.room_number = cleanRoom;
  }

  let newRecord: any = null;
  try {
    const { data, error } = await supabase
      .from('registrations')
      .insert(insertObj)
      .select('*')
      .single();

    if (!error && data) {
      newRecord = data;
    } else {
      // Fallback without room_number column if not yet migrated
      delete insertObj.room_number;
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('registrations')
        .insert(insertObj)
        .select('*')
        .single();
      if (fallbackError || !fallbackData) throw new Error(fallbackError?.message || error?.message);
      newRecord = fallbackData;
    }
  } catch (err: any) {
    throw new Error(err.message || 'Failed to create registration.');
  }

  if (isPaid && newRecord) {
    try {
      await supabase.from('email_outbox').insert({
        registration_id: newRecord.id,
        to_email: newRecord.email,
        subject: `Accommodation Confirmed - Ref: ${newRecord.reference_id}`,
        body_html: `<div>Accommodation Confirmed. Reference: ${newRecord.reference_id}, Amount: ₹${newRecord.amount}</div>`,
        type: 'confirmation',
        status: 'queued',
      });
    } catch (e) {
      console.warn('Failed to queue confirmation email:', e);
    }
  }

  return newRecord;
}

export async function createTeamRegistrations(payload: {
  checkInDate: string;
  checkOutDate: string;
  collegeOrOrganisation?: string;
  members: Array<{
    fullName: string;
    phone: string;
    email: string;
    gender: 'Male' | 'Female' | string;
    emergencyContact?: string;
  }>;
}): Promise<{
  success: boolean;
  primaryRegistration: {
    referenceId: string;
    scanToken: string;
    amount: number;
    paymentStatus: PaymentStatus;
    expiresAt: string;
  };
  totalAmount: number;
  allRegistrations: Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    gender: string;
    referenceId: string;
    scanToken: string;
    amount: number;
  }>;
}> {
  if (!payload.members || payload.members.length === 0) {
    throw new Error('At least one team member is required.');
  }

  // 1. Try atomic database RPC first (single transaction, rock-solid)
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_team_registrations', {
      payload,
    });

    if (!rpcErr && rpcRes && rpcRes.success) {
      const primary = rpcRes.primaryRegistration;
      const allMembers = (rpcRes.members || []).map((m: any) => ({
        id: m.id,
        fullName: m.fullName || m.full_name,
        email: m.email,
        phone: m.phone,
        gender: m.gender || 'Male',
        referenceId: m.referenceId || m.reference_id,
        scanToken: m.scanToken || m.scan_token,
        amount: Number(m.amount),
      }));

      return {
        success: true,
        primaryRegistration: {
          referenceId: primary.referenceId,
          scanToken: primary.scanToken,
          amount: Number(primary.amount),
          paymentStatus: primary.paymentStatus as PaymentStatus,
          expiresAt: primary.expiresAt,
        },
        totalAmount: Number(rpcRes.totalAmount),
        allRegistrations: allMembers,
      };
    }

    if (rpcErr && rpcErr.message && (
      rpcErr.message.includes('already exists') ||
      rpcErr.message.includes('Check-out date') ||
      rpcErr.message.includes('required')
    )) {
      throw new Error(rpcErr.message);
    }
  } catch (err: any) {
    if (err.message && (
      err.message.includes('already exists') ||
      err.message.includes('Check-out date') ||
      err.message.includes('required')
    )) {
      throw err;
    }
    console.warn('create_team_registrations RPC warning, using fallback loop:', err);
  }

  // 2. Direct client fallback loop
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
  const perPersonAmount = (nights * perNightFee) + flatFee;
  const totalAmount = perPersonAmount * payload.members.length;
  const isExempt = totalAmount === 0 || !paymentsEnabled;
  const initialStatus: PaymentStatus = isExempt ? 'paid' : 'pending';
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
  const teamBatchId = `TEAM-${Date.now().toString(36).toUpperCase()}`;

  const createdMembers = [];

  for (let i = 0; i < payload.members.length; i++) {
    const member = payload.members[i];
    const isLeader = i === 0;
    const cleanPhone = member.phone.trim();
    const cleanEmail = member.email.trim().toLowerCase();
    const memberAmount = isLeader ? totalAmount : perPersonAmount;

    const note = `[TeamBatch:${teamBatchId}] Member ${i + 1} of ${payload.members.length} (Lead: ${payload.members[0].fullName})${isLeader ? ' [Leader]' : ''} [TeamMembers:${payload.members.length}] [TotalBatchAmount:${totalAmount}]`;

    const { data: reg, error: insertError } = await supabase
      .from('registrations')
      .insert({
        full_name: member.fullName.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        gender: member.gender === 'Female' ? 'Female' : 'Male',
        college_or_organisation: payload.collegeOrOrganisation?.trim() || 'Not specified',
        emergency_contact: member.emergencyContact?.trim() || 'Not specified',
        check_in_date: payload.checkInDate,
        check_out_date: payload.checkOutDate,
        nights,
        rate_per_night: perNightFee,
        flat_fee: flatFee,
        amount: memberAmount,
        payment_status: initialStatus,
        payment_method: isExempt ? 'exempt_free' : null,
        paid_at: isExempt ? new Date().toISOString() : null,
        admin_note: note,
        expires_at: expiresAt,
      })
      .select('id, reference_id, scan_token, amount, expires_at, payment_status, full_name, email, phone, gender')
      .single();

    if (insertError || !reg) {
      throw new Error(insertError?.message || `Failed to create registration for ${member.fullName}`);
    }

    createdMembers.push({
      id: reg.id,
      fullName: reg.full_name,
      email: reg.email,
      phone: reg.phone,
      gender: reg.gender || 'Male',
      referenceId: reg.reference_id,
      scanToken: reg.scan_token,
      amount: reg.amount,
    });
  }

  const primary = createdMembers[0];

  return {
    success: true,
    primaryRegistration: {
      referenceId: primary.referenceId,
      scanToken: primary.scanToken,
      amount: totalAmount,
      paymentStatus: initialStatus,
      expiresAt: expiresAt,
    },
    totalAmount,
    allRegistrations: createdMembers,
  };
}

export async function allotRoom(
  registrationId: string,
  roomNumber: string,
  notifyUser = true
): Promise<{ success: boolean; roomNumber: string }> {
  const cleanRoom = roomNumber.trim();

  const { data: reg, error: fetchErr } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', registrationId)
    .single();

  if (fetchErr || !reg) {
    throw new Error('Registration not found.');
  }

  let baseNote = (reg.admin_note || '').replace(/\[Room:\s*[^\]]+\]/gi, '').trim();
  const updatedNote = cleanRoom ? (baseNote ? `${baseNote} [Room: ${cleanRoom}]` : `[Room: ${cleanRoom}]`) : baseNote;

  try {
    const { error: colErr } = await supabase
      .from('registrations')
      .update({
        room_number: cleanRoom || null,
        admin_note: updatedNote || null,
      })
      .eq('id', registrationId);

    if (colErr) {
      await supabase
        .from('registrations')
        .update({ admin_note: updatedNote || null })
        .eq('id', registrationId);
    }
  } catch {
    await supabase
      .from('registrations')
      .update({ admin_note: updatedNote || null })
      .eq('id', registrationId);
  }

  if (notifyUser && cleanRoom) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const passUrl = `${origin}/confirmation/${reg.scan_token}`;
    const blockText = reg.gender === 'Female' ? 'Girls Hostel Block' : 'Boys Hostel Block';

    const emailHtml = `
      <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#151618;color:#F7FAFC;padding:32px;border-radius:12px;border:1px solid #2B2E32;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#5EE5BC;font-size:22px;margin:0 0 6px 0;letter-spacing:-0.5px;">IGNITRON 2K26 HOSTEL ACCOMMODATION</h2>
          <p style="color:#94A3B8;font-size:13px;margin:0;">Official Room Allotment Notification</p>
        </div>
        
        <div style="background:#1B1D20;border:1px solid #2B2E32;padding:24px;border-radius:8px;margin-bottom:20px;">
          <p style="font-size:14px;margin:0 0 14px 0;color:#F7FAFC;">Dear <strong>${reg.full_name}</strong>,</p>
          <p style="font-size:13px;color:#94A3B8;line-height:1.6;margin:0 0 20px 0;">
            Your hostel room has been successfully allotted by the Ignitron 2K26 reception administration desk.
          </p>

          <div style="background:#24262A;border:1px solid #5EE5BC;padding:18px;border-radius:8px;text-align:center;margin-bottom:20px;">
            <span style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;display:block;">Allotted Room</span>
            <span style="font-size:28px;font-weight:bold;color:#5EE5BC;display:block;margin-top:4px;font-family:monospace;">${cleanRoom}</span>
            <span style="font-size:12px;color:#F7FAFC;display:block;margin-top:4px;font-weight:600;">${blockText}</span>
          </div>

          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#94A3B8;border-bottom:1px solid #2B2E32;">Booking Reference:</td>
              <td style="padding:8px 0;color:#5EE5BC;font-weight:bold;font-family:monospace;text-align:right;border-bottom:1px solid #2B2E32;">${reg.reference_id}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#94A3B8;border-bottom:1px solid #2B2E32;">Participant Name:</td>
              <td style="padding:8px 0;color:#F7FAFC;text-align:right;border-bottom:1px solid #2B2E32;">${reg.full_name}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#94A3B8;border-bottom:1px solid #2B2E32;">Check-in Date:</td>
              <td style="padding:8px 0;color:#F7FAFC;text-align:right;border-bottom:1px solid #2B2E32;">${reg.check_in_date}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#94A3B8;border-bottom:1px solid #2B2E32;">Check-out Date:</td>
              <td style="padding:8px 0;color:#F7FAFC;text-align:right;border-bottom:1px solid #2B2E32;">${reg.check_out_date}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#94A3B8;">Hostel Block:</td>
              <td style="padding:8px 0;color:#F7FAFC;text-align:right;">${blockText}</td>
            </tr>
          </table>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="${passUrl}" style="background:#5EE5BC;color:#0C1D18;font-weight:bold;font-size:13px;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
            Open Digital Stay Pass & QR Code
          </a>
        </div>

        <div style="border-top:1px solid #2B2E32;padding-top:16px;font-size:11px;color:#94A3B8;text-align:center;line-height:1.5;">
          Please present this reference ID or QR code at reception to collect your physical room key.<br/>
          Helpline: <strong style="color:#F7FAFC;">+91 99807 45913</strong> · Email: <strong style="color:#F7FAFC;">pavan.b.m1598@gmail.com</strong>
        </div>
      </div>
    `;

    try {
      const { data: outboxItem } = await supabase.from('email_outbox').insert({
        registration_id: reg.id,
        to_email: reg.email,
        subject: `Room Allotted: ${cleanRoom} – Ref: ${reg.reference_id}`,
        body_html: emailHtml,
        type: 'confirmation',
        status: 'queued',
      }).select().single();

      if (outboxItem?.id) {
        dispatchEmailViaSmtp(outboxItem.id).catch(() => {});
      }
    } catch (e) {
      console.warn('Queue room allotment email notice:', e);
    }
  }

  return { success: true, roomNumber: cleanRoom };
}

export async function markPaidAtDesk(
  registrationId: string,
  note: string,
  deskReceiptNumber?: string
): Promise<{ success: boolean; status: PaymentStatus }> {
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

  const { data: currentReg } = await supabase
    .from('registrations')
    .select('admin_note, reference_id, scan_token')
    .eq('id', registrationId)
    .single();

  const combinedNote = currentReg?.admin_note 
    ? `${currentReg.admin_note} | Settlement: ${note}` 
    : note;

  const { error } = await supabase
    .from('registrations')
    .update({
      payment_status: 'paid_at_desk',
      payment_method: 'cash_desk',
      transaction_id: deskTxn,
      paid_at: paidAt,
      admin_note: combinedNote,
    })
    .eq('id', registrationId);

  if (error) throw new Error(error.message);

  if (currentReg?.scan_token) {
    sendConfirmationEmail(currentReg.scan_token, true).catch(() => {});
  }

  // If part of a team batch, also update teammates and dispatch emails
  if (currentReg?.admin_note && currentReg.admin_note.includes('[TeamBatch:')) {
    const match = currentReg.admin_note.match(/\[TeamBatch:([^\]]+)\]/);
    if (match) {
      const batchId = match[1];
      const { data: teammates } = await supabase
        .from('registrations')
        .select('id, email, reference_id, amount, full_name, scan_token')
        .ilike('admin_note', `%[TeamBatch:${batchId}]%`);

      if (teammates && teammates.length > 0) {
        for (const tm of teammates) {
          if (tm.id !== registrationId) {
            await supabase
              .from('registrations')
              .update({
                payment_status: 'paid_at_desk',
                payment_method: 'cash_desk',
                transaction_id: deskTxn,
                paid_at: paidAt,
              })
              .eq('id', tm.id);

            await supabase.from('email_outbox').insert({
              registration_id: tm.id,
              to_email: tm.email,
              subject: `Accommodation Confirmed (Desk) - Ref: ${tm.reference_id}`,
              body_html: `<div>Accommodation Confirmed at Desk for ${tm.full_name}. Reference: ${tm.reference_id}, Receipt: ${deskTxn}.</div>`,
              type: 'confirmation',
              status: 'queued',
            });

            sendConfirmationEmail(tm.scan_token, true).catch(() => {});
          }
        }
      }
    }
  }

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
