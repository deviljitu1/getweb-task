import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AccessToken, RoomServiceClient } from 'npm:livekit-server-sdk@2.19.2';
import { TrackSource } from 'npm:@livekit/protocol@1.51.0';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Sign in to join a call' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !auth.user) return respond({ error: 'Sign in to join a call' }, 401);
    const { data: profile, error: profileError } = await client.from('profiles').select('name,is_active').eq('user_id', auth.user.id).single();
    if (profileError || !profile?.is_active) return respond({ error: 'Active team account required' }, 403);
    const body = await req.json();
    const groupId = body.group_id || null;
    if (groupId && (typeof groupId !== 'string' || !/^[0-9a-f-]{36}$/i.test(groupId))) return respond({ error: 'Invalid group' }, 400);
    if (body.action === 'update_group') {
      if (!groupId) return respond({ error: 'Select a group' }, 400);
      const { data: manager } = await client.from('chat_group_members').select('role').eq('group_id', groupId).eq('user_id', auth.user.id).maybeSingle();
      if (manager?.role !== 'admin') return respond({ error: 'Group administrator access required' }, 403);
      if (typeof body.group_name !== 'string' || !Array.isArray(body.member_ids) || body.member_ids.length > 50 || body.member_ids.some((id: unknown) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) return respond({ error: 'Invalid group details' }, 400);
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { error: updateError } = await admin.rpc('update_chat_group_server', { actor_id: auth.user.id, target_group: groupId, group_name: body.group_name, member_ids: body.member_ids });
      if (updateError) return respond({ error: updateError.message }, 400);
      const url = Deno.env.get('LIVEKIT_URL'), key = Deno.env.get('LIVEKIT_API_KEY'), secret = Deno.env.get('LIVEKIT_API_SECRET');
      if (url && key && secret) {
        try {
          const rooms = new RoomServiceClient(url.replace(/^wss:/, 'https:'), key, secret);
          const roomName = `getweb-${groupId}`;
          if ((await rooms.listRooms([roomName])).length) {
            const { data: members, error: membersError } = await admin.from('chat_group_members').select('user_id').eq('group_id', groupId);
            if (membersError) throw membersError;
            const memberIds = (members || []).map(member => member.user_id);
            const { data: activeMembers, error: activeError } = await admin.from('profiles').select('user_id').in('user_id', memberIds).eq('is_active', true);
            if (activeError) throw activeError;
            const allowed = new Set((activeMembers || []).map(member => member.user_id));
            const participants = await rooms.listParticipants(roomName);
            await Promise.all(participants.filter(person => !allowed.has(person.identity)).map(person => rooms.removeParticipant(roomName, person.identity, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) })));
          }
        } catch {
          return respond({ error: 'Membership was saved, but call access could not be refreshed. Retry Save group to finish synchronising the call.' }, 503);
        }
      }
      return respond({ success: true });
    }
    if (groupId) {
      const { data: membership, error } = await client.from('chat_group_members').select('user_id').eq('group_id', groupId).eq('user_id', auth.user.id).maybeSingle();
      if (error || !membership) return respond({ error: 'Join this chat group before joining its call' }, 403);
    }
    if (body.check_access) return respond({ allowed: true });
    const url = Deno.env.get('LIVEKIT_URL');
    const key = Deno.env.get('LIVEKIT_API_KEY');
    const secret = Deno.env.get('LIVEKIT_API_SECRET');
    if (!url || !key || !secret) return respond({ configured: false, error: 'Group calls are waiting for the workspace administrator to connect LiveKit.' });
    if (!url.startsWith('wss://')) return respond({ error: 'The call service URL is invalid' }, 503);
    const token = new AccessToken(key, secret, { identity: auth.user.id, name: profile.name, ttl: '10m' });
    token.addGrant({ roomJoin: true, room: `getweb-${groupId || 'workspace'}`, canSubscribe: true, canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canPublishData: false, canUpdateOwnMetadata: false });
    return respond({ configured: true, url, token: await token.toJwt() });
  } catch {
    return respond({ error: 'The group call could not be authorised. Please try again.' }, 500);
  }
});
