// Shared publish core: apply a whitelist patch to a page and commit it.
// Used by cms-publish (interactive), cms-run-scheduled (cron) and cms-preview
// (apply without committing).
import { ghGetFile, ghPutFile, patchText, patchImage, patchSeo, patchLink } from './cms.mjs';

const MAX_KEYS = 200;
const MAX_TEXT = 4000;

export function applyPatch(html, patch) {
  const keys = Object.keys(patch || {});
  if (!keys.length) throw new Error('empty patch');
  if (keys.length > MAX_KEYS) throw new Error('too many keys');
  let applied = 0;
  const skipped = [];
  for (const key of keys) {
    if (key.startsWith('_')) continue; // internal bookkeeping (preview token etc.)
    const p = patch[key] || {};
    const value = String(p.value == null ? '' : p.value);
    if (!/^[A-Za-z0-9_.-]{1,60}$/.test(key)) { skipped.push(key); continue; }

    let result;
    if (key.startsWith('seo.')) {
      result = patchSeo(html, key, value.slice(0, 500));
    } else if (p.kind === 'img') {
      result = patchImage(html, key, value);
    } else if (p.kind === 'link') {
      result = patchLink(html, key.replace(/\.href$/, ''), value);
    } else if (p.kind === 'text') {
      result = patchText(html, key, value.slice(0, MAX_TEXT));
    } else {
      skipped.push(key); continue;
    }
    if (result.count > 0) { html = result.html; applied++; }
    else skipped.push(key);
  }
  return { html, applied, skipped };
}

export async function publishPage(site, page, patch, byLabel) {
  const path = `sites/${site}/${page}`;
  const file = await ghGetFile(path);
  if (!file) throw new Error('page not found');
  const { html, applied, skipped } = applyPatch(file.content, patch);
  if (applied === 0) {
    const err = new Error('nothing matched');
    err.skipped = skipped;
    throw err;
  }
  const commit = await ghPutFile(
    path,
    html,
    `cms: publish ${site}/${page} (${applied} change${applied === 1 ? '' : 's'}) by ${byLabel}`,
    file.sha
  );
  return { commit, applied, skipped };
}
