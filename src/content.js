/*
 * DevDocTrad - content.js
 * Moteur de traduction dans la page : découpage en unités, marqueurs, application,
 * restauration exacte, badge d'état, contenu ajouté plus tard, navigation SPA.
 * Peut être injecté plusieurs fois : le moteur n'est créé qu'une seule fois.
 * Licence MIT.
 */
(function (root) {
  'use strict';
  var DDT = root.DDT;
  if (!DDT) return;
  if (root.DDT_createEngine && root.__DDT_ENGINE) return;

  var SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'PRE', 'CODE', 'KBD', 'SAMP', 'TT', 'VAR',
    'SVG', 'MATH', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED', 'INPUT', 'SELECT', 'TEMPLATE', 'AUDIO', 'VIDEO',
    'BUTTON-ICON']);
  var VOID_TAGS = new Set(['IMG', 'BR', 'WBR', 'INPUT', 'HR', 'SOURCE', 'TRACK', 'AREA', 'META', 'LINK']);
  var BLOCK_TAGS = new Set(['HTML', 'BODY', 'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI',
    'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER',
    'NAV', 'ASIDE', 'MAIN', 'BLOCKQUOTE', 'PRE', 'FIGURE', 'FIGCAPTION', 'DL', 'DT', 'DD', 'FORM', 'FIELDSET',
    'LEGEND', 'DETAILS', 'SUMMARY', 'HR', 'ADDRESS', 'DIALOG', 'MENU', 'CENTER', 'OPTION', 'OPTGROUP']);
  var ATTRS = ['title', 'alt', 'placeholder', 'aria-label'];
  var COMMENT_SELECTOR = '.token.comment, .hljs-comment, .pl-c, .highlight .c, .highlight .c1, .highlight .cm, ' +
    '.highlight .cs, .highlight .ch, .highlight .cp, .cm-comment';
  var COMMENT_RE = /^(\s*(?:\/\/+|#+|\/\*+|--|<!--|;+|%+)\s*)([\s\S]*?)(\s*(?:\*+\/|-->)?\s*)$/;

  function createEngine(doc, win, deps) {
    deps = deps || {};
    var transport = deps.transport;
    var settings = Object.assign({}, DDT.DEFAULT_SETTINGS, deps.settings || {});
    var t = deps.t || DDT.t;

    var built = new WeakSet();     // nœuds créés par l'extension
    var seen = new WeakSet();      // nœuds d'origine déjà pris dans une unité
    var styleCache = new WeakMap();
    var blockDescCache = new WeakMap();
    var units = [];
    var nextUnitId = 1;
    var state = 'idle';            // idle | running | done | stopped | paused | error
    var showing = 'original';      // original | translated
    var stopFlag = false;
    var sentChars = 0;
    var capLimit = settings.pageCap;
    var glossed = new Set();
    var failed = 0;
    var lastVia = null;
    var lastMessage = '';
    var options = {};
    var observer = null;
    var applying = false;
    var debounceTimer = null;
    var urlTimer = null;
    var lastUrl = win.location ? win.location.href : '';
    var savedHtmlState = null;
    var badge = null;
    var runPromise = null;
    var onUrlChange = deps.onUrlChange || null;

    /* ---------------- Classement des éléments ---------------- */
    function cs(el) {
      if (styleCache.has(el)) return styleCache.get(el);
      var d = '';
      try { d = win.getComputedStyle(el).display || ''; } catch (e) { d = ''; }
      styleCache.set(el, d);
      return d;
    }
    function isUi(el) {
      return el.hasAttribute && (el.hasAttribute('data-tr-ui') || el.hasAttribute('data-tr-bi'));
    }
    function isHidden(el) {
      if (el.hidden) return true;
      return cs(el) === 'none';
    }
    function isNoTranslate(el) {
      if (el.getAttribute('translate') === 'no') return true;
      if (el.classList && el.classList.contains('notranslate')) return true;
      return isUi(el);
    }
    function isSkipped(el) {
      if (SKIP_TAGS.has(el.tagName.toUpperCase())) return true;
      if (el.getAttribute('translate') === 'no') return true;
      if (el.classList && el.classList.contains('notranslate')) return true;
      var ce = el.getAttribute('contenteditable');
      if (ce !== null && ce !== 'false') return true;
      if (isUi(el)) return true;
      return false;
    }
    function isInlineEl(el) {
      var d = cs(el);
      if (d === '') return !BLOCK_TAGS.has(el.tagName.toUpperCase());
      return d === 'inline';
    }
    function hasBlockDescendant(el) {
      if (blockDescCache.has(el)) return blockDescCache.get(el);
      var res = false;
      var kids = el.children;
      for (var i = 0; i < kids.length && !res; i++) {
        var k = kids[i];
        if (isHidden(k) || isSkipped(k)) continue;
        if (!isInlineEl(k) || hasBlockDescendant(k)) res = true;
      }
      blockDescCache.set(el, res);
      return res;
    }
    function isAtom(el) {
      var tag = el.tagName.toUpperCase();
      if (VOID_TAGS.has(tag)) return true;
      if (isSkipped(el) || isHidden(el)) return true;
      if (el.shadowRoot) return true;
      if (!/\S/.test(el.textContent || '')) return true;
      return false;
    }

    /* ---------------- Découpage ---------------- */
    function collect(rootNode, out) {
      walk(rootNode, out);
      if (settings.translateComments) collectComments(rootNode, out);
      return out;
    }

    function walk(parent, out) {
      var run = [];
      var kids = parent.childNodes;
      for (var i = 0; i < kids.length; i++) {
        var n = kids[i];
        if (n.nodeType === 3 || n.nodeType === 8) { run.push(n); continue; }
        if (n.nodeType !== 1) continue;
        if (isUi(n)) { flush(parent, run, out); run = []; continue; }
        if (isHidden(n)) {
          if (isInlineEl(n)) run.push(n); else { flush(parent, run, out); run = []; }
          continue;
        }
        if (isInlineEl(n) && !hasBlockDescendant(n)) { run.push(n); continue; }
        flush(parent, run, out);
        run = [];
        if (!isSkipped(n)) {
          walk(n, out);
          if (n.shadowRoot && n.shadowRoot.mode !== 'closed') walk(n.shadowRoot, out);
        }
        if (!isNoTranslate(n)) collectAttrs(n, out);
      }
      flush(parent, run, out);
    }

    function flush(parent, run, out) {
      if (!run.length) return;
      var hasText = false;
      for (var i = 0; i < run.length; i++) {
        var n = run[i];
        if (built.has(n) || seen.has(n)) return;     // déjà traité
        if (n.nodeType === 3 && /\S/.test(n.data)) hasText = true;
        else if (n.nodeType === 1) hasText = hasText || /\S/.test(n.textContent || '');
      }
      // attributs des éléments inline de la séquence
      for (i = 0; i < run.length; i++) if (run[i].nodeType === 1) collectAttrsDeep(run[i], out);
      if (!hasText) return;
      var ctx = { next: 1, map: {} };
      var src = serialize(run, ctx).replace(/ {2,}/g, ' ').trim();
      var plain = DDT.plainText(src.replace(/\{\d+\|[^{}]*\}/g, ' '));
      if (DDT.letterCount(plain) < 2) return;
      if (DDT.looksLikeCodeOnly(plain) && !/<\d+>/.test(src)) return;
      var first = run[0];
      var last = run[run.length - 1];
      var lead = first.nodeType === 3 ? (first.data.match(/^\s+/) || [''])[0] : '';
      var trail = last.nodeType === 3 ? (last.data.match(/\s+$/) || [''])[0] : '';
      if (run.length === 1 && first.nodeType === 3 && !/\S/.test(first.data)) return;
      for (i = 0; i < run.length; i++) seen.add(run[i]);
      out.push({
        uid: nextUnitId++, kind: 'run', parent: parent, nodes: run.slice(), src: src, map: ctx.map,
        lead: lead, trail: trail, out: null, applied: null, saved: null, builtTop: null, anchor: null, bi: null
      });
    }

    function serialize(nodes, ctx) {
      var s = '';
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.nodeType === 3) { s += DDT.escapeText(n.data.replace(/\s+/g, ' ')); continue; }
        if (n.nodeType !== 1) continue;
        var id = ctx.next++;
        if (isAtom(n)) {
          ctx.map[id] = { type: 'atom', el: n };
          var info = (n.tagName.toUpperCase() === 'IMG' ? (n.getAttribute('alt') || '') : (n.textContent || ''))
            .replace(/\s+/g, ' ').trim();
          if (info.length > 80) info = info.slice(0, 79) + '…';
          s += '{' + id + '|' + DDT.escapeText(info).replace(/\|/g, '/') + '}';
        } else {
          ctx.map[id] = { type: 'wrap', el: n };
          s += '<' + id + '>' + serialize(n.childNodes, ctx) + '</' + id + '>';
        }
      }
      return s;
    }

    function collectAttrs(el, out) {
      for (var i = 0; i < ATTRS.length; i++) {
        var a = ATTRS[i];
        if (!el.hasAttribute(a)) continue;
        var v = el.getAttribute(a);
        if (!v || DDT.letterCount(v) < 2 || DDT.looksLikeCodeOnly(v)) continue;
        var key = 'attr:' + a;
        if (el.__ddtAttrs && el.__ddtAttrs[key]) continue;
        el.__ddtAttrs = el.__ddtAttrs || {};
        el.__ddtAttrs[key] = true;
        out.push({ uid: nextUnitId++, kind: 'attr', el: el, attr: a, orig: v, src: DDT.escapeText(v.replace(/\s+/g, ' ').trim()), out: null, applied: null });
      }
    }
    function collectAttrsDeep(el, out) {
      collectAttrs(el, out);
      if (isNoTranslate(el)) return;
      var all = el.querySelectorAll('[title],[alt],[placeholder],[aria-label]');
      for (var i = 0; i < all.length; i++) {
        if (all[i].closest('[translate=no],.notranslate')) continue;
        collectAttrs(all[i], out);
      }
    }

    function collectTitle(out) {
      var title = doc.title;
      if (!title || DDT.letterCount(title) < 2) return;
      if (units.some(function (u) { return u.kind === 'title'; })) return;
      out.push({ uid: nextUnitId++, kind: 'title', orig: title, src: DDT.escapeText(title.replace(/\s+/g, ' ').trim()), out: null, applied: null });
    }

    function collectComments(rootNode, out) {
      var pres = rootNode.querySelectorAll ? rootNode.querySelectorAll('pre') : [];
      for (var i = 0; i < pres.length; i++) {
        var els = pres[i].querySelectorAll(COMMENT_SELECTOR);
        for (var j = 0; j < els.length; j++) {
          var el = els[j];
          if (seen.has(el)) continue;
          var p = el.parentElement;
          if (p && p.closest && p.closest(COMMENT_SELECTOR) && pres[i].contains(p.closest(COMMENT_SELECTOR))) continue;
          var text = el.textContent || '';
          if (text.indexOf('\n') !== -1) continue;
          var m = text.match(COMMENT_RE);
          if (!m || !m[1].trim()) continue;
          var body = m[2];
          if (DDT.letterCount(body) < 2 || DDT.commentLooksLikeCode(body)) continue;
          seen.add(el);
          out.push({ uid: nextUnitId++, kind: 'comment', el: el, prefix: m[1], suffix: m[3], src: DDT.escapeText(body), out: null, applied: null, saved: null });
        }
      }
    }

    /* ---------------- Construction et application ---------------- */
    function buildNodes(unit, outStr, clone) {
      var tokens = DDT.tokenize(outStr);
      var top = [];
      var stack = [];
      function append(node) {
        if (stack.length) stack[stack.length - 1].appendChild(node);
        else top.push(node);
      }
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i];
        if (tk.t === 'text') {
          var tn = doc.createTextNode(DDT.unescapeText(tk.v));
          built.add(tn);
          append(tn);
        } else if (tk.t === 'atom') {
          var a = unit.map[tk.id].el;
          if (clone) {
            a = a.cloneNode(true);
            stripIds(a);
          }
          append(a);
        } else if (tk.t === 'open') {
          var w = unit.map[tk.id].el;
          if (clone) {
            w = w.cloneNode(false);
            if (w.removeAttribute) w.removeAttribute('id');
            built.add(w);
          }
          append(w);
          stack.push(w);
        } else if (tk.t === 'close') {
          stack.pop();
        }
      }
      return top;
    }
    function stripIds(el) {
      if (el.nodeType !== 1) return;
      el.removeAttribute('id');
      var all = el.querySelectorAll('[id]');
      for (var i = 0; i < all.length; i++) all[i].removeAttribute('id');
    }

    function stillInPlace(unit) {
      if (unit.kind === 'run') {
        for (var i = 0; i < unit.nodes.length; i++) {
          if (unit.nodes[i].parentNode !== unit.parent || !unit.nodes[i].isConnected) return false;
        }
        return true;
      }
      if (unit.kind === 'attr' || unit.kind === 'comment') return unit.el.isConnected;
      return true;
    }

    function applyUnit(unit) {
      if (!unit.out || unit.applied) return false;
      if (unit.kind === 'title') { doc.title = DDT.unescapeText(unit.out); unit.applied = 'replace'; return true; }
      if (unit.kind === 'attr') {
        if (settings.mode !== 'replace') return false;
        if (!stillInPlace(unit)) return false;
        unit.el.setAttribute(unit.attr, DDT.unescapeText(unit.out));
        unit.applied = 'replace';
        return true;
      }
      if (unit.kind === 'comment') {
        if (!stillInPlace(unit)) return false;
        unit.saved = Array.prototype.slice.call(unit.el.childNodes);
        while (unit.el.firstChild) unit.el.removeChild(unit.el.firstChild);
        var tn = doc.createTextNode(unit.prefix + DDT.unescapeText(unit.out) + unit.suffix);
        built.add(tn);
        unit.el.appendChild(tn);
        unit.applied = 'replace';
        return true;
      }
      if (!stillInPlace(unit)) return false;
      var parent = unit.parent;
      var last = unit.nodes[unit.nodes.length - 1];
      if (settings.mode === 'bilingual') {
        var span = doc.createElement('span');
        span.setAttribute('data-tr-bi', '');
        span.setAttribute('translate', 'no');
        span.setAttribute('style', 'display:block;margin:.2em 0 .6em;padding-left:.6em;' +
          'border-left:2px solid rgba(10,132,255,.55);opacity:.92;');
        var nodes = buildNodes(unit, unit.out, true);
        for (var i = 0; i < nodes.length; i++) span.appendChild(nodes[i]);
        built.add(span);
        parent.insertBefore(span, last.nextSibling);
        unit.bi = span;
        unit.applied = 'bilingual';
        return true;
      }
      // mode remplacer
      var anchor = doc.createComment('ddt');
      built.add(anchor);
      parent.insertBefore(anchor, unit.nodes[0]);
      unit.anchor = anchor;
      unit.saved = [];
      var id;
      for (id in unit.map) {
        if (unit.map[id].type === 'wrap') {
          unit.saved.push({ el: unit.map[id].el, kids: Array.prototype.slice.call(unit.map[id].el.childNodes) });
        }
      }
      for (i = 0; i < unit.nodes.length; i++) {
        if (unit.nodes[i].parentNode === parent) parent.removeChild(unit.nodes[i]);
      }
      for (i = 0; i < unit.saved.length; i++) {
        var w = unit.saved[i].el;
        while (w.firstChild) w.removeChild(w.firstChild);
      }
      var top = buildNodes(unit, unit.out, false);
      if (unit.lead) { var l = doc.createTextNode(unit.lead); built.add(l); top.unshift(l); }
      if (unit.trail) { var tr = doc.createTextNode(unit.trail); built.add(tr); top.push(tr); }
      var ref = anchor.nextSibling;
      for (i = 0; i < top.length; i++) parent.insertBefore(top[i], ref);
      unit.builtTop = top;
      unit.applied = 'replace';
      return true;
    }

    function restoreUnit(unit) {
      if (!unit.applied) return;
      if (unit.kind === 'title') { doc.title = unit.orig; unit.applied = null; return; }
      if (unit.kind === 'attr') { unit.el.setAttribute(unit.attr, unit.orig); unit.applied = null; return; }
      if (unit.kind === 'comment') {
        while (unit.el.firstChild) unit.el.removeChild(unit.el.firstChild);
        for (var c = 0; c < unit.saved.length; c++) unit.el.appendChild(unit.saved[c]);
        unit.saved = null;
        unit.applied = null;
        return;
      }
      if (unit.applied === 'bilingual') {
        if (unit.bi && unit.bi.parentNode) unit.bi.parentNode.removeChild(unit.bi);
        unit.bi = null;
        unit.applied = null;
        return;
      }
      var parent = unit.parent;
      var i;
      for (i = 0; i < unit.builtTop.length; i++) {
        var n = unit.builtTop[i];
        if (n.parentNode) n.parentNode.removeChild(n);
      }
      for (i = 0; i < unit.saved.length; i++) {
        var w = unit.saved[i].el;
        while (w.firstChild) w.removeChild(w.firstChild);
      }
      for (i = 0; i < unit.saved.length; i++) {
        var s = unit.saved[i];
        for (var k = 0; k < s.kids.length; k++) s.el.appendChild(s.kids[k]);
      }
      if (unit.anchor && unit.anchor.parentNode === parent) {
        for (i = 0; i < unit.nodes.length; i++) parent.insertBefore(unit.nodes[i], unit.anchor);
        parent.removeChild(unit.anchor);
      }
      unit.anchor = null;
      unit.builtTop = null;
      unit.saved = null;
      unit.applied = null;
    }

    /* ---------------- Page : marques anti-traduction du navigateur ---------------- */
    function markPage() {
      if (savedHtmlState) return;
      var html = doc.documentElement;
      savedHtmlState = {
        translate: html.getAttribute('translate'),
        lang: html.getAttribute('lang'),
        meta: null
      };
      html.setAttribute('translate', 'no');
      html.setAttribute('lang', DDT.resolveTarget(settings.target));
      if (doc.head) {
        var meta = doc.createElement('meta');
        meta.setAttribute('name', 'google');
        meta.setAttribute('content', 'notranslate');
        meta.setAttribute('data-tr-ui', '');
        doc.head.appendChild(meta);
        savedHtmlState.meta = meta;
      }
    }
    function unmarkPage() {
      if (!savedHtmlState) return;
      var html = doc.documentElement;
      if (savedHtmlState.translate === null) html.removeAttribute('translate');
      else html.setAttribute('translate', savedHtmlState.translate);
      if (savedHtmlState.lang === null) html.removeAttribute('lang');
      else html.setAttribute('lang', savedHtmlState.lang);
      if (savedHtmlState.meta && savedHtmlState.meta.parentNode) savedHtmlState.meta.parentNode.removeChild(savedHtmlState.meta);
      savedHtmlState = null;
    }

    /* ---------------- Ordre : visible d'abord ---------------- */
    function unitRect(u) {
      var el = null;
      if (u.kind === 'run') {
        for (var i = 0; i < u.nodes.length; i++) if (u.nodes[i].nodeType === 1) { el = u.nodes[i]; break; }
        if (!el) el = u.parent.nodeType === 1 ? u.parent : (u.parent.host || null);
      } else if (u.kind === 'attr' || u.kind === 'comment') el = u.el;
      if (!el || !el.getBoundingClientRect) return null;
      try { return el.getBoundingClientRect(); } catch (e) { return null; }
    }
    function orderUnits(list) {
      var h = win.innerHeight || 800;
      var vis = [];
      var rest = [];
      list.forEach(function (u) {
        if (u.kind === 'title') { vis.unshift(u); return; }
        var r = unitRect(u);
        if (r && r.bottom >= -h && r.top <= h * 2) vis.push(u); else rest.push(u);
      });
      return vis.concat(rest);
    }

    /* ---------------- Boucle de traduction ---------------- */
    function pendingUnits() {
      return units.filter(function (u) { return !u.out && !u.failed && !u.gone; });
    }

    function makeBatches(list) {
      var max = settings.batchChars || 6000;
      var batches = [];
      var cur = [];
      var size = 0;
      list.forEach(function (u) {
        var len = u.src.length;
        if (cur.length && (size + len > max || cur.length >= 60)) { batches.push(cur); cur = []; size = 0; }
        cur.push(u);
        size += len;
      });
      if (cur.length) batches.push(cur);
      return batches;
    }

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function translateBatch(batch) {
      var texts = batch.map(function (u) { return u.src; });
      return transport.translate(texts, {
        keyId: options.keyId || null,
        sensitive: !!options.sensitive,
        alreadyGlossed: Array.from(glossed),
        host: win.location ? win.location.hostname : ''
      });
    }

    function handleResult(batch, res) {
      if (res && res.glossed) res.glossed.forEach(function (g) { glossed.add(g); });
      if (res && res.via) lastVia = res.via;
      var tr = (res && res.translations) || [];
      withObserverOff(function () {
        batch.forEach(function (u, i) {
          var v = tr[i];
          if (typeof v === 'string') {
            u.out = v;
            if (u.glossed) u.glossed.forEach(function (g) { glossed.add(g); });
            if (showing === 'translated' && !applyUnit(u)) {
              if (!stillInPlace(u)) u.gone = true;
            }
          } else if (v === null && !(res && res.error)) {
            u.failed = true;
            failed++;
          }
        });
      });
    }

    function run() {
      if (runPromise) return runPromise;
      runPromise = (async function () {
        state = 'running';
        stopFlag = false;
        updateBadge();
        var rateTries = 0;
        while (!stopFlag) {
          var todo = orderUnits(pendingUnits());
          if (!todo.length) break;
          var batches = makeBatches(todo);
          var batch = batches[0];
          var chars = batch.reduce(function (a, u) { return a + u.src.length; }, 0);
          if (sentChars + chars > capLimit && sentChars > 0) {
            state = 'paused';
            lastMessage = t('badgeCap', [capLimit.toLocaleString()]);
            updateBadge();
            runPromise = null;
            return;
          }
          var res;
          try {
            res = await translateBatch(batch);
          } catch (e) {
            res = { error: 'error', message: String(e && e.message || e) };
          }
          if (res && res.error === 'disconnected') {
            res = await translateBatch(batch).catch(function (e) { return { error: 'error', message: String(e) }; });
          }
          sentChars += chars;
          handleResult(batch, res || {});
          if (res && res.error) {
            if (res.error === 'rate_limited') {
              rateTries++;
              if (rateTries > 3) {
                state = 'error';
                lastMessage = t('badgeRateGiveUp');
                break;
              }
              var waitS = Math.max(1, Math.ceil((res.waitMs || 60000) / 1000));
              for (var s = waitS; s > 0 && !stopFlag; s--) {
                lastMessage = t('badgeRateLimited', [s, rateTries]);
                updateBadge();
                await sleep(1000);
              }
              lastMessage = '';
              continue;
            }
            state = 'error';
            lastMessage = res.error === 'no_key' ? t('badgeNoKey') : t('badgeError', [res.message || res.error]);
            break;
          }
          rateTries = 0;
          if (res && res.notice) lastMessage = res.notice;
          updateBadge();
        }
        if (state === 'running') state = stopFlag ? 'stopped' : 'done';
        updateBadge();
        runPromise = null;
      })();
      return runPromise;
    }

    function withObserverOff(fn) {
      applying = true;
      if (observer) observer.disconnect();
      try { fn(); } finally {
        if (observer) observer.takeRecords && observer.takeRecords();
        applying = false;
        if (observer && showing === 'translated') observeStart();
      }
    }

    function scan() {
      var found = [];
      if (doc.body) collect(doc.body, found);
      collectTitle(found);
      units = units.concat(found);
      return found;
    }

    /* ---------------- Commandes publiques ---------------- */
    function start(opts) {
      options = Object.assign({}, options, opts || {});
      if (opts && opts.settings) settings = Object.assign(settings, opts.settings);
      capLimit = Math.max(capLimit, settings.pageCap);
      ensureBadge();
      markPage();
      showing = 'translated';
      withObserverOff(function () {
        units.forEach(function (u) { if (u.out && !u.applied) applyUnit(u); });
      });
      scan();
      if (!units.length) {
        state = 'done';
        lastMessage = t('badgeNothing');
        updateBadge();
        return Promise.resolve();
      }
      observeStart();
      watchUrl();
      return run();
    }

    function showOriginal() {
      withObserverOff(function () {
        for (var i = units.length - 1; i >= 0; i--) restoreUnit(units[i]);
      });
      unmarkPage();
      showing = 'original';
      observeStop();
      updateBadge();
    }

    function showTranslation() {
      markPage();
      showing = 'translated';
      withObserverOff(function () {
        units.forEach(function (u) { if (u.out && !u.applied) applyUnit(u); });
      });
      observeStart();
      updateBadge();
      if (pendingUnits().length && state !== 'running') return run();
      return Promise.resolve();
    }

    function toggle(opts) {
      if (showing === 'translated') { showOriginal(); return Promise.resolve(); }
      if (units.some(function (u) { return u.out; })) return showTranslation();
      return start(opts);
    }

    function stop() {
      stopFlag = true;
      if (state === 'running') state = 'stopped';
      updateBadge();
    }

    function continueAfterCap() {
      capLimit += settings.pageCap;
      state = 'running';
      return run();
    }

    function status() {
      var done = units.filter(function (u) { return u.out; }).length;
      return {
        state: state, showing: showing, done: done, total: units.length, failed: failed,
        message: lastMessage, via: lastVia
      };
    }

    /* ---------------- Contenu ajouté plus tard et SPA ---------------- */
    function observeStart() {
      if (!doc.body || typeof win.MutationObserver === 'undefined') return;
      if (!observer) {
        observer = new win.MutationObserver(function (records) {
          if (applying) return;
          var relevant = records.some(function (r) {
            for (var i = 0; i < r.addedNodes.length; i++) {
              var n = r.addedNodes[i];
              if (built.has(n)) continue;
              if (n.nodeType === 1 && isUi(n)) continue;
              return true;
            }
            return false;
          });
          if (relevant) onDomChange();
        });
      }
      observer.observe(doc.body, { childList: true, subtree: true });
    }
    function observeStop() {
      if (observer) observer.disconnect();
    }
    function onDomChange() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        checkUrl();
        if (showing !== 'translated') return;
        units.forEach(function (u) { if (!u.applied && !u.gone && u.kind === 'run' && !stillInPlace(u)) u.gone = true; });
        var found = scan();
        if (found.length && state !== 'running') run();
      }, 800);
    }
    function checkUrl() {
      var href = win.location ? win.location.href : '';
      if (href !== lastUrl) {
        lastUrl = href;
        glossed = new Set();
        units = units.filter(function (u) { return u.applied || (u.kind === 'run' ? stillInPlace(u) : true); });
        if (onUrlChange) onUrlChange(href);
        if (showing === 'translated') {
          var found = scan();
          if (found.length && state !== 'running') run();
        }
      }
    }
    function watchUrl() {
      if (urlTimer || !win.setInterval) return;
      urlTimer = win.setInterval(function () { if (showing === 'translated') checkUrl(); }, 1000);
      try { win.addEventListener('popstate', function () { setTimeout(checkUrl, 50); }); } catch (e) { /* rien */ }
    }

    /* ---------------- Badge (verre dépoli, shadow DOM) ---------------- */
    var BADGE_CSS = [
      ':host{all:initial}',
      '.b{position:fixed;right:18px;bottom:18px;z-index:2147483647;font:13px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;',
      'color:#1d1d1f;background:rgba(255,255,255,.62);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);',
      'border:1px solid rgba(255,255,255,.55);border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.18),0 1px 0 rgba(255,255,255,.6) inset;',
      'padding:12px 14px;min-width:240px;max-width:340px;transition:opacity .2s,transform .2s}',
      '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.b{background:rgba(250,250,252,.96)}}',
      '.top{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
      '.logo{width:18px;height:18px;border-radius:6px;background:linear-gradient(135deg,#0a84ff,#5e5ce6);flex:none}',
      '.name{font-weight:600;flex:1;letter-spacing:-.01em}',
      '.ic{border:0;background:rgba(120,120,128,.16);color:inherit;width:22px;height:22px;border-radius:11px;cursor:pointer;font:inherit;line-height:22px;padding:0}',
      '.ic:hover{background:rgba(120,120,128,.28)}',
      '.msg{color:#3a3a3c;margin:2px 0 8px;min-height:1em}',
      '.bar{height:6px;border-radius:3px;background:rgba(120,120,128,.2);overflow:hidden;margin-bottom:10px}',
      '.fill{height:100%;width:0;border-radius:3px;background:linear-gradient(90deg,#0a84ff,#5e5ce6);transition:width .25s}',
      '.btns{display:flex;gap:6px;flex-wrap:wrap}',
      '.btn{border:0;border-radius:999px;padding:6px 12px;font:inherit;font-weight:500;cursor:pointer;background:rgba(120,120,128,.16);color:inherit}',
      '.btn:hover{background:rgba(120,120,128,.26)}',
      '.btn.p{background:#0a84ff;color:#fff}.btn.p:hover{background:#0071e3}',
      '.btn:focus-visible,.ic:focus-visible{outline:2px solid #0a84ff;outline-offset:2px}',
      '.min .msg,.min .bar,.min .btns{display:none}.min{min-width:0;padding:8px 12px}.min .top{margin:0}',
      '.hide{display:none}',
      '@media (prefers-color-scheme:dark){.b{color:#f5f5f7;background:rgba(36,36,38,.62);border-color:rgba(255,255,255,.12)}.msg{color:#d1d1d6}}',
      '@media (prefers-reduced-motion:reduce){.b,.fill{transition:none}}'
    ].join('');

    function ensureBadge() {
      if (badge || deps.noBadge) return;
      var host = doc.createElement('div');
      host.setAttribute('data-tr-ui', '');
      host.setAttribute('translate', 'no');
      var sr = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
      var style = doc.createElement('style');
      style.textContent = BADGE_CSS;
      sr.appendChild(style);
      var box = doc.createElement('div');
      box.className = 'b';
      box.setAttribute('role', 'status');
      box.innerHTML = '<div class="top"><span class="logo"></span><span class="name">DevDocTrad</span>' +
        '<button class="ic" data-a="min"></button><button class="ic" data-a="close">×</button></div>' +
        '<div class="msg" aria-live="polite"></div><div class="bar"><div class="fill"></div></div>' +
        '<div class="btns"><button class="btn" data-a="stop"></button><button class="btn p" data-a="toggle"></button>' +
        '<button class="btn hide" data-a="continue"></button></div>';
      sr.appendChild(box);
      box.querySelector('[data-a=min]').textContent = '–';
      box.querySelector('[data-a=min]').setAttribute('aria-label', t('btnMinimize'));
      box.querySelector('[data-a=close]').setAttribute('aria-label', t('btnClose'));
      box.querySelector('[data-a=stop]').textContent = t('btnStop');
      box.querySelector('[data-a=continue]').textContent = t('btnContinue');
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('[data-a]');
        if (!b) return;
        var a = b.getAttribute('data-a');
        if (a === 'min') box.classList.toggle('min');
        else if (a === 'close') host.style.display = 'none';
        else if (a === 'stop') stop();
        else if (a === 'toggle') toggle();
        else if (a === 'continue') continueAfterCap();
      });
      (doc.body || doc.documentElement).appendChild(host);
      badge = { host: host, box: box };
      built.add(host);
    }

    function updateBadge() {
      if (!badge) return;
      var st = status();
      badge.host.style.display = '';
      var msg = st.message;
      if (!msg) {
        if (st.state === 'running') msg = t('badgeTranslating', [st.done, st.total]);
        else if (st.state === 'stopped') msg = t('badgeStopped');
        else if (st.state === 'done') {
          msg = st.failed ? t('badgeDoneFailed', [st.done, st.failed]) : t('badgeDone', [st.done]);
          if (st.via) msg += ' · ' + (st.via.local ? t('badgeViaLocal') : t('badgeViaOnline', [st.via.label]));
        }
      }
      badge.box.querySelector('.msg').textContent = msg || '';
      var pct = st.total ? Math.round((st.done + st.failed) / st.total * 100) : 0;
      badge.box.querySelector('.fill').style.width = pct + '%';
      badge.box.querySelector('[data-a=stop]').classList.toggle('hide', st.state !== 'running');
      badge.box.querySelector('[data-a=continue]').classList.toggle('hide', st.state !== 'paused');
      badge.box.querySelector('[data-a=toggle]').textContent = st.showing === 'translated' ? t('btnOriginal') : t('btnTranslation');
    }

    /* ---------------- Infos de page (pour l'automatique) ---------------- */
    function pageInfo(extraSensitive) {
      var host = win.location ? win.location.hostname : '';
      var sensitive = !!doc.querySelector('input[type=password]') || DDT.isSensitiveHost(host, extraSensitive);
      var lang = (doc.documentElement.getAttribute('lang') || '').toLowerCase();
      var sample = '';
      if (doc.body) sample = (doc.body.innerText || doc.body.textContent || '').replace(/\s+/g, ' ').slice(0, 2000);
      return { host: host, sensitive: sensitive, lang: lang, sample: sample };
    }

    return {
      start: start, stop: stop, toggle: toggle, showOriginal: showOriginal, showTranslation: showTranslation,
      continueAfterCap: continueAfterCap, status: status, pageInfo: pageInfo, scan: scan,
      _units: function () { return units; }, _checkUrl: checkUrl, _built: built,
      setOnUrlChange: function (fn) { onUrlChange = fn; },
      setSettings: function (s) { settings = Object.assign(settings, s || {}); capLimit = Math.max(capLimit, settings.pageCap); }
    };
  }

  root.DDT_createEngine = createEngine;

  /* ---------------- Mise en route dans l'extension ---------------- */
  var api = DDT.api;
  if (!api || !api.runtime || !api.runtime.id || root.__DDT_TEST) return;

  function makeTransport() {
    var port = null;
    var seq = 0;
    var pending = {};
    function ensure() {
      if (port) return port;
      port = api.runtime.connect({ name: 'ddt' });
      port.onMessage.addListener(function (m) {
        var cb = pending[m.id];
        if (cb) { delete pending[m.id]; cb(m); }
      });
      port.onDisconnect.addListener(function () {
        port = null;
        var p = pending;
        pending = {};
        Object.keys(p).forEach(function (id) { p[id]({ error: 'disconnected' }); });
      });
      return port;
    }
    return {
      translate: function (texts, opts) {
        return new Promise(function (resolve) {
          var id = ++seq;
          pending[id] = resolve;
          try { ensure().postMessage({ type: 'translate', id: id, texts: texts, opts: opts }); } catch (e) {
            delete pending[id];
            port = null;
            resolve({ error: 'disconnected' });
          }
        });
      }
    };
  }

  function loadSettings() {
    return api.storage.local.get('settings').then(function (r) {
      return Object.assign({}, DDT.DEFAULT_SETTINGS, (r && r.settings) || {});
    }).catch(function () { return Object.assign({}, DDT.DEFAULT_SETTINGS); });
  }

  var engine = createEngine(document, window, { transport: makeTransport() });
  root.__DDT_ENGINE = engine;

  function withSettings(fn) {
    return loadSettings().then(function (s) { engine.setSettings(s); return fn(s); });
  }

  api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.to !== 'content') return;
    var p;
    if (msg.cmd === 'translate') {
      p = withSettings(function (s) {
        var info = engine.pageInfo(s.sensitiveExtra);
        engine.start({ keyId: msg.keyId || null, sensitive: info.sensitive });
      });
    } else if (msg.cmd === 'toggle') {
      p = withSettings(function (s) {
        var info = engine.pageInfo(s.sensitiveExtra);
        engine.toggle({ keyId: msg.keyId || null, sensitive: info.sensitive });
      });
    } else if (msg.cmd === 'original') { engine.showOriginal(); p = Promise.resolve(); }
    else if (msg.cmd === 'stop') { engine.stop(); p = Promise.resolve(); }
    else if (msg.cmd === 'pageInfo') {
      p = loadSettings().then(function (s) { return engine.pageInfo(s.sensitiveExtra); });
    } else p = Promise.resolve();
    p.then(function (extra) {
      sendResponse(Object.assign({ ok: true }, engine.status(), extra && typeof extra === 'object' ? { info: extra } : {}));
    }).catch(function (e) { sendResponse({ ok: false, error: String(e) }); });
    return true;
  });
})(typeof window !== 'undefined' ? window : globalThis);
