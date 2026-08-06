// Admin overview: per-site health at a glance.
import { json, requireEnv, getUser, sbRest, ghCommits } from '../lib/cms.mjs';

async function countRows(table, filter) {
  const res = await sbRest(`${table}?select=id&${filter}`, {
    method: 'HEAD',
    headers: { Prefer: 'count=exact' }
  });
  if (!res.ok) return 0;
  const range = res.headers.get('content-range') || '';
  return parseInt(range.split('/')[1], 10) || 0;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    requireEnv();
    const user = await getUser(req);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const prof = await sbRest(`profiles?user_id=eq.${user.id}&select=is_admin`);
    const rows = prof.ok ? await prof.json() : [];
    if (!rows[0] || !rows[0].is_admin) return json({ error: 'forbidden' }, 403);

    const sitesRes = await sbRest('sites?select=slug,name&order=name');
    const sites = sitesRes.ok ? await sitesRes.json() : [];
    const draftsRes = await sbRest('drafts?select=site_slug,updated_at');
    const drafts = draftsRes.ok ? await draftsRes.json() : [];

    const day = new Date(Date.now() - 864e5).toISOString();
    const week = new Date(Date.now() - 7 * 864e5).toISOString();

    const out = [];
    for (const s of sites) {
      const [v24, v7d, openFb, commits] = await Promise.all([
        countRows('page_views', `site_slug=eq.${s.slug}&ts=gte.${day}`),
        countRows('page_views', `site_slug=eq.${s.slug}&ts=gte.${week}`),
        countRows('feedback', `site_slug=eq.${s.slug}&status=eq.open`),
        ghCommits(`sites/${s.slug}`, 1)
      ]);
      const draft = drafts.find((d) => d.site_slug === s.slug);
      out.push({
        slug: s.slug,
        name: s.name,
        lastPublish: commits[0] ? commits[0].date : null,
        lastMessage: commits[0] ? commits[0].message : null,
        views24h: v24,
        views7d: v7d,
        openFeedback: openFb,
        draftAt: draft ? draft.updated_at : null
      });
    }
    return json({ ok: true, sites: out });
  } catch (e) {
    console.error('cms-status', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
