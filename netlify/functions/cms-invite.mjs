// Admin-only: create (or find) a client user, grant site access, and hand the
// generated password back to the admin to share. Optionally emails the client
// via Resend when RESEND_API_KEY is configured.
import { json, requireEnv, getUser, sbRest, SLUG_RE } from '../lib/cms.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const env = requireEnv();
    const user = await getUser(req);
    if (!user) return json({ error: 'unauthorized' }, 401);

    // only admins invite
    const prof = await sbRest(`profiles?user_id=eq.${user.id}&select=is_admin`);
    const rows = prof.ok ? await prof.json() : [];
    if (!rows[0] || !rows[0].is_admin) return json({ error: 'forbidden' }, 403);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const email = String(body.email || '').trim().toLowerCase();
    const site = String(body.site || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'bad email' }, 400);
    if (!SLUG_RE.test(site)) return json({ error: 'bad site' }, 400);

    const password = String(body.password || '') ||
      Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ'[b % 54]).join('');

    const adminHeaders = {
      apikey: env.SERVICE_KEY,
      Authorization: `Bearer ${env.SERVICE_KEY}`,
      'Content-Type': 'application/json'
    };

    // create the auth user (or find them if they already exist)
    let userId = null;
    let created = false;
    const createRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    if (createRes.ok) {
      userId = (await createRes.json()).id;
      created = true;
    } else {
      const list = await fetch(
        `${env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
        { headers: adminHeaders }
      );
      if (list.ok) {
        const data = await list.json();
        const found = (data.users || []).find((u) => u.email === email);
        if (found) userId = found.id;
      }
      if (!userId) {
        return json({ error: 'could not create or find user: ' + (await createRes.text()).slice(0, 200) }, 500);
      }
    }

    await sbRest('profiles', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, email })
    });
    await sbRest('site_members', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, site_slug: site })
    });

    // best-effort email; password is still returned to the admin either way
    let emailed = false;
    const RESEND = process.env.RESEND_API_KEY;
    if (RESEND && body.sendEmail && created) {
      const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.CMS_MAIL_FROM || 'Kerehama Labs <onboarding@resend.dev>',
          to: email,
          subject: 'Your website dashboard login',
          text: `Hi,\n\nYou can now manage your website yourself.\n\nDashboard: ${origin}/cms/\nEmail: ${email}\nPassword: ${password}\n\nPlease change your password after signing in (Settings tab).\n\nKerehama Andrews\nKerehama Labs`
        })
      });
      emailed = r.ok;
    }

    return json({ ok: true, created, userId, password: created ? password : null, emailed });
  } catch (e) {
    console.error('cms-invite', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
