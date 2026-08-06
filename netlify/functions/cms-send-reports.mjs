// Admin-only manual trigger for the weekly report (testing / off-schedule send).
import { json, requireEnv, getUser, sbRest } from '../lib/cms.mjs';
import { sendWeeklyReports } from '../lib/report.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    requireEnv();
    const user = await getUser(req);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const prof = await sbRest(`profiles?user_id=eq.${user.id}&select=is_admin`);
    const rows = prof.ok ? await prof.json() : [];
    if (!rows[0] || !rows[0].is_admin) return json({ error: 'forbidden' }, 403);

    const origin = req.headers.get('origin') || process.env.URL || 'https://labs.kerehama.nz';
    const result = await sendWeeklyReports(origin);
    return json(result, result.ok ? 200 : 500);
  } catch (e) {
    console.error('cms-send-reports', e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
};
