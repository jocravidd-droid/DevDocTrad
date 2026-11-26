/* DevDocTrad - site : démo des modes, démo de la voix, thème clair/sombre, apparitions au défilement,
   boutons copier. Aucune bibliothèque, aucune requête réseau ; sans JavaScript, la page reste complète.
   Copié tel quel dans docs/site.js par tools/build_site.py. Licence MIT. */
(function () {
  'use strict';
  var d = document;
  var root = d.documentElement;
  var THEME_KEY = 'ddt-site-theme';

  function media(q) {
    return window.matchMedia ? window.matchMedia(q) : { matches: false };
  }
  function onChange(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }
  function each(sel, fn, scope) {
    Array.prototype.forEach.call((scope || d).querySelectorAll(sel), fn);
  }
  var reduce = media('(prefers-reduced-motion: reduce)');
  var systemDark = media('(prefers-color-scheme: dark)');

  // Relance une animation CSS (classe retirée puis remise), sauf si l'utilisateur limite les animations.
  function replay(el, cls) {
    el.classList.remove(cls);
    if (reduce.matches) return;
    void el.offsetWidth;
    el.classList.add(cls);
  }

  /* ---------- Thème clair / sombre : suit le système, sauf choix mémorisé ---------- */
  var themeBtn = d.querySelector('button.theme');
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : systemDark.matches;
  }
  function syncTheme() {
    if (themeBtn) themeBtn.setAttribute('aria-pressed', String(isDark()));
  }
  if (themeBtn) {
    themeBtn.hidden = false;
    syncTheme();
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* stockage bloqué : le choix vaut pour cette visite */ }
      syncTheme();
    });
    onChange(systemDark, syncTheme);
  }

  /* ---------- Démo des modes : Original / Traduction / Bilingue ---------- */
  each('.demo', function (demo) {
    var group = demo.querySelector('.modes');
    var doc = demo.querySelector('.doc');
    if (!group) return;
    var btns = Array.prototype.slice.call(group.querySelectorAll('button[data-mode]'));
    function set(mode, animate) {
      demo.setAttribute('data-mode', mode);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === mode)); });
      if (animate && doc) replay(doc, 'swap');
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { set(b.getAttribute('data-mode'), true); });
      // Flèches : bouton voisin (sens visuel, donc inversé en droite-à-gauche)
      b.addEventListener('keydown', function (e) {
        var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        if (getComputedStyle(group).direction === 'rtl') step = -step;
        var next = btns[(i + step + btns.length) % btns.length];
        e.preventDefault();
        next.focus();
        set(next.getAttribute('data-mode'), true);
      });
    });
    group.hidden = false;
    set(demo.getAttribute('data-mode') || 'bi', false);
  });

  /* ---------- Démo de la voix : fausse vidéo, 3 sous-titres ---------- */
  each('.vid', function (vid) {
    var cues = Array.prototype.map.call(vid.querySelectorAll('.cues li'), function (li) { return li.innerHTML; });
    var live = vid.querySelector('.cue');
    var big = vid.querySelector('.big');
    var ctl = vid.querySelector('.ctl');
    if (!cues.length || !live || !big || !ctl) return;
    var pp = ctl.querySelector('.pp');
    var bar = ctl.querySelector('.track i');
    var time = ctl.querySelector('.time');
    var STEP = parseInt(vid.getAttribute('data-step'), 10) || 3500;
    var TOTAL = STEP * cues.length;
    var pos = 0, last = 0, raf = 0, shown = -1, state = 'idle';

    function fmt(ms) {
      var s = Math.floor(ms / 1000);
      return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
    }
    function show(i) {
      if (i === shown) return;
      shown = i;
      live.innerHTML = i < 0 ? '' : cues[i];
      if (i >= 0) replay(live, 'in');
    }
    function paint() {
      // Animations réduites : la barre avance par secondes entières au lieu de glisser
      var p = reduce.matches ? Math.floor(pos / 1000) * 1000 : pos;
      bar.style.transform = 'scaleX(' + Math.min(1, p / TOTAL) + ')';
      time.textContent = fmt(pos) + ' / ' + fmt(TOTAL);
    }
    function label() {
      var text = state === 'playing' ? vid.getAttribute('data-pause')
        : state === 'ended' ? vid.getAttribute('data-replay') : vid.getAttribute('data-play');
      pp.setAttribute('aria-label', text);
      pp.title = text;
      vid.setAttribute('data-state', state);
      big.hidden = state === 'playing';
      big.querySelector('span').textContent = state === 'ended' ? vid.getAttribute('data-replay') : vid.getAttribute('data-play');
    }
    function tick(now) {
      pos = Math.min(TOTAL, pos + Math.max(0, now - last));
      last = now;
      show(Math.min(cues.length - 1, Math.floor(pos / STEP)));
      paint();
      if (pos >= TOTAL) { state = 'ended'; label(); return; }
      raf = requestAnimationFrame(tick);
    }
    function play() {
      if (state === 'ended') { pos = 0; show(-1); }
      state = 'playing';
      label();
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
    function pause() {
      cancelAnimationFrame(raf);
      state = 'paused';
      label();
    }
    function toggle() { if (state === 'playing') pause(); else play(); }

    pp.addEventListener('click', toggle);
    big.addEventListener('click', function () {
      play();
      pp.focus(); // le grand bouton disparaît pendant la lecture : le focus reste sur la commande
    });
    d.addEventListener('visibilitychange', function () { if (d.hidden && state === 'playing') pause(); });
    ctl.hidden = false;
    big.hidden = false;
    vid.classList.add('live');
    label();
    paint();
  });

  /* ---------- Boutons copier (chrome://extensions, about:debugging…) ---------- */
  var COPY = d.body.getAttribute('data-copy') || 'Copy';
  var COPIED = d.body.getAttribute('data-copied') || 'Copied';
  var status = d.createElement('span');
  status.className = 'sr';
  status.setAttribute('aria-live', 'polite');
  d.body.appendChild(status);
  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = d.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      d.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = d.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) resolve(); else reject(new Error('copie refusée'));
    });
  }
  function selectCode(code) {
    try {
      var r = d.createRange();
      r.selectNodeContents(code);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (e) { /* rien */ }
  }
  each('code.cp', function (code) {
    var text = code.textContent;
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'copy';
    b.setAttribute('aria-label', COPY + ' ' + text);
    b.title = COPY;
    b.innerHTML = ICON_COPY;
    var timer = 0;
    b.addEventListener('click', function () {
      copyText(text).then(function () {
        b.classList.add('ok');
        b.innerHTML = ICON_OK;
        b.title = COPIED;
        status.textContent = '';
        setTimeout(function () { status.textContent = COPIED + ' : ' + text; }, 30);
        clearTimeout(timer);
        timer = setTimeout(function () {
          b.classList.remove('ok');
          b.innerHTML = ICON_COPY;
          b.title = COPY;
        }, 1800);
      }, function () {
        selectCode(code); // presse-papiers refusé : le texte est sélectionné, prêt pour Ctrl+C
      });
    });
    // commande et bouton restent ensemble : passent à la ligne d'un bloc plutôt que d'être coupés
    var unit = d.createElement('span');
    unit.className = 'cmd';
    code.parentNode.insertBefore(unit, code);
    unit.appendChild(code);
    unit.appendChild(b);
  });

  /* ---------- Apparitions douces au défilement ---------- */
  if ('IntersectionObserver' in window && !reduce.matches) {
    var vh = window.innerHeight || root.clientHeight;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    each('section > h2, section > .sub, .grid > .card, .demo, .vid, .gallery > figure, .cols > .card, .faq > details',
      function (el) {
        var parent = el.parentElement;
        var idx = Array.prototype.indexOf.call(parent.children, el);
        el.classList.add('rv');
        // Ce qui est déjà visible au chargement ne clignote pas
        if (el.getBoundingClientRect().top < vh) { el.classList.add('in'); return; }
        if (/grid|gallery|cols/.test(parent.className)) el.style.transitionDelay = (idx % 3) * 70 + 'ms';
        io.observe(el);
      });
  }
})();
