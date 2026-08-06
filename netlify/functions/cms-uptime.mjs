// Cron (every 5 min): ping every site; email the admin when one goes down
// and again when it recovers. Alerts repeat at most every 6 hours.
import { requireEnv, sbRest } from '../lib/cms.mjs';

async function alertAdmins(subject, text) {
  const RESEND = process.env.RESEND_API_KEY;
  if (!RESEND) return;
  const admins = await (await sbRest('profiles?is_admin=eq.true&select=email')).json();
  for (const a of admins) {
    if (!a.email) continue;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.CMS_MAIL_FROM || 'Kitset <onboarding@resend.dev>',
        to: a.email, subject, text
      })
    });
  }
}

export default async () => {
  try {
    requireEnv();
    const base = process.env.URL || 'https://labs.kerehama.nz';
    const sites = await (await sbRest('sites?select=slug,name')).json();
    const states = await (await sbRest('uptime_state?select=site_slug,down_since,last_alert')).json();
    const now = new Date().toISOString();

    for (const s of sites) {
      let up = false;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(`${base}/sites/${s.slug}/`, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(timer);
        up = r.ok;
      } catch (e) { up = false; }

      const state = states.find((x) => x.site_slug === s.slug);
      if (!up) {
        const alertDue = !state || !state.last_alert ||
          Date.now() - new Date(state.last_alert).getTime() > 6 * 3600e3;
        await sbRest(`uptime_state`, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            site_slug: s.slug,
            down_since: (state && state.down_since) || now,
            last_alert: alertDue ? now : (state && state.last_alert)
          })
        });
        if (alertDue) {
          await alertAdmins(
            `DOWN: ${s.name}`,
            `${s.name} (${base}/sites/${s.slug}/) is not responding as of ${now}.\n\nChecked every 5 minutes; you'll get another alert if it's still down in 6 hours, and a note when it recovers.`
          );
        }
      } else if (state && state.down_since) {
        await sbRest(`uptime_state?site_slug=eq.${s.slug}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ down_since: null, last_alert: null })
        });
        await alertAdmins(`RECOVERED: ${s.name}`, `${s.name} is responding again as of ${now}.`);
      }
    }
    return new Response('ok');
  } catch (e) {
    console.error('cms-uptime', e);
    return new Response('error', { status: 500 });
  }
};

export const config = { schedule: '*/5 * * * *' };
