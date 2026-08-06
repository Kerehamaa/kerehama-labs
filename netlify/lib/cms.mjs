// Shared helpers for the CMS functions. Not a function endpoint itself.

// CMS-specific vars so the old chat app's Supabase project is untouched.
const SUPABASE_URL = process.env.CMS_SUPABASE_URL;
const SERVICE_KEY = process.env.CMS_SUPABASE_SERVICE_KEY;
const GITHUB_REPO = process.env.GITHUB_REPO || 'Kerehamaa/kerehama-labs';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export const SLUG_RE = /^[a-z0-9-]{1,60}$/;

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function requireEnv() {
  if (!SUPABASE_URL) throw new Error('CMS_SUPABASE_URL missing');
  if (!SERVICE_KEY) throw new Error('CMS_SUPABASE_SERVICE_KEY missing');
  return { SUPABASE_URL, SERVICE_KEY, GITHUB_REPO, GITHUB_TOKEN };
}

// Supabase REST call with the service role (bypasses RLS — server side only).
export async function sbRest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  return res;
}

// Resolve the user behind a client-supplied access token. Returns null if invalid.
export async function getUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? user : null;
}

// May this user manage this site? Admins manage everything.
export async function canManage(userId, siteSlug) {
  const prof = await sbRest(`profiles?user_id=eq.${userId}&select=is_admin`);
  if (prof.ok) {
    const rows = await prof.json();
    if (rows[0] && rows[0].is_admin) return { ok: true, admin: true };
  }
  const mem = await sbRest(
    `site_members?user_id=eq.${userId}&site_slug=eq.${encodeURIComponent(siteSlug)}&select=site_slug`
  );
  if (mem.ok) {
    const rows = await mem.json();
    if (rows.length > 0) return { ok: true, admin: false };
  }
  return { ok: false, admin: false };
}

// ---- GitHub contents API -------------------------------------------------
function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'kerehama-labs-cms',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

export async function ghGetFile(path) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=main`,
    { headers: ghHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { sha: data.sha, content };
}

export async function ghPutFile(path, contentUtf8OrBuffer, message, sha) {
  const body = {
    message,
    branch: 'main',
    content: Buffer.isBuffer(contentUtf8OrBuffer)
      ? contentUtf8OrBuffer.toString('base64')
      : Buffer.from(contentUtf8OrBuffer, 'utf-8').toString('base64')
  };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
    { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub commit failed (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.commit && data.commit.sha;
}

// ---- HTML patching -------------------------------------------------------
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Replace the inner content of every element carrying data-cms="key".
// Elements never nest another element of their own tag name, so a lazy match
// to the first matching close tag is correct here.
export function patchText(html, key, value) {
  const safe = escapeHtml(value).replace(/\r?\n/g, '<br>');
  const re = new RegExp(
    '(<([a-zA-Z0-9-]+)([^>]*?)\\sdata-cms="' + escRe(key) + '"([^>]*)>)[\\s\\S]*?(</\\2>)',
    'g'
  );
  let count = 0;
  const out = html.replace(re, (_, open, _tag, _pre, _post, close) => {
    count++;
    return open + safe + close;
  });
  return { html: out, count };
}

// Swap the src attribute inside every tag carrying data-cms-img="key".
// Only repo-relative asset paths are accepted — never raw URLs from clients.
export function patchImage(html, key, value) {
  if (!/^assets\/[A-Za-z0-9._-]{1,100}$/.test(value)) {
    throw new Error(`invalid image path for ${key}`);
  }
  const re = new RegExp(
    '(<[a-zA-Z0-9-]+[^>]*?\\sdata-cms-img="' + escRe(key) + '"[^>]*?\\ssrc=")[^"]*(")',
    'g'
  );
  let count = 0;
  const out = html.replace(re, (_, pre, post) => {
    count++;
    return pre + value + post;
  });
  return { html: out, count };
}

// SEO fields land in specific head tags; created if missing.
export function patchSeo(html, key, value) {
  const safeAttr = escapeHtml(value).replace(/\r?\n/g, ' ');
  const ensure = (tagHtml) => html.replace(/<\/head>/i, tagHtml + '\n</head>');

  if (key === 'seo.title') {
    if (/<title>[\s\S]*?<\/title>/i.test(html)) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeAttr}</title>`);
    } else {
      html = ensure(`<title>${safeAttr}</title>`);
    }
    return { html, count: 1 };
  }
  const metas = {
    'seo.description': ['name', 'description'],
    'seo.og_title': ['property', 'og:title'],
    'seo.og_description': ['property', 'og:description'],
    'seo.og_image': ['property', 'og:image']
  };
  const m = metas[key];
  if (!m) return { html, count: 0 };
  if (key === 'seo.og_image' && value && !/^assets\/[A-Za-z0-9._-]{1,100}$/.test(value)) {
    throw new Error('og_image must be an assets/ path');
  }
  const re = new RegExp('<meta\\s+' + m[0] + '="' + escRe(m[1]) + '"\\s+content="[^"]*"\\s*/?>', 'i');
  const tag = `<meta ${m[0]}="${m[1]}" content="${safeAttr}">`;
  if (re.test(html)) html = html.replace(re, tag);
  else html = ensure(tag);
  return { html, count: 1 };
}
