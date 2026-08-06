// Publish a draft: applies whitelisted patches (text / image src / SEO head
// tags) to the canonical site HTML from GitHub and commits the result.
// Clients NEVER supply raw HTML — all sites share one origin, so publishing
// arbitrary markup from one client would endanger every other client.
import {
  json, requireEnv, getUser, canManage, ghGetFile, ghPutFile,
  patchText, patchImage, patchSeo, SLUG_RE
} from '../lib/cms.mjs';

const MAX_KEYS = 200;
const MAX_TEXT = 4000;

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

    const access = await canManage(user.id, site);
    if (!access.ok) return json({ error: 'forbidden' }, 403);

    const patch = body.patch;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return json({ error: 'bad patch' }, 400);
    }
    const keys = Object.keys(patch);
    if (keys.length === 0) return json({ error: 'empty patch' }, 400);
    if (keys.length > MAX_KEYS) return json({ error: 'too many keys' }, 400);

    const file = await ghGetFile(`sites/${site}/index.html`);
    if (!file) return json({ error: 'site file not found' }, 404);

    let html = file.content;
    let applied = 0;
    const skipped = [];
    for (const key of keys) {
      const p = patch[key] || {};
      const value = String(p.value == null ? '' : p.value);
      if (!/^[A-Za-z0-9_.-]{1,60}$/.test(key)) { skipped.push(key); continue; }

      let result;
      if (key.startsWith('seo.')) {
        result = patchSeo(html, key, value.slice(0, 500));
      } else if (p.kind === 'img') {
        result = patchImage(html, key, value);
      } else if (p.kind === 'text') {
        result = patchText(html, key, value.slice(0, MAX_TEXT));
      } else {
        skipped.push(key); continue;
      }
      if (result.count > 0) { html = result.html; applied++; }
      else skipped.push(key);
    }

    if (applied === 0) return json({ error: 'nothing matched', skipped }, 400);

    const commit = await ghPutFile(
      `sites/${site}/index.html`,
      html,
      `cms: publish ${site} (${applied} change${applied === 1 ? '' : 's'}) by ${user.email || user.id}`,
      file.sha
    );
    return json({ ok: true, commit, applied, skipped });
  } catch (e) {
    console.error('cms-publish', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
