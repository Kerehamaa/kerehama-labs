// Image upload: commits a client image into their site's assets/ folder.
// The editor downscales images client-side before sending (base64 JSON).
import { json, requireEnv, getUser, canManage, ghPutFile, SLUG_RE, audit } from '../lib/cms.mjs';

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = {
  jpg: [0xff, 0xd8, 0xff], jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46],
  gif: [0x47, 0x49, 0x46]
};

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

    const ext = String(body.ext || '').toLowerCase();
    const magic = TYPES[ext];
    if (!magic) return json({ error: 'type not allowed (jpg, png, webp, gif)' }, 400);

    let buf;
    try { buf = Buffer.from(String(body.data || ''), 'base64'); } catch { return json({ error: 'bad data' }, 400); }
    if (buf.length === 0 || buf.length > MAX_BYTES) return json({ error: 'file too large (max 4MB)' }, 400);
    if (!magic.every((b, i) => buf[i] === b)) return json({ error: 'file content does not match type' }, 400);

    const name = `img-${Date.now().toString(36)}.${ext === 'jpeg' ? 'jpg' : ext}`;
    await ghPutFile(
      `sites/${site}/assets/${name}`,
      buf,
      `cms: upload image for ${site} by ${user.email || user.id}`
    );
    audit(user.email, 'upload-image', site, name);
    return json({ ok: true, path: `assets/${name}` });
  } catch (e) {
    console.error('cms-upload', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
