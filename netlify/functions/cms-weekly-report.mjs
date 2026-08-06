// Scheduled: Monday 8am NZ (Sunday 20:00 UTC). Emails each client their
// site's week in numbers.
import { requireEnv } from '../lib/cms.mjs';
import { sendWeeklyReports } from '../lib/report.mjs';

export default async () => {
  try {
    requireEnv();
    const origin = process.env.URL || 'https://labs.kerehama.nz';
    const result = await sendWeeklyReports(origin);
    console.log('weekly report', JSON.stringify(result));
    return new Response('ok');
  } catch (e) {
    console.error('cms-weekly-report', e);
    return new Response('error', { status: 500 });
  }
};

export const config = { schedule: '0 20 * * 0' };
