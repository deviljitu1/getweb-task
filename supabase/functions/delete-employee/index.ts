// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsError } = await supabaseUser.auth.getClaims(token)
    if (claimsError || !claims?.claims) return json({ error: 'Unauthorized' }, 401)

    const callerId = claims.claims.sub as string

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: adminCheck } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle()

    const { data: caller } = await admin.from('profiles').select('is_active').eq('user_id', callerId).maybeSingle()
    if (!adminCheck || !caller?.is_active) return json({ error: 'Forbidden: Admin access required' }, 403)

    const { profile_id, user_id } = await req.json()
    if (!profile_id && !user_id) return json({ error: 'profile_id or user_id required' }, 400)

    let targetUserId = user_id as string | undefined
    if (!targetUserId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('user_id')
        .eq('id', profile_id)
        .maybeSingle()
      if (!profile) return json({ error: 'Profile not found' }, 404)
      targetUserId = profile.user_id
    }

    if (targetUserId === callerId) {
      return json({ error: 'You cannot delete your own account' }, 400)
    }
    if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) return json({ error: 'Invalid user ID' }, 400)

    // Clean up all child tables referencing the target user
    await admin.from('messages').delete().or(`sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`)
    await admin.from('time_sessions').delete().eq('created_by', targetUserId)
    await admin.from('tasks').delete().eq('user_id', targetUserId)
    await admin.from('daily_standups').delete().eq('user_id', targetUserId)
    await admin.from('user_device_tokens').delete().eq('user_id', targetUserId)
    await admin.from('user_roles').delete().eq('user_id', targetUserId)
    await admin.from('profiles').delete().eq('user_id', targetUserId)

    // Delete auth user if it exists in auth.users
    try {
      await admin.auth.admin.deleteUser(targetUserId!)
    } catch (authErr) {
      console.warn('Could not delete auth user or user already gone:', authErr)
    }

    return json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('delete-employee error:', msg)
    return json({ error: msg }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
