// List a site's pages (*.html) for the editor/SEO page switchers.
import { json, requireEnv, getUser, canManage, ghListPages, SLUG_RE } from '../lib/cms.mjs';

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

    return json({ ok: true, pages: await ghListPages(site) });
  } catch (e) {
    console.error('cms-pages', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
