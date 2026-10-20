/* Boostcous accessibility fixes for Replo + app content — Oct 2026.
   Fills gaps Replo's editor can't set. Only adds missing attributes. */
(function () {
  function hasName(el) {
    return !!((el.getAttribute('aria-label') || '').trim() || el.getAttribute('aria-labelledby'));
  }

  function fix() {
    // 1. Option lists (listbox) with no name: use the label Replo put on a wrapper,
    //    otherwise describe them from their content.
    document.querySelectorAll('[role="listbox"]').forEach(function (lb) {
      if (hasName(lb)) return;
      var wrap = lb.parentElement && lb.parentElement.closest('[aria-label]');
      var label = wrap && wrap.getAttribute('aria-label');
      if (!label) label = /try once/i.test(lb.textContent) ? 'One-time purchase' : 'Purchase options';
      lb.setAttribute('aria-label', label);
    });

    // 2. Copies of the same image (carousel clones, mobile/desktop versions):
    //    mirror the alt / label / decorative setting from the edited original.
    var key = function (img) { return ((img.getAttribute('src') || '').split('?')[0].split('/').pop()); };
    var bySrc = {};
    document.querySelectorAll('img').forEach(function (img) {
      var src = key(img);
      if (!src) return;
      if (img.getAttribute('aria-label') || (img.getAttribute('alt') || '').trim() || img.getAttribute('role') === 'presentation') {
        if (!bySrc[src]) bySrc[src] = img;
      }
    });
    document.querySelectorAll('img:not([alt]):not([aria-label])').forEach(function (img) {
      var ref = bySrc[key(img)];
      if (!ref) return;
      if (ref.getAttribute('aria-label')) img.setAttribute('aria-label', ref.getAttribute('aria-label'));
      else if ((ref.getAttribute('alt') || '').trim()) img.setAttribute('alt', ref.getAttribute('alt'));
      else { img.setAttribute('alt', ''); img.setAttribute('role', 'presentation'); }
    });

    // 2b. Specific images with no description in Replo (by image file).
    var named = { '2d5289ee-79e6-463f-a0c9-0f7f7a2fdb0d': 'Red lentils' };
    document.querySelectorAll('img:not([alt]):not([aria-label])').forEach(function (img) {
      if (named[key(img)]) img.setAttribute('alt', named[key(img)]);
    });

    // 3. Small icons with no text alternative that sit next to visible text
    //    (feature / shipping / benefit icons) are decorative.
    document.querySelectorAll('[data-rid] img:not([alt]):not([aria-label])').forEach(function (img) {
      var w = img.getBoundingClientRect().width;
      if (w > 90) return; // hidden (0px) or small icons only
      var box = img.parentElement;
      for (var i = 0; i < 3 && box; i++) {
        if ((box.innerText || '').trim().length > 2) { img.setAttribute('alt', ''); return; }
        box = box.parentElement;
      }
    });

    // 3b. Inline SVG icons with no name are decorative (WCAG 1.1.1)
    document.querySelectorAll('svg:not([aria-hidden]):not([aria-label]):not([aria-labelledby]):not([role="img"])').forEach(function (svg) {
      if (svg.querySelector('title')) return;
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
    });

    // 3c. Icon-only buttons with a tooltip but no accessible name (e.g. chat bubble).
    document.querySelectorAll('button[title]:not([aria-label]):not([aria-labelledby])').forEach(function (b) {
      if (!(b.innerText || '').trim()) b.setAttribute('aria-label', b.getAttribute('title'));
    });

    // 4. Carousels that share the same landmark name: make each unique.
    var seen = {};
    document.querySelectorAll('[role="region"][aria-label]').forEach(function (r) {
      var l = r.getAttribute('aria-label');
      seen[l] = (seen[l] || 0) + 1;
      if (seen[l] > 1) r.setAttribute('aria-label', l + ' ' + seen[l]);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fix);
  else fix();
  window.addEventListener('load', fix);
  var t;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(fix, 600); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
