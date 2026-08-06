// Weekly client report: gathers each site's numbers and emails every member.
// Plain-text email per SYSTEM rules. Used by the scheduled function and the
// admin "send now" endpoint.
import { sbRest } from './cms.mjs';

export async function sendWeeklyReports(origin) {
  const RESEND = process.env.RESEND_API_KEY;
  if (!RESEND) return { ok: false, error: 'RESEND_API_KEY not configured' };
  const FROM = process.env.CMS_MAIL_FROM || 'Kitset <onboarding@resend.dev>';

  const sites = await (await sbRest('sites?select=slug,name')).json();
  const members = await (await sbRest('site_members?select=user_id,site_slug')).json();
  const profiles = await (await sbRest('profiles?select=user_id,email,is_admin')).json();
  const emailOf = {};
  profiles.forEach((p) => { emailOf[p.user_id] = p.email; });

  const now = Date.now();
  const week = new Date(now - 7 * 864e5).toISOString();
  const prevWeek = new Date(now - 14 * 864e5).toISOString();

  let sent = 0;
  const errors = [];
  for (const site of sites) {
    const recipients = members
      .filter((m) => m.site_slug === site.slug)
      .map((m) => emailOf[m.user_id])
      .filter(Boolean);
    if (!recipients.length) continue;

    const rowsRes = await sbRest(
      `page_views?site_slug=eq.${site.slug}&ts=gte.${prevWeek}&select=path,visitor_hash,ts&limit=10000`
    );
    const rows = rowsRes.ok ? await rowsRes.json() : [];
    const thisWeek = rows.filter((r) => r.ts >= week);
    const lastWeek = rows.filter((r) => r.ts < week);
    const uniques = new Set(thisWeek.map((r) => r.visitor_hash)).size;

    const byPath = {};
    thisWeek.forEach((r) => { byPath[r.path] = (byPath[r.path] || 0) + 1; });
    const top = Object.keys(byPath).sort((a, b) => byPath[b] - byPath[a])[0];

    const fbRes = await sbRest(`feedback?site_slug=eq.${site.slug}&status=eq.open&select=id`);
    const openFb = fbRes.ok ? (await fbRes.json()).length : 0;

    const diff = thisWeek.length - lastWeek.length;
    const trend = lastWeek.length === 0
      ? ''
      : diff > 0 ? ` (up ${diff} on the week before)`
      : diff < 0 ? ` (down ${-diff} on the week before)`
      : ' (same as the week before)';

    const text =
`Hi,

Here's how ${site.name} did this week.

Visits: ${thisWeek.length}${trend}
Different visitors: ${uniques}
${top ? `Most viewed page: ${top} (${byPath[top]} views)\n` : ''}${openFb ? `Open change requests: ${openFb} — we're on it.\n` : ''}
See more, or edit your site: ${origin}/cms/

Kitset`;

    for (const to of recipients) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to,
          subject: `${site.name} — your week in numbers`,
          text
        })
      });
      if (r.ok) sent++;
      else errors.push(`${site.slug} -> ${to}: ${r.status}`);
    }
  }
  return { ok: true, sent, errors };
}
