// Admin-only: return every file of a site (base64) so the dashboard can
// build a zip. Small static sites fit comfortably in the response limit.
import { json, requireEnv, getUser, sbRest, audit, SLUG_RE } from '../lib/cms.mjs';

const GITHUB_REPO = process.env.GITHUB_REPO || 'Kerehamaa/kerehama-labs';

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

    const headers = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kitset-cms'
    };
    const tree = await (await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/git/trees/main?recursive=1`,
      { headers }
    )).json();
    const files = (tree.tree || []).filter(
      (t) => t.type === 'blob' && t.path.startsWith(`sites/${site}/`)
    );
    if (!files.length) return json({ error: 'site not found' }, 404);

    const out = [];
    let total = 0;
    for (const f of files) {
      const blob = await (await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/git/blobs/${f.sha}`,
        { headers }
      )).json();
      total += (blob.content || '').length;
      if (total > 4.5 * 1024 * 1024) return json({ error: 'site too large to export in one go' }, 413);
      out.push({ path: f.path.slice(`sites/${site}/`.length), base64: (blob.content || '').replace(/\n/g, '') });
    }
    audit(user.email, 'export', site, `${out.length} files`);
    return json({ ok: true, files: out });
  } catch (e) {
    console.error('cms-export', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
