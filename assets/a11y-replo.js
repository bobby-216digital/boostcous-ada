/* Boostcous accessibility fixes for Replo + app content — Oct 2026.
   Fills gaps Replo's editor can't set, and removes ARIA that Replo/apps
   apply in invalid places. */
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

    // 1b. A plain div/span can't carry a name; once the list inside it is
    //     named, drop the wrapper's copy.
    document.querySelectorAll('div[aria-label]:not([role]), span[aria-label]:not([role])').forEach(function (wrap) {
      var lb = wrap.querySelector('[role="listbox"]');
      if (lb && lb.getAttribute('aria-label') === wrap.getAttribute('aria-label')) wrap.removeAttribute('aria-label');
    });

    // 2. Copies of the same image (carousel clones, mobile/desktop versions):
    //    mirror the alt / label / decorative setting from the edited original.
    var key = function (img) { return ((img.getAttribute('src') || '').split('?')[0].split('/').pop()); };
    var bySrc = {};
    document.querySelectorAll('img').forEach(function (img) {
      var src = key(img);
      if (!src) return;
      if (img.getAttribute('aria-label') || img.hasAttribute('alt')) {
        if (!bySrc[src]) bySrc[src] = img;
      }
    });
    document.querySelectorAll('img:not([alt]):not([aria-label])').forEach(function (img) {
      var ref = bySrc[key(img)];
      if (!ref) return;
      if (ref.getAttribute('aria-label')) img.setAttribute('aria-label', ref.getAttribute('aria-label'));
      else if ((ref.getAttribute('alt') || '').trim()) img.setAttribute('alt', ref.getAttribute('alt'));
      else img.setAttribute('alt', '');
    });

    // 2b. Specific images with no description in Replo (by image file).
    var named = {
      '2d5289ee-79e6-463f-a0c9-0f7f7a2fdb0d': 'Red lentils',
      'c25ea804-cc35-49f8-a021-9c7792431e53': '18g of protein',
      '6c96cae9-7f6e-40c0-965d-b81af6214027': '11g of fiber'
    };
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

    // 5. Decorative images: alt="" already hides them, a role on top is invalid.
    document.querySelectorAll('img[alt=""][role="presentation"], img[alt=""][role="none"]').forEach(function (img) {
      img.removeAttribute('role');
    });

    // 5b. Popup images left with the placeholder alt "Image" are decorative
    //     (the popup's text carries the message).
    document.querySelectorAll('[id^="alia-root"] img[alt="Image"]').forEach(function (img) {
      img.setAttribute('alt', '');
    });

    // 6. Judge.me star badge placed inside a link or clickable card: its stars
    //    are a separate button, which can't be nested. Keep them as an image
    //    of the rating; the outer control still opens the reviews.
    document.querySelectorAll('.jdgm-prev-badge__stars[role="button"]').forEach(function (stars) {
      var host = stars.parentElement && stars.parentElement.closest('a[href], button, [role="button"], [role="link"]');
      if (!host) return;
      var scored = stars.closest('[data-score]');
      stars.removeAttribute('tabindex');
      stars.setAttribute('role', 'img');
      if (scored) stars.setAttribute('aria-label', scored.getAttribute('data-score') + ' out of 5 stars');
    });

    // 7. Cards set up as a button/option that also contain their own buttons or
    //    options: the inner controls get hidden from screen readers. Make the
    //    card a named group instead; clicking it still works the same.
    var FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    document.querySelectorAll('[data-rid][role="button"], [data-rid][role="option"]').forEach(function (card) {
      if (!card.querySelector(FOCUSABLE)) return;
      var title = (card.innerText || '').trim().split('\n')[0].trim();
      card.setAttribute('role', 'group');
      card.removeAttribute('tabindex');
      card.removeAttribute('aria-selected');
      if (title && !hasName(card)) card.setAttribute('aria-label', title);
    });
    document.querySelectorAll('[data-rid][role="group"][aria-selected]').forEach(function (card) {
      card.removeAttribute('aria-selected');
    });
    document.querySelectorAll('[role="listbox"]').forEach(function (lb) {
      if (!lb.querySelector('[role="option"]')) lb.setAttribute('role', 'group');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fix);
  else fix();
  window.addEventListener('load', fix);
  var t;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(fix, 600); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
})();
