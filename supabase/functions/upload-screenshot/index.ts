// =============================================================================
// EDGE FUNCTION: upload-screenshot
// Accepts an image upload (base64 or FormData) for a failed, expired, or pending
// registration. Stores the image in private bucket 'payment-screenshots'
// and transitions registration status to 'under_review'.
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const contentType = req.headers.get('content-type') || '';
    let scanToken = '';
    let userNote = '';
    let fileBuffer: Uint8Array | null = null;
    let fileExt = 'jpg';
    let mimeType = 'image/jpeg';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      scanToken = (formData.get('scanToken') as string) || '';
      userNote = (formData.get('userNote') as string) || '';
      const file = formData.get('screenshot') as File;

      if (!file) {
        return errorResponse('No screenshot file uploaded');
      }

      if (file.size > MAX_BYTES) {
        return errorResponse('File size exceeds the 5 MB maximum limit.');
      }

      if (!ALLOWED_MIME.includes(file.type)) {
        return errorResponse('Invalid file format. Only JPG, PNG, and WebP are allowed.');
      }

      mimeType = file.type;
      fileExt = file.name.split('.').pop() || 'jpg';
      fileBuffer = new Uint8Array(await file.arrayBuffer());
    } else {
      // JSON with base64 payload
      const body = await req.json();
      scanToken = body.scanToken;
      userNote = body.userNote || '';
      const base64Data = body.base64Image;

      if (!base64Data) {
        return errorResponse('base64Image string is required');
      }

      const match = base64Data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      let rawBase64 = base64Data;
      if (match) {
        mimeType = match[1];
        rawBase64 = match[2];
        fileExt = mimeType.split('/')[1] || 'jpg';
      }

      if (!ALLOWED_MIME.includes(mimeType)) {
        return errorResponse('Invalid file format. Only JPG, PNG, and WebP are allowed.');
      }

      const binaryStr = atob(rawBase64);
      if (binaryStr.length > MAX_BYTES) {
        return errorResponse('File size exceeds 5 MB limit.');
      }

      fileBuffer = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        fileBuffer[i] = binaryStr.charCodeAt(i);
      }
    }

    if (!scanToken) {
      return errorResponse('Scan token is required');
    }

    if (!fileBuffer) {
      return errorResponse('File content is empty');
    }

    const supabase = getAdminClient();

    // Fetch registration
    const { data: reg, error: fetchErr } = await supabase
      .from('registrations')
      .select('id, payment_status, reference_id')
      .eq('scan_token', scanToken)
      .single();

    if (fetchErr || !reg) {
      return errorResponse('Registration not found', 404);
    }

    if (reg.payment_status === 'paid' || reg.payment_status === 'paid_at_desk') {
      return errorResponse('Registration is already paid. Screenshot upload not permitted.');
    }

    // Upload to private bucket 'payment-screenshots'
    const fileName = `${reg.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('payment-screenshots')
      .upload(fileName, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return errorResponse('Failed to upload screenshot to storage: ' + uploadError.message);
    }

    // Update registration status to 'under_review'
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        payment_status: 'under_review',
        screenshot_path: fileName,
        admin_note: userNote ? `Participant note: ${userNote}` : null,
        screenshot_review_reason: null, // Clear any previous rejection reason
      })
      .eq('id', reg.id);

    if (updateError) {
      console.error('Registration status update error:', updateError);
      return errorResponse('Failed to update registration status: ' + updateError.message);
    }

    return jsonResponse({
      success: true,
      status: 'under_review',
      referenceId: reg.reference_id,
      message: 'Screenshot uploaded successfully. Your booking is under review by hostel administration.',
    });
  } catch (err: any) {
    console.error('upload-screenshot error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
