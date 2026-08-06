// Admin-only: upload/replace a whole site's index.html from the dashboard.
// Clients never get this — raw HTML is admin-trusted content only.
import { json, requireEnv, getUser, sbRest, ghGetFile, ghPutFile, SLUG_RE } from '../lib/cms.mjs';

const MAX_BYTES = 2 * 1024 * 1024;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const env = requireEnv();
    if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN not configured' }, 500);

    const user = await getUser(req);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const prof = await sbRest(`profiles?user_id=eq.${user.id}&select=is_admin`);
    const rows = prof.ok ? await prof.json() : [];
    if (!rows[0] || !rows[0].is_admin) return json({ error: 'forbidden' }, 403);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const site = String(body.site || '');
    if (!SLUG_RE.test(site)) return json({ error: 'bad site' }, 400);
    const html = String(body.html || '');
    if (!html.trim()) return json({ error: 'empty html' }, 400);
    if (html.length > MAX_BYTES) return json({ error: 'file too large (max 2MB — put images in assets/ instead)' }, 400);

    const path = `sites/${site}/index.html`;
    const existing = await ghGetFile(path);
    const commit = await ghPutFile(
      path,
      html,
      `cms: ${existing ? 'replace' : 'create'} ${site} site HTML by ${user.email || user.id}`,
      existing ? existing.sha : undefined
    );
    return json({ ok: true, commit, replaced: !!existing });
  } catch (e) {
    console.error('cms-site-html', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
