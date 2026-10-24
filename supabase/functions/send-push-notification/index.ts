import { createClient } from 'npm:@supabase/supabase-js@2';
import { JWT } from 'npm:google-auth-library@9.15.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PushRequest = {
  action?: 'status';
  recipientIds?: string[];
  title?: string;
  body?: string;
  linkUrl?: string | null;
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const readKey = (keySetName: string, legacyName: string) => {
  const directKey = Deno.env.get(legacyName);
  if (directKey) return directKey;
  const keySet = Deno.env.get(keySetName);
  if (!keySet) return undefined;
  try {
    const parsed = JSON.parse(keySet) as Record<string, string>;
    return parsed[legacyName] || parsed.default;
  } catch {
    console.warn(`${keySetName} is not valid JSON`);
    return undefined;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKey = readKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    const secretKey = readKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !publishableKey || !secretKey) {
      return json({ error: 'Server configuration is incomplete' }, 500);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const { data: role, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (roleError || !role) return json({ error: 'Admin access required' }, 403);
    const { data: sender } = await userClient.from('profiles').select('is_active').eq('user_id', userData.user.id).maybeSingle();
    if (!sender?.is_active) return json({ error: 'Active admin account required' }, 403);

    const payload = (await req.json()) as PushRequest;
    if (payload.action === 'status') {
      const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
      const { count, error } = await admin.from('user_device_tokens').select('id', { count: 'exact', head: true });
      if (error) return json({ error: 'Device registration status is unavailable' }, 503);
      return json({ configured: Boolean(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')), registeredDevices: count || 0 });
    }
    if (!Array.isArray(payload.recipientIds) || payload.recipientIds.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) return json({ error: 'Choose valid team recipients' }, 400);
    const recipientIds = [...new Set(payload.recipientIds)];
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const body = typeof payload.body === 'string' ? payload.body.trim() : '';
    const linkUrl = typeof payload.linkUrl === 'string' ? payload.linkUrl.trim() || null : null;

    if (!recipientIds.length || recipientIds.length > 500) {
      return json({ error: 'Choose between 1 and 500 recipients' }, 400);
    }
    if (!title || title.length > 120 || !body || body.length > 1000) {
      return json({ error: 'Notification title or message is invalid' }, 400);
    }
    if (linkUrl && !/^\/(?!\/)[^\\\s]*$/.test(linkUrl)) {
      return json({ error: 'Action link must be an in-app path beginning with /' }, 400);
    }

    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    const { data: recipients, error: recipientsError } = await admin.from('profiles').select('user_id').in('user_id', recipientIds).eq('is_active', true);
    if (recipientsError || recipients?.length !== recipientIds.length) return json({ error: 'One or more selected accounts are disabled or unavailable. Refresh the recipient list.' }, 400);
    const { data: devices, error: deviceError } = await admin
      .from('user_device_tokens')
      .select('token,user_id')
      .in('user_id', recipientIds);
    if (deviceError) throw deviceError;

    const { data: notifications, error: notificationError } = await admin.from('notifications').insert(
      recipientIds.map((userId) => ({
        user_id: userId,
        kind: 'broadcast',
        title,
        body,
        link_url: linkUrl,
        is_read: false,
      })),
    ).select('id,user_id');
    if (notificationError) throw notificationError;

    if (!devices?.length) {
      return json({ inAppCreated: recipientIds.length, delivered: 0, failed: 0, warning: 'No registered mobile devices for these recipients. The announcement is available in the app.' });
    }

    const serviceAccountValue = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountValue) {
      return json({
        inAppCreated: recipientIds.length,
        delivered: 0,
        failed: devices.length,
        warning: 'Firebase push delivery is not configured',
      });
    }

    let serviceAccount: ServiceAccount;
    let accessToken: string;
    try {
      serviceAccount = JSON.parse(serviceAccountValue) as ServiceAccount;
      const jwt = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
      const credentials = await jwt.authorize();
      if (!credentials.access_token) throw new Error('Firebase authorization failed');
      accessToken = credentials.access_token;
    } catch {
      return json({ inAppCreated: recipientIds.length, delivered: 0, failed: devices.length, warning: 'The announcement was saved in the app, but Firebase authorization failed. Contact your workspace administrator.' });
    }

    const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
    const results = await Promise.all(
      devices.map(async ({ token, user_id }) => {
        try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { ...(linkUrl ? { link_url: linkUrl } : {}), notification_id: notifications?.find(item => item.user_id === user_id)?.id || '' },
              android: {
                priority: 'high',
                notification: { channel_id: 'getwebapp_alerts', sound: 'default' },
              },
            },
          }),
        });
        const result = response.ok ? null : await response.json().catch(() => null);
        const expired = result?.error?.details?.some((detail: { errorCode?: string }) => detail.errorCode === 'UNREGISTERED') === true;
        return { token, ok: response.ok, expired };
        } catch { return { token, ok: false, expired: false }; }
      }),
    );

    const staleTokens = results.filter((result) => result.expired).map((result) => result.token);
    if (staleTokens.length) {
      await admin.from('user_device_tokens').delete().in('token', staleTokens);
    }

    return json({
      inAppCreated: recipientIds.length,
      delivered: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      ...(results.some(result => !result.ok) ? { warning: 'Some devices could not receive a push. The announcement is still available in the app.' } : {}),
    });
  } catch (error) {
    console.error('send-push-notification failed', error instanceof Error ? error.name : 'Unknown error');
    return json({ error: 'The notification service could not complete this request. Please try again.' }, 500);
  }
});
