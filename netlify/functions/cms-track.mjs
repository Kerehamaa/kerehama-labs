// Anonymous pageview beacon. No cookies; visitors are counted by a daily
// rotating hash of ip+ua, so nothing personally identifiable is stored.
import { createHash } from 'node:crypto';
import { json, sbRest, requireEnv, SLUG_RE } from '../lib/cms.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    requireEnv();
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const site = String(body.site || '');
    if (!SLUG_RE.test(site)) return json({ error: 'bad site' }, 400);

    const path = String(body.path || '/').slice(0, 200);
    const referrer = String(body.ref || '').slice(0, 300);
    const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || '';
    const ua = (req.headers.get('user-agent') || '').slice(0, 200);
    const day = new Date().toISOString().slice(0, 10);
    const visitor_hash = createHash('sha256').update(`${ip}|${ua}|${site}|${day}`).digest('hex').slice(0, 24);
    const country = (context && context.geo && context.geo.country && context.geo.country.code) || null;
    const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';

    const res = await sbRest('page_views', {
      method: 'POST',
      body: JSON.stringify({ site_slug: site, path, referrer, visitor_hash, country, device }),
      headers: { Prefer: 'return=minimal' }
    });
    if (!res.ok) {
      console.error('page_views insert failed', res.status, await res.text());
      return json({ error: 'store' }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    console.error('cms-track', e);
    return json({ error: 'server' }, 500);
  }
};
