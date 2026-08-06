// Version history for a site. Without `restore`: lists recent publishes.
// With `restore: <sha>`: puts every HTML page of the site back to how it was
// at that commit (assets are additive and left alone).
import {
  json, requireEnv, getUser, canManage,
  ghCommits, ghListPages, ghGetFile, ghGetFileAt, ghPutFile, SLUG_RE
} from '../lib/cms.mjs';

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

    if (!body.restore) {
      const commits = await ghCommits(`sites/${site}`, 15);
      return json({ ok: true, versions: commits });
    }

    const sha = String(body.restore);
    if (!/^[0-9a-f]{7,40}$/.test(sha)) return json({ error: 'bad version' }, 400);

    const pages = await ghListPages(site);
    let restored = 0;
    for (const page of pages) {
      const path = `sites/${site}/${page}`;
      const old = await ghGetFileAt(path, sha);
      if (old == null) continue; // page didn't exist back then; leave it
      const current = await ghGetFile(path);
      if (current && current.content === old) continue; // already identical
      await ghPutFile(
        path,
        old,
        `cms: restore ${site}/${page} to ${sha.slice(0, 7)} by ${user.email || user.id}`,
        current ? current.sha : undefined
      );
      restored++;
    }
    return json({ ok: true, restored });
  } catch (e) {
    console.error('cms-history', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
