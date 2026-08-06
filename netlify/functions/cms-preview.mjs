// Shareable preview: renders a page with its unpublished draft applied.
// Access is via a random token stored in the draft (content._preview.token),
// so the link works without a login but can't be guessed.
import { requireEnv, sbRest, ghGetFile, SLUG_RE, PAGE_RE } from '../lib/cms.mjs';
import { applyPatch } from '../lib/publish.mjs';

const BANNER = `<div style="position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#14315c;color:#fff;font:600 13px/1.4 'Space Grotesk',system-ui,sans-serif;text-align:center;padding:10px 16px;box-shadow:0 -2px 12px rgba(0,0,0,.2)">Preview — these changes are not live yet</div>`;

export default async (req) => {
  try {
    requireEnv();
    const url = new URL(req.url);
    const site = url.searchParams.get('site') || '';
    const page = url.searchParams.get('page') || 'index.html';
    const token = url.searchParams.get('t') || '';
    if (!SLUG_RE.test(site) || !PAGE_RE.test(page) || page.includes('..') || !/^[A-Za-z0-9_-]{10,80}$/.test(token)) {
      return new Response('Not found', { status: 404 });
    }

    const dr = await sbRest(`drafts?site_slug=eq.${site}&select=content`);
    const rows = dr.ok ? await dr.json() : [];
    const content = rows[0] && rows[0].content;
    const stored = content && content._preview && content._preview.token;
    if (!stored || stored !== token) return new Response('Preview link is no longer valid.', { status: 404 });

    const file = await ghGetFile(`sites/${site}/${page}`);
    if (!file) return new Response('Not found', { status: 404 });

    let html = file.content;
    const patch = (content.pages && content.pages[page]) || {};
    if (Object.keys(patch).length) {
      try { html = applyPatch(html, patch).html; } catch (e) { /* show base page */ }
    }
    html = html
      .replace('</head>', '<meta name="robots" content="noindex"><script>window.__cmsPreview=1</script>\n</head>')
      .replace('</body>', BANNER + '</body>');
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  } catch (e) {
    console.error('cms-preview', e);
    return new Response('Error', { status: 500 });
  }
};
