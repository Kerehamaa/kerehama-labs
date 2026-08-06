// Publish a draft page. Clients NEVER supply raw HTML — all patching goes
// through the whitelist in lib/publish.mjs (text / image / link / SEO).
import { json, requireEnv, getUser, canManage, audit, SLUG_RE, PAGE_RE } from '../lib/cms.mjs';
import { publishPage } from '../lib/publish.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const env = requireEnv();
    if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN not configured' }, 500);

    const user = await getUser(req);
    if (!user) return json({ error: 'unauthorized' }, 401);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const site = String(body.site || '');
    if (!SLUG_RE.test(site)) return json({ error: 'bad site' }, 400);
    const page = String(body.page || 'index.html');
    if (!PAGE_RE.test(page) || page.includes('..')) return json({ error: 'bad page' }, 400);

    const access = await canManage(user.id, site);
    if (!access.ok) return json({ error: 'forbidden' }, 403);

    if (!body.patch || typeof body.patch !== 'object' || Array.isArray(body.patch)) {
      return json({ error: 'bad patch' }, 400);
    }

    const result = await publishPage(site, page, body.patch, user.email || user.id);
    audit(user.email, 'publish', site, `${page}: ${result.applied} change(s)`);
    return json({ ok: true, ...result });
  } catch (e) {
    if (e.message === 'nothing matched') return json({ error: e.message, skipped: e.skipped }, 400);
    if (e.message === 'page not found') return json({ error: e.message }, 404);
    console.error('cms-publish', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
