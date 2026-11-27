/*
 * DevDocTrad - ui.js : icônes (une seule famille : trait 1,8, extrémités rondes, grille 24),
 * notifications et thème, partagés par le popup et les réglages. Licence MIT.
 */
(function (root) {
  'use strict';
  var DDT = root.DDT;
  var P = {
    translate: [['rect', { x: '3.5', y: '3', width: '11', height: '14', rx: '2.5', transform: 'rotate(-8 9 10)' }], ['rect', { x: '9.5', y: '7', width: '11', height: '14', rx: '2.5' }], ['path', { d: 'M12.5 12h5M12.5 15.5h3.5' }]],
    stop: [['rect', { x: '6', y: '6', width: '12', height: '12', rx: '2.5' }]],
    original: [['path', { d: 'M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z' }], ['circle', { cx: '12', cy: '12', r: '2.5' }]],
    swap: [['path', { d: 'M7 7h11l-3-3M17 17H6l3 3' }]],
    gear: [['circle', { cx: '12', cy: '12', r: '3' }], ['path', { d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' }]],
    check: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M8 12.5l2.5 2.5L16 9.5' }]],
    alert: [['path', { d: 'M12 3.5 2.8 19.5h18.4L12 3.5Z' }], ['path', { d: 'M12 10v4M12 17h.01' }]],
    error: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M9 9l6 6M15 9l-6 6' }]],
    info: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 11v5M12 8h.01' }]],
    pause: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M10 9v6M14 9v6' }]],
    off: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M8 12h8' }]],
    key: [['circle', { cx: '8', cy: '15', r: '4' }], ['path', { d: 'M11 12l8-8M16 7l2 2M14 9l2 2' }]],
    cpu: [['rect', { x: '6', y: '6', width: '12', height: '12', rx: '2' }], ['path', { d: 'M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3' }]],
    shield: [['path', { d: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z' }]],
    globe: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M3 12h18M12 3c2.5 2.7 3.6 5.7 3.6 9S14.5 18.3 12 21c-2.5-2.7-3.6-5.7-3.6-9S9.5 5.7 12 3Z' }]],
    book: [['path', { d: 'M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4Z' }], ['path', { d: 'M5 16a4 4 0 0 1 4-4h9' }]],
    database: [['ellipse', { cx: '12', cy: '6', rx: '7', ry: '3' }], ['path', { d: 'M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3' }]],
    palette: [['path', { d: 'M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5-1.2-1.7-1.2-3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.2 17 3 12 3Z' }], ['circle', { cx: '7.5', cy: '11', r: '1' }], ['circle', { cx: '10', cy: '7', r: '1' }], ['circle', { cx: '15', cy: '7.5', r: '1' }]],
    coin: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M14.8 9.3c-.5-.9-1.5-1.3-2.8-1.3-1.6 0-2.8.8-2.8 2 0 2.8 5.6 1.5 5.6 4.3 0 1.2-1.2 2-2.8 2-1.3 0-2.4-.5-2.9-1.4M12 6.5v11' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    up: [['path', { d: 'M12 19V5M6 11l6-6 6 6' }]],
    down: [['path', { d: 'M12 5v14M6 13l6 6 6-6' }]],
    trash: [['path', { d: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' }]],
    eye: [['path', { d: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z' }], ['circle', { cx: '12', cy: '12', r: '2.8' }]],
    keyboard: [['rect', { x: '2.5', y: '6', width: '19', height: '12', rx: '2.5' }], ['path', { d: 'M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9' }]],
    sun: [['circle', { cx: '12', cy: '12', r: '4' }], ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }]],
    moon: [['path', { d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z' }]],
    monitor: [['rect', { x: '3', y: '4', width: '18', height: '12', rx: '2' }], ['path', { d: 'M8 20h8M12 16v4' }]],
    download: [['path', { d: 'M12 4v11M7 10l5 5 5-5M5 20h14' }]],
    upload: [['path', { d: 'M12 20V9M7 14l5-5 5 5M5 4h14' }]],
    test: [['path', { d: 'M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3' }], ['path', { d: 'M7.5 15h9' }]],
    list: [['path', { d: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' }]]
  };
  /* Icônes construites nœud par nœud (createElementNS) à partir des données ci-dessus :
     aucune chaîne HTML n'est analysée (exigence du validateur de Mozilla). */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SVG_ATTRS = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  function svgEl(doc, attrs, parts) {
    var s = doc.createElementNS(SVG_NS, 'svg');
    var k;
    for (k in attrs) s.setAttribute(k, attrs[k]);
    for (var i = 0; i < parts.length; i++) {
      var c = doc.createElementNS(SVG_NS, parts[i][0]);
      for (k in parts[i][1]) c.setAttribute(k, parts[i][1][k]);
      s.appendChild(c);
    }
    return s;
  }
  function icon(name, cls) {
    var s = svgEl(document, SVG_ATTRS, P[name] || P.info);
    s.setAttribute('class', cls || '');
    return s;
  }
  function spinner(cls) {
    var s = document.createElement('span');
    s.className = 'spinner' + (cls ? ' ' + cls : '');
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
  /* Vide el puis y place un seul nœud (icône ou indicateur d'attente) */
  function setOnly(el, node) {
    el.textContent = '';
    el.appendChild(node);
    return el;
  }
  function fillIcons(scope) {
    var els = (scope || document).querySelectorAll('[data-icon]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].querySelector(':scope > svg')) continue;
      els[i].insertBefore(icon(els[i].getAttribute('data-icon')), els[i].firstChild);
    }
  }

  /* Notifications : succès 2,5 s, info 4 s, avertissement 7 s, erreur jusqu'à fermeture.
     Chaque notification porte role=status ou role=alert ; le conteneur n'a pas d'aria-live
     (sinon les lecteurs d'écran l'annonçaient deux fois). */
  var TYPES = { success: ['check', 2500], info: ['info', 4000], progress: ['info', 0], warning: ['alert', 7000], error: ['error', 0] };
  function toast(type, message, opts) {
    opts = opts || {};
    var box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    var def = TYPES[type] || TYPES.info;
    var el = document.createElement('div');
    el.className = 'toast m-floating ' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.appendChild(type === 'progress' ? spinner('ti') : icon(def[0], 'ti'));
    var tm = document.createElement('div');
    tm.className = 'tm';
    tm.textContent = message;
    el.appendChild(tm);
    var close = document.createElement('button');
    close.className = 'tx';
    close.setAttribute('aria-label', DDT.t('btnClose'));
    close.textContent = '×';
    el.appendChild(close);
    function remove() { if (!el.parentNode) return; el.classList.add('out'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220); }
    close.addEventListener('click', remove);
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    var ms = opts.timeout !== undefined ? opts.timeout : def[1];
    if (ms) setTimeout(remove, ms);
    return { close: remove, el: el };
  }

  /* Thème : système / clair / sombre, mémorisé aussi dans localStorage pour theme.js */
  function applyTheme(t) {
    var html = document.documentElement;
    if (t === 'light' || t === 'dark') html.setAttribute('data-theme', t); else html.removeAttribute('data-theme');
    try { localStorage.setItem('ddt-theme', t || 'system'); } catch (e) { /* rien */ }
  }
  function syncTheme() {
    if (!DDT.api || !DDT.api.storage) return;
    DDT.api.storage.local.get('settings').then(function (r) { applyTheme((r.settings && r.settings.theme) || 'system'); });
    if (DDT.api.storage.onChanged) {
      DDT.api.storage.onChanged.addListener(function (ch) {
        if (ch.settings && ch.settings.newValue) applyTheme(ch.settings.newValue.theme || 'system');
      });
    }
  }

  root.DDT_UI = { icon: icon, spinner: spinner, setOnly: setOnly, svgEl: svgEl, fillIcons: fillIcons, toast: toast, applyTheme: applyTheme, syncTheme: syncTheme, ICONS: P };
})(window);
