// =============================================================================
// EDGE FUNCTION: manage-staff (ADMIN ONLY)
//
// Allows the hostel administrator to dynamically create and delete staff
// and volunteer accounts directly in Supabase Auth & public.profiles table.
//
// Enforces caller role = 'admin'.
// Uses the Supabase Service Role Key on the server to safely manage auth.users.
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

    // Verify admin token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('Unauthorized: Valid administrator token required', 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return errorResponse('Forbidden: Only administrators can manage staff accounts.', 403);
    }

    const body = await req.json();
    const { action } = body;

    // 1. ACTION: CREATE VOLUNTEER OR ADMIN
    if (action === 'create_staff') {
      const { email, password, fullName, role = 'volunteer' } = body;

      if (!email || !password || !fullName) {
        return errorResponse('Email, password, and full name are required.');
      }

      if (password.length < 6) {
        return errorResponse('Password must be at least 6 characters.');
      }

      const cleanEmail = email.trim().toLowerCase();

      // Create user in Supabase Auth via admin API
      const { data: newAuthUser, error: authCreateErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
        },
      });

      if (authCreateErr || !newAuthUser.user) {
        return errorResponse(authCreateErr?.message || 'Failed to create user in Supabase Auth');
      }

      // Insert into public.profiles
      const { data: newProfile, error: profileErr } = await supabase
        .from('profiles')
        .insert({
          id: newAuthUser.user.id,
          full_name: fullName.trim(),
          role: role === 'admin' ? 'admin' : 'volunteer',
        })
        .select('*')
        .single();

      if (profileErr) {
        console.error('Failed to create profile row, cleaning up auth user:', profileErr);
        await supabase.auth.admin.deleteUser(newAuthUser.user.id);
        return errorResponse('Failed to create profile record: ' + profileErr.message);
      }

      return jsonResponse({
        success: true,
        message: `${role === 'admin' ? 'Administrator' : 'Volunteer'} account created successfully.`,
        profile: newProfile,
      });
    }

    // 2. ACTION: DELETE STAFF MEMBER
    if (action === 'delete_staff') {
      const { userId } = body;
      if (!userId) {
        return errorResponse('userId is required');
      }

      if (userId === user.id) {
        return errorResponse('Cannot delete your own administrator account.', 400);
      }

      // Delete from Auth (cascades to profiles)
      const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
      if (delErr) {
        // Also ensure profile is removed
        await supabase.from('profiles').delete().eq('id', userId);
      }

      return jsonResponse({
        success: true,
        message: 'Staff member account removed successfully.',
      });
    }

    return errorResponse('Invalid action specified. Supported: "create_staff", "delete_staff".');
  } catch (err: any) {
    console.error('manage-staff error:', err);
    return errorResponse(err.message || 'Server error', 500);
  }
});
