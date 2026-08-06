// Shared CMS client: Supabase session + small helpers.
// Requires the supabase-js UMD bundle to be loaded first.
(function () {
  var SUPABASE_URL = 'https://gcrcfyudxqbxizleokbn.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_9uE9KXPH8PBQdmJHiyeERw_qsIDhN1h'; // publishable key — safe to be public

  window.cms = {
    sb: window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON),

    $: function (sel, root) { return (root || document).querySelector(sel); },
    $$: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    // current session or null
    session: async function () {
      var r = await window.cms.sb.auth.getSession();
      return (r.data && r.data.session) || null;
    },

    // redirect to login when signed out; returns session otherwise
    requireAuth: async function () {
      var s = await window.cms.session();
      if (!s) { location.href = '/cms/'; return null; }
      return s;
    },

    // POST to a CMS function with the user's token
    api: async function (name, body) {
      var s = await window.cms.session();
      if (!s) throw new Error('not signed in');
      var res = await fetch('/api/' + name, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + s.access_token
        },
        body: JSON.stringify(body)
      });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error((data && data.error) || ('request failed (' + res.status + ')'));
      return data;
    },

    // Downscale an image file to maxPx and return { ext, base64 } for cms-upload.
    downscale: function (file, maxPx) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        var url = URL.createObjectURL(file);
        img.onload = function () {
          URL.revokeObjectURL(url);
          var MAX = maxPx || 1920;
          var scale = Math.min(1, MAX / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          var isPng = file.type === 'image/png';
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error('could not process image')); return; }
            var fr = new FileReader();
            fr.onload = function () {
              resolve({ ext: isPng ? 'png' : 'jpg', base64: String(fr.result).split(',')[1] });
            };
            fr.onerror = function () { reject(new Error('could not read image')); };
            fr.readAsDataURL(blob);
          }, isPng ? 'image/png' : 'image/jpeg', 0.85);
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('not a valid image')); };
        img.src = url;
      });
    },

    // profile + memberships for the signed-in user
    whoami: async function () {
      var s = await window.cms.session();
      if (!s) return null;
      var sb = window.cms.sb;
      var prof = await sb.from('profiles').select('is_admin,email').eq('user_id', s.user.id).maybeSingle();
      var isAdmin = !!(prof.data && prof.data.is_admin);
      var sites;
      if (isAdmin) {
        sites = (await sb.from('sites').select('slug,name').order('name')).data || [];
      } else {
        var mem = (await sb.from('site_members').select('site_slug')).data || [];
        var slugs = mem.map(function (m) { return m.site_slug; });
        sites = slugs.length
          ? ((await sb.from('sites').select('slug,name').in('slug', slugs).order('name')).data || [])
          : [];
      }
      return { user: s.user, isAdmin: isAdmin, sites: sites };
    }
  };
})();
