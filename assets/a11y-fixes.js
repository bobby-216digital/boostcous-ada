/* Boostcous accessibility fixes — Oct 2026. Remove file + <script> tag to roll back.
   Runtime fixes for markup we don't own in theme files (Replo pages, app widgets).
   Each fix only fills in something missing; it never overrides existing labels. */
(function () {
  var NEW_WINDOW_ID = 'a11y-new-window-message';

  function nameOf(el) {
    return (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.textContent || '').trim();
  }

  function guessLabel(el) {
    var c = ((el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '') + ' ' + (el.id || '');
    c = c.toLowerCase();
    if (/close/.test(c)) return 'Close';
    if (/next|right/.test(c)) return 'Next';
    if (/prev|left|back/.test(c)) return 'Previous';
    if (/cart|bag/.test(c)) return 'Cart';
    if (/search/.test(c)) return 'Search';
    if (/menu|hamburger|drawer/.test(c)) return 'Menu';
    if (/play/.test(c)) return 'Play video';
    if (/pause/.test(c)) return 'Pause';
    if (/mute|sound|volume/.test(c)) return 'Toggle sound';
    var img = el.querySelector('img[alt]:not([alt=""])');
    if (img) return img.getAttribute('alt');
    return null;
  }

  function fix(root) {
    root = root || document;

    // Product quantity box: the visible label is aria-hidden, so point the input
    // at the theme's existing screen-reader label (WCAG 4.1.2 / 1.3.1)
    root.querySelectorAll('input.quantity__input[id^="Quantity-"]:not([aria-labelledby])').forEach(function (input) {
      var sectionId = input.id.replace(/^Quantity-/, '');
      var label = document.getElementById('quantity-label-' + sectionId);
      if (label) input.setAttribute('aria-labelledby', label.id);
      else input.setAttribute('aria-label', 'Quantity');
    });

    // Country selector is rendered in header, mobile drawer and footer with the
    // same hard-coded ids; make them unique (WCAG 4.1.1 / 4.1.2)
    var seen = 0;
    document.querySelectorAll('input.country-filter__input#country-filter-input').forEach(function (input) {
      var form = input.closest('form');
      var prefix = (form && form.id) ? form.id : 'country-' + (seen + 1);
      seen++;
      var newId = prefix + '-country-filter-input';
      var field = input.closest('.field') || input.parentNode;
      var lbl = field.querySelector('label[for="country-filter-input"]');
      input.id = newId;
      if (lbl) lbl.setAttribute('for', newId);
      var list = form && form.querySelector('[id$="-country-results"]');
      if (list) {
        input.setAttribute('aria-owns', list.id);
        input.setAttribute('aria-controls', list.id);
      }
    });

    // Links that open a new window: announce it (WCAG 3.2.5 advisory / Patrol rule)
    root.querySelectorAll('a[target="_blank"]:not([aria-describedby])').forEach(function (a) {
      if (document.getElementById(NEW_WINDOW_ID)) a.setAttribute('aria-describedby', NEW_WINDOW_ID);
    });

    // Iframes without a title (WCAG 4.1.2)
    root.querySelectorAll('iframe:not([title]):not([aria-label])').forEach(function (f) {
      if (f.id === 'PBarNextFrame') return; // Shopify preview bar, not on live site
      var src = f.getAttribute('src') || '';
      var t = /youtube|vimeo/.test(src) ? 'Embedded video' : /instagram/.test(src) ? 'Embedded Instagram post' : /recaptcha/.test(src) ? 'reCAPTCHA' : 'Embedded content';
      f.setAttribute('title', t);
    });

    // Images with no alt attribute at all: mark as decorative only if inside a
    // link/button that already has a name; otherwise leave for content fixes.
    root.querySelectorAll('img:not([alt])').forEach(function (img) {
      var parent = img.closest('a,button,[role="button"]');
      if (parent && nameOf(parent)) img.setAttribute('alt', '');
    });

    // Icon-only buttons/links with no accessible name (WCAG 4.1.2 / 2.4.4)
    root.querySelectorAll('button, [role="button"], a[href]').forEach(function (el) {
      if (nameOf(el)) return;
      var img = el.querySelector('img[alt]');
      if (img && img.getAttribute('alt').trim()) return;
      var label = guessLabel(el);
      if (label) el.setAttribute('aria-label', label);
    });
  }

  // Pause control for continuously moving content (WCAG 2.2.2)
  function addMotionToggle() {
    var moving = Array.prototype.some.call(document.querySelectorAll('body *'), function (el) {
      var s = getComputedStyle(el);
      if (!s.animationName || s.animationName === 'none' || s.animationIterationCount !== 'infinite') return false;
      var cls = String((el.className && el.className.baseVal !== undefined) ? el.className.baseVal : el.className).toLowerCase();
      if (/spinner|loading|loader|skeleton/.test(cls)) return false;
      // only visible, banner-sized moving content (marquees, tickers, rotating banners)
      return el.getClientRects().length > 0 && el.offsetWidth >= 200;
    });
    if (!moving || document.querySelector('.a11y-motion-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'a11y-motion-toggle';
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = 'Pause animations';
    btn.addEventListener('click', function () {
      var paused = document.documentElement.classList.toggle('a11y-motion-paused');
      btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      btn.textContent = paused ? 'Play animations' : 'Pause animations';
      try { localStorage.setItem('a11yMotionPaused', paused ? '1' : '0'); } catch (e) {}
    });
    try {
      if (localStorage.getItem('a11yMotionPaused') === '1') {
        document.documentElement.classList.add('a11y-motion-paused');
        btn.setAttribute('aria-pressed', 'true');
        btn.textContent = 'Play animations';
      }
    } catch (e) {}
    document.body.appendChild(btn);
  }

  function run() {
    fix(document);
    addMotionToggle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.addEventListener('load', function () { fix(document); addMotionToggle(); });

  // Apps and Replo inject content late; re-run on DOM changes (throttled)
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; fix(document); }, 500);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
