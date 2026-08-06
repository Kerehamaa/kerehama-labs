// Kerehama Labs CMS edit runtime. Injected into a managed site ONLY when it is
// iframed by /cms/editor.html with ?cms-edit=1. Makes [data-cms] text regions and
// [data-cms-img] images editable in place and reports changes to the editor via
// postMessage (same origin). It never talks to the network itself.
(function () {
  'use strict';
  if (window.parent === window) return;
  var ORIGIN = location.origin;

  var css = document.createElement('style');
  css.textContent =
    '[data-cms]{outline:1.5px dashed rgba(91,77,190,.4);outline-offset:3px;cursor:text;transition:outline-color .15s,background .15s;border-radius:2px;}' +
    '[data-cms]:hover{outline:2px solid #5b4dbe;background:rgba(91,77,190,.05);}' +
    '[data-cms].cms-focus{outline:2px solid #0e8a7d;background:rgba(14,138,125,.06);}' +
    '[data-cms-img]{cursor:pointer;}' +
    '.cms-img-hover{outline:3px solid #5b4dbe !important;outline-offset:-3px;filter:brightness(.92);}' +
    'a[data-cms]:hover{cursor:text;}' +
    '#cms-hoverlabel{position:fixed;z-index:2147483647;background:#191c26;color:#fff;' +
    'font:600 12px/1 Inter,system-ui,sans-serif;padding:6px 11px;border-radius:999px;' +
    'pointer-events:none;opacity:0;transition:opacity .12s;box-shadow:0 4px 14px rgba(0,0,0,.25);white-space:nowrap;}';
  document.head.appendChild(css);

  var label = document.createElement('div');
  label.id = 'cms-hoverlabel';
  document.body.appendChild(label);
  function showLabel(el, text) {
    var r = el.getBoundingClientRect();
    label.textContent = text;
    label.style.left = Math.max(8, Math.min(window.innerWidth - 120, r.left)) + 'px';
    label.style.top = Math.max(8, r.top - 30) + 'px';
    label.style.opacity = '1';
  }
  function hideLabel() { label.style.opacity = '0'; }

  function send(msg) { window.parent.postMessage(msg, ORIGIN); }

  // ---- text regions ----------------------------------------------------
  // Serialize keeping only <br>; everything else becomes escaped text. The
  // publish function sanitizes again server-side — this is just for fidelity.
  function serialize(el) {
    var out = '';
    el.childNodes.forEach(function walk(node) {
      if (node.nodeType === 3) out += node.textContent;
      else if (node.nodeType === 1) {
        if (node.tagName === 'BR') out += '\n';
        else node.childNodes.forEach(walk);
      }
    });
    return out;
  }

  // Regions whose markup matters (nested styled spans, e.g. the hero heading)
  // are edited as plain text only if actually changed; we keep their original
  // HTML so an untouched region never loses its styling.
  var textEls = Array.prototype.slice.call(document.querySelectorAll('[data-cms]'));
  textEls.forEach(function (el) {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    var original = serialize(el);

    el.addEventListener('focus', function () { el.classList.add('cms-focus'); hideLabel(); });
    el.addEventListener('blur', function () { el.classList.remove('cms-focus'); });
    el.addEventListener('mouseenter', function () {
      if (document.activeElement !== el) showLabel(el, 'Edit text');
    });
    el.addEventListener('mouseleave', hideLabel);

    // keep paste plain
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
    // Enter inserts a line break, never a new <div>
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
    });
    el.addEventListener('input', function () {
      var value = serialize(el);
      // mirror to every element sharing this key (e.g. repeated CTA buttons)
      var key = el.getAttribute('data-cms');
      textEls.forEach(function (other) {
        if (other !== el && other.getAttribute('data-cms') === key) {
          other.textContent = value;
          other.innerHTML = other.innerHTML.replace(/\n/g, '<br>');
        }
      });
      send({ type: 'cms-patch', key: key, kind: 'text', value: value, dirty: value !== original });
    });
  });

  // block link navigation while editing
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (a) e.preventDefault();
  }, true);

  // ---- images ----------------------------------------------------------
  var imgEls = Array.prototype.slice.call(document.querySelectorAll('[data-cms-img]'));
  imgEls.forEach(function (el) {
    el.addEventListener('mouseenter', function () { el.classList.add('cms-img-hover'); showLabel(el, 'Change photo'); });
    el.addEventListener('mouseleave', function () { el.classList.remove('cms-img-hover'); hideLabel(); });
    el.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      send({ type: 'cms-pick-image', key: el.getAttribute('data-cms-img'), current: el.getAttribute('src') || '' });
    }, true);
  });

  function setImage(key, src) {
    imgEls.forEach(function (el) {
      if (el.getAttribute('data-cms-img') === key) el.setAttribute('src', src);
    });
  }

  // ---- messages from the editor ---------------------------------------
  window.addEventListener('message', function (e) {
    if (e.origin !== ORIGIN || !e.data || !e.data.type) return;
    if (e.data.type === 'cms-apply') {
      // apply a saved draft { key: {kind, value} }
      var patch = e.data.patch || {};
      Object.keys(patch).forEach(function (key) {
        var p = patch[key];
        if (p.kind === 'img') { setImage(key, p.value); return; }
        if (p.kind !== 'text') return;
        textEls.forEach(function (el) {
          if (el.getAttribute('data-cms') === key) {
            el.textContent = p.value;
            el.innerHTML = el.innerHTML.replace(/\n/g, '<br>');
          }
        });
      });
    } else if (e.data.type === 'cms-set-image') {
      setImage(e.data.key, e.data.src);
    }
  });

  send({ type: 'cms-ready', site: document.currentScript ? document.currentScript.dataset.site : '' });
})();
