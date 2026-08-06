// Check external links for the SEO checkup (browsers can't — CORS).
// Member-auth; capped and parallel with short timeouts.
import { json, requireEnv, getUser, canManage, SLUG_RE } from '../lib/cms.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    requireEnv();
    const user = await getUser(req);
    if (!user) return json({ error: 'unauthorized' }, 401);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const site = String(body.site || '');
    if (!SLUG_RE.test(site)) return json({ error: 'bad site' }, 400);
    const access = await canManage(user.id, site);
    if (!access.ok) return json({ error: 'forbidden' }, 403);

    const urls = Array.isArray(body.urls) ? body.urls.slice(0, 20) : [];
    const results = await Promise.all(urls.map(async (u) => {
      if (typeof u !== 'string' || !/^https?:\/\/[^\s"'<>]{1,300}$/.test(u)) {
        return { url: String(u).slice(0, 100), ok: false, note: 'invalid' };
      }
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
        if (r.status === 405 || r.status === 501) {
          r = await fetch(u, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
        }
        clearTimeout(timer);
        return { url: u, ok: r.ok, status: r.status };
      } catch (e) {
        return { url: u, ok: false, note: 'unreachable' };
      }
    }));
    return json({ ok: true, results });
  } catch (e) {
    console.error('cms-linkcheck', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
