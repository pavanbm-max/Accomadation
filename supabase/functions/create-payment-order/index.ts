// =============================================================================
// EDGE FUNCTION: create-payment-order (PLACEHOLDER)
//
// SECURITY NOTICE:
// Payment success must be confirmed on the server through the gateway webhook
// and signature verification, never trusted from the browser redirect.
// The gateway secret key lives in server-side environment secrets only.
// The frontend may only hold the public key ID.
//
// TODO: Connect Razorpay SDK / API.
// In Razorpay, amounts are in paise (e.g. ₹600 = 60000).
// Keys should be loaded securely from Supabase secrets:
// const keyId = Deno.env.get('RAZORPAY_KEY_ID');
// const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
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

    const { scanToken } = await req.json();
    if (!scanToken) {
      return errorResponse('Scan token is required');
    }

    const supabase = getAdminClient();

    // Expire stale registrations
    await supabase.rpc('expire_stale_registrations');

    // Fetch registration
    const { data: reg, error } = await supabase
      .from('registrations')
      .select('id, amount, payment_status, expires_at, reference_id')
      .eq('scan_token', scanToken)
      .single();

    if (error || !reg) {
      return errorResponse('Registration not found', 404);
    }

    if (reg.payment_status === 'paid' || reg.payment_status === 'paid_at_desk') {
      return errorResponse('Registration is already paid.', 400);
    }

    if (new Date(reg.expires_at).getTime() < Date.now()) {
      return errorResponse('Registration session has expired. Please create a new registration.', 410);
    }

    // Amount in paise for Indian payment gateways (1 INR = 100 paise)
    const amountInPaise = Math.round(Number(reg.amount) * 100);
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Store gateway_order_id in registration
    await supabase
      .from('registrations')
      .update({ gateway_order_id: mockOrderId })
      .eq('id', reg.id);

    return jsonResponse({
      orderId: mockOrderId,
      amount: amountInPaise,
      currency: 'INR',
      publicKey: Deno.env.get('RAZORPAY_KEY_ID') || 'rzp_test_PLACEHOLDER_KEY_ID',
      referenceId: reg.reference_id,
      notes: {
        hostel_registration_id: reg.id,
        reference_id: reg.reference_id,
      },
    });
  } catch (err: any) {
    console.error('create-payment-order error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
