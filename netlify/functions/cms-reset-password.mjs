// Admin-only: set a fresh random password on a client account and hand it
// back to the admin to share. Used from the Clients page.
import { json, requireEnv, getUser, sbRest, audit } from '../lib/cms.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const env = requireEnv();
    const user = await getUser(req);
    if (!user) return json({ error: 'unauthorized' }, 401);

    const prof = await sbRest(`profiles?user_id=eq.${user.id}&select=is_admin`);
    const rows = prof.ok ? await prof.json() : [];
    if (!rows[0] || !rows[0].is_admin) return json({ error: 'forbidden' }, 403);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const targetId = String(body.userId || '');
    if (!/^[0-9a-f-]{36}$/.test(targetId)) return json({ error: 'bad user id' }, 400);

    // never allow resetting another admin's password from the UI
    const target = await sbRest(`profiles?user_id=eq.${targetId}&select=is_admin,email`);
    const trows = target.ok ? await target.json() : [];
    if (!trows[0]) return json({ error: 'unknown user' }, 404);
    if (trows[0].is_admin) return json({ error: 'cannot reset an admin account here' }, 403);

    const password = Array.from(
      crypto.getRandomValues(new Uint8Array(9)),
      (b) => 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ'[b % 54]
    ).join('');

    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${targetId}`, {
      method: 'PUT',
      headers: {
        apikey: env.SERVICE_KEY,
        Authorization: `Bearer ${env.SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      console.error('password reset failed', res.status, await res.text());
      return json({ error: 'reset failed' }, 500);
    }
    audit(user.email, 'reset-password', null, trows[0].email);
    return json({ ok: true, password, email: trows[0].email || '' });
  } catch (e) {
    console.error('cms-reset-password', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
