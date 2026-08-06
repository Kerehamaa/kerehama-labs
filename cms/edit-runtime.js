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
    '[data-cms]{outline:1.5px dashed rgba(20,49,92,.4);outline-offset:3px;cursor:text;transition:outline-color .15s,background .15s;border-radius:2px;}' +
    '[data-cms]:hover{outline:2px solid #14315c;background:rgba(20,49,92,.05);}' +
    '[data-cms].cms-focus{outline:2px solid #1f7a55;background:rgba(31,122,85,.06);}' +
    '[data-cms-img]{cursor:pointer;}' +
    '.cms-img-hover{outline:3px solid #14315c !important;outline-offset:-3px;filter:brightness(.92);}' +
    'a[data-cms]:hover{cursor:text;}' +
    '#cms-hoverlabel{position:fixed;z-index:2147483647;background:#1c1c1a;color:#fff;' +
    'font:600 12px/1 "Space Grotesk",system-ui,sans-serif;padding:6px 11px;border-radius:999px;' +
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

  // ---- rich text sanitizer --------------------------------------------
  // Mirrors the server whitelist: <br>, <b>/<i>/<strong>/<em>, and
  // <span style="color:…">. Everything else is unwrapped to its text.
  // excludeTag stops same-tag nesting (span-in-span breaks publishing).
  var ALLOWED = { BR: 1, SPAN: 1, B: 1, I: 1, STRONG: 1, EM: 1 };
  function sanitizeInto(srcNode, out, excludeTag) {
    Array.prototype.slice.call(srcNode.childNodes).forEach(function (child) {
      if (child.nodeType === 3) { out.appendChild(document.createTextNode(child.textContent)); return; }
      if (child.nodeType !== 1) return;
      var tag = child.tagName;
      if (tag === 'BR') { out.appendChild(document.createElement('br')); return; }
      var keep = ALLOWED[tag] && tag !== excludeTag;
      var color = '';
      if (tag === 'SPAN') {
        color = child.style ? child.style.color : '';
        keep = keep && !!color;
      }
      if (keep) {
        var el = document.createElement(tag);
        if (tag === 'SPAN') el.style.color = color;
        out.appendChild(el);
        sanitizeInto(child, el, excludeTag);
      } else {
        sanitizeInto(child, out, excludeTag);
      }
    });
  }
  function serialize(el) {
    var tmp = document.createElement('div');
    sanitizeInto(el, tmp, el.tagName);
    return tmp.innerHTML;
  }
  function setRich(el, value) {
    var parsed = document.createElement('div');
    parsed.innerHTML = String(value).replace(/\n/g, '<br>');
    var clean = document.createElement('div');
    sanitizeInto(parsed, clean, el.tagName);
    el.innerHTML = clean.innerHTML;
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
        if (other !== el && other.getAttribute('data-cms') === key) setRich(other, value);
      });
      send({ type: 'cms-patch', key: key, kind: 'text', value: value, dirty: value !== original });
    });
  });

  // ---- formatting toolbar (bold / italic / text color) -----------------
  try { document.execCommand('styleWithCSS', false, true); } catch (err) {}
  var SWATCHES = ['#1c1c1a', '#ffffff', '#14315c', '#0e7c74', '#8b6fc0', '#2e7fa3', '#c4557e', '#d99a2b'];
  var bar = document.createElement('div');
  bar.id = 'cms-toolbar';
  bar.innerHTML =
    '<button type="button" data-cmd="bold" title="Bold"><b>B</b></button>' +
    '<button type="button" data-cmd="italic" title="Italic"><i>I</i></button>' +
    '<button type="button" data-act="link" id="cms-linkbtn" title="Change where this link goes" style="width:auto;padding:0 9px;font-size:10.5px;letter-spacing:.05em" hidden>LINK</button>' +
    '<span class="cms-sep"></span>' +
    SWATCHES.map(function (c) {
      return '<button type="button" class="cms-swatch" data-color="' + c + '" title="' + c + '" style="background:' + c + '"></button>';
    }).join('') +
    '<label class="cms-custom" title="Custom colour">+<input type="color"></label>';
  var barCss = document.createElement('style');
  barCss.textContent =
    '#cms-toolbar{position:fixed;z-index:2147483646;display:none;align-items:center;gap:5px;' +
    'background:#1c1c1a;border-radius:10px;padding:7px 9px;box-shadow:0 6px 24px rgba(0,0,0,.3);}' +
    '#cms-toolbar button{border:none;cursor:pointer;background:#2a2e3d;color:#fff;border-radius:6px;' +
    'width:26px;height:26px;font:600 13px/1 "Space Grotesk",system-ui,sans-serif;display:inline-flex;align-items:center;justify-content:center;}' +
    '#cms-toolbar button:hover{background:#3a3f52;}' +
    '#cms-toolbar .cms-swatch{border:1.5px solid rgba(255,255,255,.35);}' +
    '#cms-toolbar .cms-sep{width:1px;height:18px;background:#3a3f52;margin:0 2px;}' +
    '#cms-toolbar .cms-custom{position:relative;width:26px;height:26px;border-radius:6px;background:' +
    'conic-gradient(red,yellow,lime,cyan,blue,magenta,red);display:inline-flex;align-items:center;justify-content:center;' +
    'color:#fff;font:700 14px/1 "Space Grotesk",sans-serif;cursor:pointer;text-shadow:0 1px 2px rgba(0,0,0,.6);}' +
    '#cms-toolbar .cms-custom input{position:absolute;inset:0;opacity:0;cursor:pointer;}';
  document.head.appendChild(barCss);
  document.body.appendChild(bar);

  var barTarget = null;
  function showBar(el) {
    barTarget = el;
    var lb = bar.querySelector('#cms-linkbtn');
    if (lb) lb.hidden = el.tagName !== 'A';
    bar.style.display = 'flex';
    var r = el.getBoundingClientRect();
    var top = r.top - 46;
    if (top < 8) top = r.bottom + 10;
    bar.style.top = top + 'px';
    bar.style.left = Math.max(8, Math.min(window.innerWidth - 330, r.left)) + 'px';
  }
  function hideBar() { bar.style.display = 'none'; barTarget = null; }

  function applyCmd(cmd, arg) {
    if (!barTarget) return;
    barTarget.focus();
    document.execCommand(cmd, false, arg || null);
    // execCommand fires input in most browsers; fire manually to be safe
    barTarget.dispatchEvent(new Event('input', { bubbles: false }));
  }
  bar.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep the text selection
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cmd) applyCmd(b.dataset.cmd);
    else if (b.dataset.color) applyCmd('foreColor', b.dataset.color);
    else if (b.dataset.act === 'link' && barTarget && barTarget.tagName === 'A') {
      var current = barTarget.getAttribute('href') || '';
      var next = window.prompt('Link to (web address, email like mailto:you@x.co.nz, or phone like tel:075551234):', current);
      if (next == null) return;
      next = next.trim();
      if (!next) return;
      if (/^www\./i.test(next)) next = 'https://' + next;
      var key = barTarget.getAttribute('data-cms');
      textEls.forEach(function (other) {
        if (other.tagName === 'A' && other.getAttribute('data-cms') === key) other.setAttribute('href', next);
      });
      send({ type: 'cms-patch', key: key + '.href', kind: 'link', value: next, dirty: true });
    }
  });
  bar.querySelector('input[type=color]').addEventListener('input', function () {
    applyCmd('foreColor', this.value);
  });

  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('[data-cms]');
    if (el) showBar(el);
    else if (!bar.contains(e.target)) hideBar();
  });
  document.addEventListener('focusout', function (e) {
    setTimeout(function () {
      var a = document.activeElement;
      if (!a || (!bar.contains(a) && !(a.closest && a.closest('[data-cms]')))) hideBar();
    }, 60);
  });
  window.addEventListener('scroll', function () { if (barTarget) showBar(barTarget); }, true);

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
        if (p.kind === 'link') {
          var base = key.replace(/\.href$/, '');
          textEls.forEach(function (el) {
            if (el.tagName === 'A' && el.getAttribute('data-cms') === base) el.setAttribute('href', p.value);
          });
          return;
        }
        if (p.kind !== 'text') return;
        textEls.forEach(function (el) {
          if (el.getAttribute('data-cms') === key) setRich(el, p.value);
        });
      });
    } else if (e.data.type === 'cms-set-image') {
      setImage(e.data.key, e.data.src);
    }
  });

  send({ type: 'cms-ready', site: document.currentScript ? document.currentScript.dataset.site : '' });
})();
