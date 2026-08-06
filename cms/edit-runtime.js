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
    '[data-cms]{outline:1px dashed rgba(107,79,160,.45);outline-offset:2px;cursor:text;transition:outline-color .15s;}' +
    '[data-cms]:hover{outline:2px solid #6B4FA0;}' +
    '[data-cms].cms-focus{outline:2px solid #0E7C74;background:rgba(14,124,116,.06);}' +
    '[data-cms-img]{cursor:pointer;}' +
    '.cms-img-hover{outline:3px solid #6B4FA0 !important;outline-offset:-3px;}' +
    'a[data-cms]:hover{cursor:text;}';
  document.head.appendChild(css);

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

    el.addEventListener('focus', function () { el.classList.add('cms-focus'); });
    el.addEventListener('blur', function () { el.classList.remove('cms-focus'); });

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
    el.addEventListener('mouseenter', function () { el.classList.add('cms-img-hover'); });
    el.addEventListener('mouseleave', function () { el.classList.remove('cms-img-hover'); });
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
