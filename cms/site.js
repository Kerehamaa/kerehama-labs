// Kerehama Labs CMS loader. Every managed site includes this once:
//   <script defer src="/cms/site.js" data-site="<slug>"></script>
// Normal visits: sends one anonymous pageview beacon.
// Edit mode (?cms-edit=1 inside the CMS editor iframe): loads the edit runtime instead.
(function () {
  var script = document.currentScript;
  var site = (script && script.dataset.site) || (location.pathname.split('/')[2] || '');
  if (!site) return;

  var editing = new URLSearchParams(location.search).get('cms-edit') === '1';

  if (editing && window.parent !== window) {
    var rt = document.createElement('script');
    rt.src = '/cms/edit-runtime.js';
    rt.dataset.site = site;
    document.head.appendChild(rt);
    return;
  }

  if (window.__cmsPreview) return;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  try {
    var payload = JSON.stringify({
      site: site,
      path: location.pathname,
      ref: document.referrer || ''
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/cms-track', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/cms-track', { method: 'POST', body: payload, keepalive: true });
    }
  } catch (e) { /* analytics must never break the site */ }
})();
