/* Boostcous Store Locator — used by sections/store-locator.liquid
   Search, filter, distance sort and a Leaflet map over the `stockist` metaobject.
   The list works on its own: if Leaflet fails to load, only the map is dropped. */
(function () {
  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  var LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  var STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
    CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
    LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
    OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
    WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico'
  };

  var leafletPromise = null;

  function loadLeaflet() {
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise(function (resolve, reject) {
      if (window.L) return resolve(window.L);
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
      var js = document.createElement('script');
      js.src = LEAFLET_JS;
      js.async = true;
      js.onload = function () { window.L ? resolve(window.L) : reject(new Error('leaflet')); };
      js.onerror = function () { reject(new Error('leaflet')); };
      document.head.appendChild(js);
    });
    return leafletPromise;
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function distanceMiles(lat1, lng1, lat2, lng2) {
    var R = 3958.8;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a1 = lat1 * Math.PI / 180;
    var a2 = lat2 * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a1) * Math.cos(a2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function fmtDistance(miles) {
    return miles < 10 ? miles.toFixed(1) + ' mi' : Math.round(miles) + ' mi';
  }

  function init(root) {
    if (root.dataset.bcLocatorReady === 'true') return;
    root.dataset.bcLocatorReady = 'true';

    var cfg = {
      tileUrl: root.getAttribute('data-tile-url') || 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      tileAttribution: root.getAttribute('data-tile-attribution') || 'Tiles &copy; Esri',
      labelUrl: root.getAttribute('data-label-url') || '',
      maxNativeZoom: parseInt(root.getAttribute('data-max-native-zoom'), 10) || 16,
      contactEmail: root.getAttribute('data-contact-email') || '',
      shopUrl: root.getAttribute('data-shop-url') || '/collections/all'
    };

    var dataEl = root.querySelector('[data-loc-data]');
    var listEl = root.querySelector('[data-loc-list]');
    var chipsEl = root.querySelector('[data-loc-chips]');
    var countEl = root.querySelector('[data-loc-count]');
    var originEl = root.querySelector('[data-loc-origin]');
    var formEl = root.querySelector('[data-loc-form]');
    var inputEl = root.querySelector('[data-loc-input]');
    var geoBtn = root.querySelector('[data-loc-geo]');
    var resetBtn = root.querySelector('[data-loc-reset]');
    var canvasEl = root.querySelector('[data-loc-canvas]');
    var mapNoteEl = root.querySelector('[data-loc-mapnote]');
    if (!dataEl || !listEl) return;

    var stores = [];
    try { stores = JSON.parse(dataEl.textContent) || []; } catch (err) { stores = []; }

    stores.forEach(function (s) {
      s.lat = (s.lat === null || s.lat === '' || isNaN(parseFloat(s.lat))) ? null : parseFloat(s.lat);
      s.lng = (s.lng === null || s.lng === '' || isNaN(parseFloat(s.lng))) ? null : parseFloat(s.lng);
      s.products = s.products || [];
      s._search = [s.name, s.chain, s.city, s.state, STATES[s.state] || '', s.zip, s.street]
        .join(' ').toLowerCase();
    });

    var state = { type: 'all', origin: null, originLabel: '', query: '' };
    var map = null;
    var layer = null;
    var markers = {};
    var hoverPopup = null;
    var popupSticky = false;
    var popupCloseTimer = null;

    function hasAddress(s) {
      return !!(s.street || s.zip);
    }

    function addressOneLine(s) {
      var parts = [];
      if (s.street) parts.push(s.street);
      if (s.street2) parts.push(s.street2);
      var tail = [s.city, s.state].filter(Boolean).join(', ');
      if (s.zip) tail = (tail ? tail + ' ' : '') + s.zip;
      if (tail) parts.push(tail);
      return parts.join(', ');
    }

    function directionsUrl(s) {
      return 'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(s.name + ', ' + addressOneLine(s));
    }

    /* ---------- filter chips ---------- */
    var types = [];
    stores.forEach(function (s) {
      if (s.type && types.indexOf(s.type) === -1) types.push(s.type);
    });
    types.sort();

    if (chipsEl && types.length > 1) {
      var chipHtml = '<button class="bc-loc__chip" type="button" data-type="all" aria-pressed="true">All stores</button>';
      types.forEach(function (t) {
        chipHtml += '<button class="bc-loc__chip" type="button" data-type="' + esc(t) + '" aria-pressed="false">' + esc(t) + '</button>';
      });
      chipsEl.innerHTML = chipHtml;
      chipsEl.addEventListener('click', function (event) {
        var btn = event.target.closest('.bc-loc__chip');
        if (!btn) return;
        state.type = btn.getAttribute('data-type');
        Array.prototype.forEach.call(chipsEl.querySelectorAll('.bc-loc__chip'), function (b) {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        render();
        if (!state.origin) fitRows(matching());
      });
    } else if (chipsEl) {
      chipsEl.remove();
    }

    function matching() {
      var rows = stores.filter(function (s) {
        if (state.type !== 'all' && s.type !== state.type) return false;
        if (!state.origin && state.query) return s._search.indexOf(state.query) !== -1;
        return true;
      });
      if (state.origin) {
        rows.forEach(function (s) {
          s._d = (s.lat !== null && s.lng !== null)
            ? distanceMiles(state.origin.lat, state.origin.lng, s.lat, s.lng)
            : null;
        });
        rows.sort(function (a, b) {
          if (a._d === null) return 1;
          if (b._d === null) return -1;
          return a._d - b._d;
        });
      } else {
        rows.forEach(function (s) { s._d = null; });
        rows.sort(function (a, b) {
          if (a.state !== b.state) return a.state < b.state ? -1 : 1;
          if (a.city !== b.city) return a.city < b.city ? -1 : 1;
          return a.name < b.name ? -1 : 1;
        });
      }
      return rows;
    }

    /* ---------- rendering ---------- */
    function cardHtml(s, showDistance) {
      var html = '<li><article class="bc-loc__card" tabindex="0" role="button" data-loc-card="' + esc(s.id) +
        '" aria-label="' + esc(s.name + ', ' + addressOneLine(s)) + '">';
      html += '<div class="bc-loc__card-top"><div><h3 class="bc-loc__name">' + esc(s.name) + '</h3>';
      if (s.chain && s.chain !== s.name) html += '<span class="bc-loc__chain">' + esc(s.chain) + '</span>';
      html += '</div>';
      if (showDistance && s._d !== null) html += '<span class="bc-loc__dist">' + fmtDistance(s._d) + '</span>';
      html += '</div>';
      if (s.soon) html += '<span class="bc-loc__badge">Coming soon' + (s.from ? ' &middot; ' + esc(s.from) : '') + '</span>';
      if (hasAddress(s)) {
        html += '<p class="bc-loc__addr">' + esc(s.street) + (s.street2 ? ', ' + esc(s.street2) : '') +
          '<br>' + esc(s.city) + ', ' + esc(s.state) + ' ' + esc(s.zip) + '</p>';
      } else if (s.city || s.state) {
        html += '<p class="bc-loc__addr">' + esc([s.city, s.state].filter(Boolean).join(', ')) + '</p>';
      }
      if (s.notes) html += '<p class="bc-loc__note">' + esc(s.notes) + '</p>';
      if (s.products.length) {
        html += '<ul class="bc-loc__tags">';
        s.products.forEach(function (p) { html += '<li class="bc-loc__tag">' + esc(p) + '</li>'; });
        html += '</ul>';
      }
      var actions = '';
      if (hasAddress(s)) {
        actions += '<a class="bc-loc__btn" href="' + esc(directionsUrl(s)) + '" target="_blank" rel="noopener">Directions</a>';
      }
      if (s.phone) {
        actions += '<a class="bc-loc__btn bc-loc__btn--light" href="tel:' +
          esc(String(s.phone).replace(/[^0-9+]/g, '')) + '">' + esc(s.phone) + '</a>';
      }
      if (s.website) {
        actions += '<a class="bc-loc__btn bc-loc__btn--light" href="' + esc(s.website) +
          '" target="_blank" rel="noopener">Website</a>';
      }
      if (actions) html += '<div class="bc-loc__actions">' + actions + '</div>';
      html += '</article></li>';
      return html;
    }

    function emptyHtml() {
      var mailto = cfg.contactEmail
        ? '<a class="bc-loc__btn bc-loc__btn--light" href="mailto:' + esc(cfg.contactEmail) +
          '?subject=' + encodeURIComponent('Boostcous store request') + '">Request a store</a>'
        : '';
      return '<li><div class="bc-loc__empty"><h3>No stores match that search yet.</h3>' +
        '<p>We add new stores every month. Try a nearby city, clear the filters, or order straight from us and we will ship it to you.</p>' +
        '<div class="bc-loc__actions"><a class="bc-loc__btn" href="' + esc(cfg.shopUrl) + '">Shop Boostcous</a>' +
        mailto + '</div></div></li>';
    }

    function render() {
      var rows = matching();
      var html = '';

      if (!rows.length) {
        html = emptyHtml();
      } else if (state.origin) {
        rows.forEach(function (s) { html += cardHtml(s, true); });
      } else {
        var currentState = null;
        var counts = {};
        rows.forEach(function (s) { counts[s.state] = (counts[s.state] || 0) + 1; });
        rows.forEach(function (s) {
          if (s.state !== currentState) {
            currentState = s.state;
            html += '<li><p class="bc-loc__grouphead">' + esc(STATES[currentState] || currentState || 'Coming soon') +
              ' &middot; ' + counts[currentState] + '</p></li>';
          }
          html += cardHtml(s, false);
        });
      }

      listEl.innerHTML = html;

      var label = rows.length + (rows.length === 1 ? ' location' : ' locations');
      if (countEl) countEl.textContent = state.origin ? label + ', closest first' : label;
      if (originEl) originEl.textContent = state.originLabel;
      if (resetBtn) resetBtn.hidden = !(state.origin || state.query || state.type !== 'all');

      drawMarkers(rows);
    }

    listEl.addEventListener('click', function (event) {
      var card = event.target.closest('[data-loc-card]');
      if (!card || event.target.closest('a')) return;
      focusStore(card.getAttribute('data-loc-card'));
    });

    listEl.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var card = event.target.closest('[data-loc-card]');
      if (!card) return;
      event.preventDefault();
      focusStore(card.getAttribute('data-loc-card'));
    });

    function setActive(id) {
      Array.prototype.forEach.call(listEl.querySelectorAll('[data-loc-card]'), function (c) {
        c.classList.toggle('is-active', c.getAttribute('data-loc-card') === id);
      });
    }

    function focusStore(id) {
      setActive(id);
      var store = stores.filter(function (s) { return s.id === id; })[0];
      if (!store || !map || store.lat === null) return;
      map.setView([store.lat, store.lng], Math.max(map.getZoom(), 11), { animate: true });
      showPopup(store, true);
    }

    /* ---------- search ---------- */
    if (formEl) {
      formEl.addEventListener('submit', function (event) {
        event.preventDefault();
        runSearch(inputEl.value.trim());
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        state.origin = null;
        state.originLabel = '';
        state.query = '';
        state.type = 'all';
        if (inputEl) inputEl.value = '';
        if (chipsEl) {
          Array.prototype.forEach.call(chipsEl.querySelectorAll('.bc-loc__chip'), function (b) {
            b.setAttribute('aria-pressed', b.getAttribute('data-type') === 'all' ? 'true' : 'false');
          });
        }
        render();
        fitRows(stores);
      });
    }

    function runSearch(query) {
      if (!query) {
        state.origin = null;
        state.originLabel = '';
        state.query = '';
        render();
        fitRows(stores);
        return;
      }
      state.query = query.toLowerCase();
      if (countEl) countEl.textContent = 'Searching…';
      geocode(query).then(function (place) {
        state.origin = place;
        state.originLabel = place ? 'near ' + place.label : '';
        render();
        var rows = matching();
        if (place && map && window.L) {
          var pts = rows.filter(function (s) { return s.lat !== null; }).slice(0, 5)
            .map(function (s) { return [s.lat, s.lng]; });
          pts.push([place.lat, place.lng]);
          map.fitBounds(window.L.latLngBounds(pts).pad(0.25));
        } else {
          fitRows(rows);
        }
      });
    }

    function geocode(query) {
      var clean = query.replace(/\s+/g, ' ').trim();
      var cacheKey = 'bcloc:q:' + clean.toLowerCase();
      try {
        var hit = sessionStorage.getItem(cacheKey);
        if (hit) return Promise.resolve(JSON.parse(hit));
      } catch (err) { /* storage unavailable */ }

      var zip = clean.replace(/\s/g, '');
      var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&addressdetails=1&';
      url += /^\d{5}$/.test(zip) ? 'postalcode=' + encodeURIComponent(zip) : 'q=' + encodeURIComponent(clean);
      if (cfg.contactEmail) url += '&email=' + encodeURIComponent(cfg.contactEmail);

      return fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (json) {
          if (!json || !json.length) return null;
          var addr = json[0].address || {};
          var label = addr.city || addr.town || addr.village || addr.hamlet || addr.county || clean;
          if (addr.state) label += ', ' + addr.state;
          var place = { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon), label: label };
          try { sessionStorage.setItem(cacheKey, JSON.stringify(place)); } catch (err) { /* ignore */ }
          return place;
        })
        .catch(function () { return null; });
    }

    if (geoBtn) {
      geoBtn.addEventListener('click', function () {
        if (!navigator.geolocation) return;
        var original = geoBtn.innerHTML;
        geoBtn.textContent = 'Locating…';
        navigator.geolocation.getCurrentPosition(function (pos) {
          geoBtn.innerHTML = original;
          state.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'you' };
          state.originLabel = 'near you';
          state.query = '';
          if (inputEl) inputEl.value = '';
          render();
          if (map) map.setView([state.origin.lat, state.origin.lng], 9);
        }, function () {
          geoBtn.innerHTML = original;
          if (countEl) countEl.textContent = 'We could not get your location. Try a ZIP code instead.';
        }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
      });
    }

    /* ---------- map ---------- */
    function pinIcon(s) {
      var cls = 'bc-loc__pin' + (s.soon ? ' bc-loc__pin--soon' : '');
      return window.L.divIcon({
        className: 'bc-loc__pinwrap',
        html: '<span class="' + cls + '"></span>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -24]
      });
    }

    function popupHtml(s) {
      var html = '<div class="bc-loc__pop"><strong>' + esc(s.name) + '</strong>';
      html += '<span>' + esc(addressOneLine(s)) + '</span>';
      if (s.soon) html += '<span>Coming soon' + (s.from ? ' &middot; ' + esc(s.from) : '') + '</span>';
      html += '<a href="' + esc(directionsUrl(s)) + '" target="_blank" rel="noopener">Get directions</a></div>';
      return html;
    }

    /* Hover shows the card on the map. Click highlights the row in the list.
       The popup is a standalone L.popup rather than marker.bindPopup, because bindPopup
       installs its own click-to-toggle handler that would fight the hover state. */
    function cancelPopupClose() {
      if (popupCloseTimer) { window.clearTimeout(popupCloseTimer); popupCloseTimer = null; }
    }

    function schedulePopupClose() {
      cancelPopupClose();
      popupCloseTimer = window.setTimeout(function () {
        popupCloseTimer = null;
        if (map && hoverPopup) map.closePopup(hoverPopup);
      }, 180);
    }

    function bindPopupHover() {
      if (!hoverPopup) return;
      var el = hoverPopup.getElement();
      if (!el || el.getAttribute('data-bc-hover') === '1') return;
      el.setAttribute('data-bc-hover', '1');
      el.addEventListener('mouseenter', cancelPopupClose);
      el.addEventListener('mouseleave', function () { if (!popupSticky) schedulePopupClose(); });
    }

    function showPopup(s, sticky) {
      if (!map || !window.L || !s || s.lat === null || s.lng === null) return;
      if (hoverPopup === null) {
        hoverPopup = window.L.popup({
          autoPan: false,
          closeButton: true,
          offset: [0, -22],
          className: 'bc-loc__hoverpop'
        });
      }
      cancelPopupClose();
      popupSticky = !!sticky;
      hoverPopup.setLatLng([s.lat, s.lng]).setContent(popupHtml(s)).openOn(map);
      bindPopupHover();
    }

    function drawMarkers(rows) {
      if (!map || !window.L) return;
      layer.clearLayers();
      markers = {};
      rows.forEach(function (s) {
        if (s.lat === null || s.lng === null) return;
        var marker = window.L.marker([s.lat, s.lng], { icon: pinIcon(s), title: s.name, riseOnHover: true });
        marker.on('mouseover', function () { showPopup(s, false); });
        marker.on('mouseout', function () { if (!popupSticky) schedulePopupClose(); });
        marker.on('click', function () {
          setActive(s.id);
          var card = listEl.querySelector('[data-loc-card="' + s.id + '"]');
          if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          showPopup(s, true);
        });
        marker.addTo(layer);
        markers[s.id] = marker;
      });
    }

    function fitRows(rows) {
      if (!map || !window.L) return;
      var pts = rows.filter(function (s) { return s.lat !== null && s.lng !== null; })
        .map(function (s) { return [s.lat, s.lng]; });
      if (!pts.length) return;
      if (pts.length === 1) { map.setView(pts[0], 11); return; }
      map.fitBounds(window.L.latLngBounds(pts).pad(0.12));
    }

    function initMap() {
      map = window.L.map(canvasEl, { scrollWheelZoom: false, attributionControl: false }).setView([39.5, -98.35], 4);
      window.L.tileLayer(cfg.tileUrl, {
        maxZoom: 18,
        maxNativeZoom: cfg.maxNativeZoom
      }).addTo(map);
      if (cfg.labelUrl) {
        window.L.tileLayer(cfg.labelUrl, {
          maxZoom: 18,
          maxNativeZoom: cfg.maxNativeZoom
        }).addTo(map);
      }
      layer = window.L.layerGroup().addTo(map);
      map.on('click', function () { setActive(null); });
      map.on('popupclose', function () { popupSticky = false; cancelPopupClose(); });
      if (mapNoteEl) mapNoteEl.remove();
      render();
      fitRows(stores);
    }

    function dropMap() {
      var mapEl = root.querySelector('.bc-loc__map');
      if (mapEl) mapEl.remove();
      var panel = root.querySelector('.bc-loc__panel');
      if (panel) panel.style.gridTemplateColumns = 'minmax(0, 1fr)';
      var side = root.querySelector('.bc-loc__side');
      if (side) side.style.borderRight = '0';
    }

    /* ---------- fill in missing coordinates ---------- */
    function backfillCoords() {
      var missing = stores.filter(function (s) { return (s.lat === null || s.lng === null) && hasAddress(s); });
      if (!missing.length) return;

      var cache = {};
      try { cache = JSON.parse(localStorage.getItem('bcloc:geo:v1') || '{}'); } catch (err) { cache = {}; }

      var queue = [];
      var fromCache = false;
      missing.forEach(function (s) {
        var key = (s.street + ' ' + s.city + ' ' + s.state + ' ' + s.zip).toLowerCase();
        if (cache[key]) {
          s.lat = cache[key][0];
          s.lng = cache[key][1];
          fromCache = true;
        } else {
          queue.push({ store: s, key: key });
        }
      });
      if (fromCache) render();

      queue = queue.slice(0, 12);
      var index = 0;

      function next() {
        if (index >= queue.length) return;
        var item = queue[index++];
        var s = item.store;
        var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' +
          encodeURIComponent(s.street + ', ' + s.city + ', ' + s.state + ' ' + s.zip);
        if (cfg.contactEmail) url += '&email=' + encodeURIComponent(cfg.contactEmail);
        fetch(url, { headers: { Accept: 'application/json' } })
          .then(function (res) { return res.ok ? res.json() : []; })
          .then(function (json) {
            if (json && json.length) {
              s.lat = parseFloat(json[0].lat);
              s.lng = parseFloat(json[0].lon);
              cache[item.key] = [s.lat, s.lng];
              try { localStorage.setItem('bcloc:geo:v1', JSON.stringify(cache)); } catch (err) { /* ignore */ }
              render();
            }
          })
          .catch(function () { /* ignore */ })
          .then(function () { window.setTimeout(next, 1200); });
      }

      window.setTimeout(next, 1500);
    }

    /* ---------- boot ---------- */
    render();

    var params = new URLSearchParams(window.location.search);
    var preset = params.get('q') || params.get('zip') || '';
    if (preset && inputEl) inputEl.value = preset;

    loadLeaflet().then(function () {
      initMap();
      if (preset) runSearch(preset);
      backfillCoords();
    }).catch(function () {
      dropMap();
      if (preset) runSearch(preset);
      backfillCoords();
    });
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-bc-locator]'), init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var root = event.target.querySelector('[data-bc-locator]');
    if (root) init(root);
  });
})();
