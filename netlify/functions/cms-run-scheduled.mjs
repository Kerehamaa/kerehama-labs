// Cron (every 15 min): publish any page whose scheduled time has arrived,
// using the draft saved for it. Marks the job done/failed and clears the
// published part of the draft.
import { requireEnv, sbRest, audit } from '../lib/cms.mjs';
import { publishPage } from '../lib/publish.mjs';

export default async () => {
  try {
    const env = requireEnv();
    if (!env.GITHUB_TOKEN) { console.error('no GITHUB_TOKEN'); return new Response('skip'); }

    const due = await sbRest(
      `scheduled_publishes?status=eq.open&run_at=lte.${new Date().toISOString()}&select=id,site_slug,page&limit=20`
    );
    const jobs = due.ok ? await due.json() : [];
    for (const job of jobs) {
      let status = 'done';
      try {
        const dr = await sbRest(`drafts?site_slug=eq.${job.site_slug}&select=content`);
        const rows = dr.ok ? await dr.json() : [];
        const content = (rows[0] && rows[0].content) || {};
        const patch = (content.pages && content.pages[job.page]) || {};
        if (!Object.keys(patch).length) throw new Error('no draft to publish');
        await publishPage(job.site_slug, job.page, patch, 'scheduled publish');
        delete content.pages[job.page];
        await sbRest(`drafts?site_slug=eq.${job.site_slug}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ content, updated_at: new Date().toISOString() })
        });
        audit(null, 'scheduled-publish', job.site_slug, job.page);
      } catch (e) {
        console.error('scheduled publish failed', job, e.message);
        status = 'failed';
      }
      await sbRest(`scheduled_publishes?id=eq.${job.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status })
      });
    }
    return new Response('ok');
  } catch (e) {
    console.error('cms-run-scheduled', e);
    return new Response('error', { status: 500 });
  }
};

export const config = { schedule: '*/15 * * * *' };
