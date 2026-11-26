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
  // Éléments qu'on ne doit ni dupliquer (bilingue) ni déplacer (remplacer) : une copie recharge une vidéo
  // ou une iframe, un déplacement perd la saisie d'un champ. Une séquence en ligne est coupée sur eux.
  var HEAVY_TAGS = new Set(['IFRAME', 'VIDEO', 'AUDIO', 'INPUT', 'SELECT', 'TEXTAREA', 'OBJECT', 'EMBED', 'CANVAS']);
  var HEAVY_SEL = 'iframe, video, audio, input, select, textarea, object, embed, canvas';
  var ATTRS = ['title', 'alt', 'placeholder', 'aria-label'];
  var REVEAL_ATTRS = ['class', 'style', 'hidden', 'open', 'aria-hidden', 'aria-expanded'];
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
    var capExtra = 0;              // ajouté par le bouton « Continuer »
    function capLimit() { return (Number(settings.pageCap) || DDT.DEFAULT_SETTINGS.pageCap) + capExtra; }
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
    var gen = 0;                   // change avec la langue cible : un lot d'une ancienne langue est ignoré
    var closed = false;            // badge fermé par l'utilisateur (rouvert seulement par start/toggle)
    var announced = null;          // dernier état annoncé aux lecteurs d'écran

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
    function hasHeavy(el) {
      if (HEAVY_TAGS.has(el.tagName.toUpperCase())) return true;
      return !!(el.querySelector && el.querySelector(HEAVY_SEL));
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
        // Les commentaires HTML (ancres de Vue « <!--v-if--> », marqueurs de React) ne font pas partie
        // des séquences : on n'y touche jamais, ils restent là où le framework les attend.
        if (n.nodeType === 8) continue;
        if (n.nodeType === 3) { run.push(n); continue; }
        if (n.nodeType !== 1) continue;
        if (isUi(n)) { flush(parent, run, out); run = []; continue; }
        if (isHidden(n)) {
          if (isInlineEl(n) && !hasHeavy(n)) run.push(n); else { flush(parent, run, out); run = []; }
          continue;
        }
        if (isInlineEl(n) && !hasBlockDescendant(n) && !hasHeavy(n)) { run.push(n); continue; }
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

    /* Une séquence peut contenir des nœuds déjà traités (texte ajouté à côté d'un passage traduit) :
     * on la coupe sur ces nœuds au lieu de l'abandonner, sinon le nouveau texte n'est jamais traduit. */
    function flush(parent, run, out) {
      var part = [];
      for (var i = 0; i < run.length; i++) {
        var n = run[i];
        if (built.has(n) || seen.has(n)) { flushPart(parent, part, out); part = []; continue; }
        part.push(n);
      }
      flushPart(parent, part, out);
    }

    /* Tous les nœuds texte d'une séquence (y compris dans les éléments) avec leur contenu au moment
     * de la collecte : sert à voir si la page a changé le texte pendant qu'un lot était en cours. */
    function textsOf(nodes, acc) {
      acc = acc || [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.nodeType === 3) acc.push({ node: n, data: n.data });
        else if (n.nodeType === 1) textsOf(n.childNodes, acc);
      }
      return acc;
    }

    function flushPart(parent, run, out) {
      if (!run.length) return;
      var hasText = false;
      for (var i = 0; i < run.length; i++) {
        var n = run[i];
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
      // les éléments internes aussi : si une traduction en remonte un d'un niveau, il ne doit pas
      // être repris comme du texte nouveau
      for (var id in ctx.map) seen.add(ctx.map[id].el);
      out.push({
        uid: nextUnitId++, kind: 'run', parent: parent, nodes: run.slice(), src: src, map: ctx.map,
        lead: lead, trail: trail, texts: textsOf(run), out: null, applied: null, recs: null, added: null,
        containers: null, span: null, moved: false, bi: null
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
        // <html translate="no"> est posé par markPage (avant scan) : il ne compte pas ici
        var nt = all[i].closest('[translate=no],.notranslate');
        if (nt && nt !== doc.documentElement) continue;
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
        // texte changé par la page pendant qu'un lot était en cours : l'ancienne traduction ne doit
        // pas écraser le nouveau texte
        var tx = unit.texts || [];
        for (i = 0; i < tx.length; i++) if (tx[i].node.data !== tx[i].data) return false;
        return true;
      }
      if (unit.kind === 'attr' || unit.kind === 'comment') return unit.el.isConnected;
      return true;
    }

    /* L'unité est-elle encore dans la page (pour l'oublier après une navigation SPA) ? */
    function unitConnected(unit) {
      if (unit.kind === 'run') {
        if (!unit.parent.isConnected) return false;
        for (var i = 0; i < unit.nodes.length; i++) if (unit.nodes[i].isConnected) return true;
        return false;
      }
      if (unit.kind === 'attr' || unit.kind === 'comment') return unit.el.isConnected;
      return true;
    }

    function titleIs(v) {
      return String(doc.title).replace(/\s+/g, ' ').trim() === String(v).replace(/\s+/g, ' ').trim();
    }

    /* Le texte de la traduction en arbre : [{ text }, { id, kids: null (atome) | [...] (élément) }] */
    function tokenTree(outStr) {
      var tokens = DDT.tokenize(outStr);
      var rootList = [];
      var stack = [rootList];
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i];
        var cur = stack[stack.length - 1];
        if (tk.t === 'text') cur.push({ text: DDT.unescapeText(tk.v) });
        else if (tk.t === 'atom') cur.push({ id: tk.id, kids: null });
        else if (tk.t === 'open') { var it = { id: tk.id, kids: [] }; cur.push(it); stack.push(it.kids); }
        else if (tk.t === 'close' && stack.length > 1) stack.pop();
      }
      return rootList;
    }

    /* Liste traduite -> éléments et textes entre eux (gaps[k] = texte avant l'élément k). */
    function splitItems(list) {
      var els = [];
      var gaps = [''];
      for (var i = 0; i < list.length; i++) {
        if ('text' in list[i]) gaps[gaps.length - 1] += list[i].text;
        else { els.push(list[i]); gaps.push(''); }
      }
      return { els: els, gaps: gaps };
    }
    /* Nœuds d'origine d'un conteneur -> éléments et nœuds texte entre eux (commentaires ignorés). */
    function splitNodes(nodes) {
      var els = [];
      var gaps = [[]];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.nodeType === 3) gaps[gaps.length - 1].push(n);
        else if (n.nodeType === 1) { els.push(n); gaps.push([]); }
      }
      return { els: els, gaps: gaps };
    }

    function newText(ctx, data) {
      var tn = doc.createTextNode(data);
      built.add(tn);
      ctx.added.push(tn);
      return tn;
    }

    /*
     * Remplit un conteneur (le parent de la séquence ou un élément en ligne) avec la traduction en
     * RÉUTILISANT ses nœuds texte d'origine : React, Vue, Next, Docusaurus ou VitePress gardent des
     * références vers ces nœuds (removeChild, insertBefore, nodeValue=) ; s'ils étaient retirés de la
     * page, le framework planterait (NotFoundError) ou écrirait dans un nœud détaché.
     * - mêmes éléments dans le même ordre (cas courant) : seul le contenu des nœuds texte change,
     *   rien n'est déplacé ; un nouveau nœud texte n'est créé que là où il n'y en avait aucun ;
     * - ordre changé par la grammaire : les éléments sont déplacés dans le même parent (jamais retirés),
     *   les nœuds texte d'origine servent d'emplacements dans l'ordre, ceux en trop sont vidés.
     */
    function fillContainer(unit, container, origNodes, items, isTop, ctx) {
      var o = splitNodes(origNodes);
      var t = splitItems(items);
      var N = t.els.length;
      if (isTop) { t.gaps[0] = unit.lead + t.gaps[0]; t.gaps[N] += unit.trail; }
      var tEls = t.els.map(function (it) { return unit.map[it.id].el; });
      var same = tEls.length === o.els.length && tEls.every(function (e, i) { return e === o.els[i]; });
      var k, j, tn;
      if (same) {
        for (k = 0; k <= N; k++) {
          var g = o.gaps[k];
          var text = t.gaps[k];
          if (g.length) {
            if (g[0].data !== text) g[0].data = text;
            for (j = 1; j < g.length; j++) if (g[j].data !== '') g[j].data = '';
          } else if (text) {
            tn = newText(ctx, text);
            container.insertBefore(tn, k < N ? o.els[k] : o.els[N - 1].nextSibling);
          }
        }
      } else {
        unit.moved = true;
        var pool = [];
        for (k = 0; k < o.gaps.length; k++) pool = pool.concat(o.gaps[k]);
        var seq = [];
        for (k = 0; k <= N; k++) {
          if (t.gaps[k]) {
            tn = pool.length ? pool.shift() : newText(ctx, t.gaps[k]);
            if (tn.data !== t.gaps[k]) tn.data = t.gaps[k];
            seq.push(tn);
          }
          if (k < N) seq.push(tEls[k]);
        }
        for (k = 0; k < pool.length; k++) if (pool[k].data !== '') pool[k].data = '';
        for (k = 0; k < seq.length; k++) {
          if (isTop) container.insertBefore(seq[k], ctx.ref);
          else container.appendChild(seq[k]);
        }
      }
      for (k = 0; k < N; k++) {
        if (t.els[k].kids) fillContainer(unit, tEls[k], ctx.kids.get(tEls[k]) || [], t.els[k].kids, false, ctx);
      }
    }

    function applyUnit(unit) {
      if (!unit.out || unit.applied || unit.gone) return false;
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
        var ctext = unit.prefix + DDT.unescapeText(unit.out) + unit.suffix;
        var only = unit.el.childNodes.length === 1 && unit.el.firstChild.nodeType === 3 ? unit.el.firstChild : null;
        if (only) {
          // un seul nœud texte : modifié sur place, comme pour le texte de la page
          unit.rec = { node: only, orig: only.data, set: ctext };
          only.data = ctext;
          unit.saved = null;
        } else {
          unit.rec = null;
          unit.saved = Array.prototype.slice.call(unit.el.childNodes);
          while (unit.el.firstChild) unit.el.removeChild(unit.el.firstChild);
          var tn = doc.createTextNode(ctext);
          built.add(tn);
          unit.el.appendChild(tn);
        }
        unit.applied = 'replace';
        return true;
      }
      if (!stillInPlace(unit)) return false;
      var parent = unit.parent;
      var first = unit.nodes[0];
      var last = unit.nodes[unit.nodes.length - 1];
      if (settings.mode === 'bilingual') {
        // traduction identique à l'original (nom de produit...) : rien à ajouter
        if (DDT.plainText(DDT.normalizeOutput(unit.src)) === DDT.plainText(unit.out)) {
          unit.bi = null;
          unit.applied = 'bilingual';
          return true;
        }
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
      // mode remplacer : les nœuds d'origine restent dans la page, seul leur contenu change
      var ctx = { added: [], kids: new Map(), ref: last.nextSibling };
      unit.containers = [];
      for (var id in unit.map) {
        if (unit.map[id].type === 'wrap') {
          var w = unit.map[id].el;
          var kids = Array.prototype.slice.call(w.childNodes);
          ctx.kids.set(w, kids);
          unit.containers.push({ el: w, kids: kids });
        }
      }
      // tout ce qui est entre le premier et le dernier nœud (commentaires compris), pour l'ordre
      unit.span = [];
      for (var c = first; c; c = c.nextSibling) { unit.span.push(c); if (c === last) break; }
      // contenu d'origine de chaque nœud texte touché
      unit.recs = [];
      var texts = splitNodes(unit.nodes).gaps;
      unit.containers.forEach(function (ct) { texts = texts.concat(splitNodes(ct.kids).gaps); });
      texts.forEach(function (g) { g.forEach(function (n) { unit.recs.push({ node: n, orig: n.data, set: null }); }); });
      unit.moved = false;
      fillContainer(unit, parent, unit.nodes, tokenTree(unit.out), true, ctx);
      unit.recs.forEach(function (r) { r.set = r.node.data; });
      unit.added = ctx.added;
      unit.applied = 'replace';
      return true;
    }

    /* La page a-t-elle modifié un passage déjà traduit (texte réécrit, nœud retiré) ? */
    function owners(unit) {
      var set = new Set([unit.parent]);
      (unit.containers || []).forEach(function (ct) { set.add(ct.el); });
      return set;
    }
    function touched(unit) {
      if (unit.kind !== 'run' || !unit.applied) return false;
      if (unit.applied === 'bilingual') return !stillInPlace(unit);
      for (var i = 0; i < unit.recs.length; i++) if (unit.recs[i].node.data !== unit.recs[i].set) return true;
      var own = owners(unit);
      for (i = 0; i < unit.nodes.length; i++) if (!own.has(unit.nodes[i].parentNode)) return true;
      return false;
    }

    /* Remet l'ordre d'origine des nœuds après une traduction qui en a déplacé. Seuls les nœuds encore
     * dans un conteneur de l'unité sont replacés : un nœud retiré par la page n'est pas ressuscité. */
    function restoreOrder(unit) {
      var own = owners(unit);
      function here(n) { return n.parentNode && own.has(n.parentNode); }
      unit.containers.forEach(function (ct) {
        var kids = ct.kids.filter(here);
        var now = Array.prototype.slice.call(ct.el.childNodes);
        var same = now.length === kids.length && now.every(function (n, i) { return n === kids[i]; });
        if (!same) kids.forEach(function (k) { ct.el.appendChild(k); });
      });
      var parent = unit.parent;
      var span = unit.span.filter(here);
      var inSpan = new Set(span);
      var head = null;
      for (var c = parent.firstChild; c; c = c.nextSibling) if (inSpan.has(c)) { head = c; break; }
      var prev = null;
      span.forEach(function (s) {
        if (!prev) { if (s !== head) parent.insertBefore(s, head); }
        else if (prev.nextSibling !== s) parent.insertBefore(s, prev.nextSibling);
        prev = s;
      });
    }

    function restoreUnit(unit) {
      if (!unit.applied) return;
      if (unit.kind === 'title') {
        // après une navigation SPA, la page a pu mettre son propre titre : on n'y touche pas
        if (titleIs(DDT.unescapeText(unit.out))) doc.title = unit.orig;
        unit.applied = null;
        return;
      }
      if (unit.kind === 'attr') { unit.el.setAttribute(unit.attr, unit.orig); unit.applied = null; return; }
      if (unit.kind === 'comment') {
        if (unit.rec) {
          if (unit.rec.node.data === unit.rec.set) unit.rec.node.data = unit.rec.orig;
        } else {
          while (unit.el.firstChild) unit.el.removeChild(unit.el.firstChild);
          for (var c = 0; c < unit.saved.length; c++) unit.el.appendChild(unit.saved[c]);
        }
        unit.rec = null;
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
      var i;
      for (i = 0; i < unit.added.length; i++) {
        var n = unit.added[i];
        if (n.parentNode) n.parentNode.removeChild(n);
      }
      // un texte réécrit entre-temps par la page garde la valeur de la page
      for (i = 0; i < unit.recs.length; i++) {
        var r = unit.recs[i];
        if (r.node.data === r.set && r.node.data !== r.orig) r.node.data = r.orig;
      }
      if (unit.moved) restoreOrder(unit);
      unit.recs = null;
      unit.added = null;
      unit.containers = null;
      unit.span = null;
      unit.moved = false;
      unit.applied = null;
    }

    /* ---------------- Fichiers texte et Markdown bruts ----------------
     * Un README « raw », un .txt ou un .md s'affichent dans un seul <pre> : tout serait pris pour du
     * code, donc « rien à traduire ». On construit à côté une version lisible (titres, paragraphes,
     * listes, citations ; blocs de code gardés en <pre>), on la traduit, et on remontre le <pre>
     * d'origine, intact, pour « Voir l'original ». */
    var plain = null;
    function isPlainDocument() {
      var ct = String(doc.contentType || '').toLowerCase();
      var body = doc.body;
      if (!body) return false;
      var kids = Array.prototype.filter.call(body.children, function (c) { return !isUi(c) && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE'; });
      if (kids.length !== 1 || kids[0].tagName !== 'PRE') return false;
      if (/^text\/(plain|markdown|x-markdown)/.test(ct)) return true;
      // affichage brut sans type annoncé : un seul <pre> qui contient du texte en phrases
      return /\.(md|markdown|txt|rst)(\?|#|$)/i.test(String(win.location && win.location.pathname || ''));
    }
    function inlineMd(parent, text) {
      // `code`, **gras**, [lien](url) ; le reste en texte brut (jamais de HTML interprété)
      text = String(text).replace(/\\([\\`*_{}\[\]()#+\-.!&<>|])/g, '$1');   // échappements Markdown
      var re = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|[^)\s:]+)\)/g;
      var last = 0;
      var m;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) parent.appendChild(doc.createTextNode(text.slice(last, m.index)));
        var el;
        if (m[1] !== undefined) { el = doc.createElement('code'); el.textContent = m[1]; }
        else if (m[2] !== undefined) { el = doc.createElement('b'); inlineMd(el, m[2]); }
        else { el = doc.createElement('a'); el.textContent = m[3]; el.setAttribute('href', m[4]); }
        parent.appendChild(el);
        last = re.lastIndex;
      }
      if (last < text.length) parent.appendChild(doc.createTextNode(text.slice(last)));
    }
    function looksPreformatted(lines) {
      return lines.some(function (l) { return /\S {3,}\S|[│┌┐└┘├┤─═║+]{3,}|^\s*[|+][-=+|]{3,}/.test(l); });
    }
    function buildPlainView(text) {
      var box = doc.createElement('div');
      box.setAttribute('data-ddt-plain', '');
      box.style.maxWidth = '88ch';
      box.style.margin = '16px auto';
      box.style.padding = '0 16px';
      box.style.font = '15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif';
      var lines = String(text).replace(/\r\n?/g, '\n').split('\n');
      var i = 0;
      var list = null;
      function codeBlock(content) {
        var pre = doc.createElement('pre');
        pre.textContent = content;
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.padding = '10px 12px';
        pre.style.borderRadius = '8px';
        pre.style.background = 'rgba(127,127,127,.12)';
        pre.style.font = '13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace';
        box.appendChild(pre);
      }
      while (i < lines.length) {
        var line = lines[i];
        var fence = /^\s*(```|~~~)/.exec(line);
        if (fence) {
          var buf = [];
          i++;
          while (i < lines.length && lines[i].trim().indexOf(fence[1]) !== 0) buf.push(lines[i++]);
          i++;
          list = null;
          codeBlock(buf.join('\n'));
          continue;
        }
        if (!line.trim()) { i++; list = null; continue; }
        if (/^( {4}|\t)/.test(line) && !(list && /^\s*(?:[-*+]|\d{1,3}[.)])\s+/.test(line))) {
          var code = [];
          while (i < lines.length && (/^( {4}|\t)/.test(lines[i]) || !lines[i].trim())) code.push(lines[i++]);
          while (code.length && !code[code.length - 1].trim()) code.pop();
          list = null;
          codeBlock(code.map(function (l) { return l.replace(/^( {4}|\t)/, ''); }).join('\n'));
          continue;
        }
        var h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
        if (h) {
          var hx = doc.createElement('h' + h[1].length);
          inlineMd(hx, h[2]);
          box.appendChild(hx);
          i++;
          list = null;
          continue;
        }
        var li = /^\s*(?:[-*+]|\d{1,3}[.)])\s+(.*)$/.exec(line);
        if (li) {
          if (!list) { list = doc.createElement(/^\s*\d/.test(line) ? 'ol' : 'ul'); box.appendChild(list); }
          var item = doc.createElement('li');
          var txt = [li[1]];
          i++;
          while (i < lines.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && !/^\s*(?:[-*+]|\d{1,3}[.)])\s+/.test(lines[i])) txt.push(lines[i++].trim());
          inlineMd(item, txt.join(' '));
          list.appendChild(item);
          continue;
        }
        list = null;
        var para = [];
        while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|#{1,6}\s)/.test(lines[i]) && !/^( {4}|\t)/.test(lines[i])) para.push(lines[i++]);
        if (looksPreformatted(para)) { codeBlock(para.join('\n')); continue; }
        // HTML brut d'un README (<p align=…>, <picture>…) : balises retirées, et une ligne qui n'est
        // qu'une balise reste visible telle quelle, sans être envoyée à la traduction.
        if (para.every(function (l) { return /^\s*<[^>]+>\s*(<[^>]+>\s*)*$/.test(l); })) { codeBlock(para.join('\n')); continue; }
        para = para.map(function (l) { return l.replace(/<\/?[a-zA-Z][^>]*>/g, ' '); }).filter(function (l) { return l.trim(); });
        if (!para.length) continue;
        var quote = para.every(function (l) { return /^\s*>/.test(l); });
        var el = doc.createElement(quote ? 'blockquote' : 'p');
        inlineMd(el, para.map(function (l) { return quote ? l.replace(/^\s*>\s?/, '') : l.trim(); }).join(' '));
        box.appendChild(el);
      }
      return box;
    }
    function preparePlain() {
      if (plain || !isPlainDocument()) return;
      var pre = Array.prototype.filter.call(doc.body.children, function (c) { return c.tagName === 'PRE'; })[0];
      var view = buildPlainView(pre.textContent);
      plain = { pre: pre, view: view, display: pre.style.display };
      doc.body.insertBefore(view, pre);
      pre.style.display = 'none';
    }
    function showPlain(translated) {
      if (!plain) return;
      plain.view.style.display = translated ? '' : 'none';
      plain.pre.style.display = translated ? 'none' : plain.display;
    }

    /* Oublie une unité (disparue, ou texte changé par la page) : ses nœuds pourront être repris. */
    function dropUnit(unit) {
      unit.gone = true;
      if (unit.kind === 'run') {
        unit.nodes.forEach(function (n) { seen.delete(n); });
        for (var id in unit.map) seen.delete(unit.map[id].el);
      } else if (unit.kind === 'comment') seen.delete(unit.el);
      else if (unit.kind === 'attr' && unit.el.__ddtAttrs) delete unit.el.__ddtAttrs['attr:' + unit.attr];
    }

    /* ---------------- Page : marques anti-traduction du navigateur ---------------- */
    function markPage() {
      showPlain(true);
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
      showPlain(false);
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
    /* Ordre : titre, puis contenu principal visible, autre visible, reste du contenu principal, le reste.
     * Le contenu principal = <main>, <article>, [role=main] ; menus, en-têtes et pieds de page après. */
    var MAIN_SEL = 'main, article, [role="main"], .markdown-body, #content, .content';
    var SIDE_SEL = 'nav, aside, [role="navigation"], [role="complementary"]';
    function unitElement(u) {
      if (u.kind === 'run') return u.parent.nodeType === 1 ? u.parent : (u.parent.host || null);
      return u.el || null;
    }
    function isMainContent(u) {
      var el = unitElement(u);
      if (!el || !el.closest) return false;
      var m = el.closest(MAIN_SEL);
      if (!m) return false;
      var side = el.closest(SIDE_SEL);
      return !(side && m.contains(side));   // menu ou encadré à l'intérieur du contenu principal : après
    }
    /* Rang de chaque unité nouvellement collectée, calculé une seule fois par scan() (et non à chaque
     * lot : getBoundingClientRect + closest par unité devenait quadratique sur 10 000 unités). */
    function rankUnits(list) {
      var h = win.innerHeight || 800;
      list.forEach(function (u) {
        if (u.kind === 'title') { u.rank = 0; return; }
        if (u.main === undefined) u.main = isMainContent(u);
        var r = unitRect(u);
        var visible = r && r.bottom >= -h && r.top <= h * 2;
        u.rank = visible ? (u.main ? 1 : 2) : (u.main ? 3 : 4);
      });
    }
    function byRank(a, b) { return (a.rank - b.rank) || (a.uid - b.uid); }

    /* ---------------- Boucle de traduction ---------------- */
    /* En bilingue, les attributs ne sont jamais appliqués : inutile de les envoyer (quota). */
    function activeUnit(u) {
      return !u.gone && (u.kind !== 'attr' || settings.mode === 'replace');
    }
    function pendingUnits() {
      return units.filter(function (u) { return !u.out && !u.failed && activeUnit(u); });
    }

    function firstBatch(list) {
      var max = settings.batchChars || 6000;
      var cur = [];
      var size = 0;
      for (var i = 0; i < list.length; i++) {
        var len = list[i].src.length;
        if (cur.length && (size + len > max || cur.length >= 60)) break;
        cur.push(list[i]);
        size += len;
      }
      return cur;
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
      var lost = false;
      withObserverOff(function () {
        batch.forEach(function (u, i) {
          var v = tr[i];
          if (typeof v === 'string') {
            u.out = v;
            if (u.glossed) u.glossed.forEach(function (g) { glossed.add(g); });
            if (showing === 'translated' && !applyUnit(u)) {
              // retirée ou texte changé par la page pendant le lot : oubliée, ses nœuds seront repris
              if (!u.gone && !stillInPlace(u)) { dropUnit(u); lost = true; }
            }
          } else if (v === null && !(res && res.error)) {
            u.failed = true;
            failed++;
          }
        });
      });
      if (lost) units = units.filter(function (u) { return !u.gone; });
    }

    function run() {
      // « Arrêter » puis « Traduire » pendant un lot : la boucle en cours repart au lieu de s'arrêter
      if (runPromise) { stopFlag = false; state = 'running'; updateBadge(); return runPromise; }
      runPromise = (async function () {
        state = 'running';
        stopFlag = false;
        lastMessage = '';
        updateBadge();
        var rateTries = 0;
        while (!stopFlag) {
          var todo = pendingUnits();
          if (!todo.length) break;
          var batch = firstBatch(todo);
          var chars = batch.reduce(function (a, u) { return a + u.src.length; }, 0);
          if (sentChars + chars > capLimit() && sentChars > 0) {
            state = 'paused';
            lastMessage = t('badgeCap', [capLimit().toLocaleString()]);
            updateBadge();
            runPromise = null;
            return;
          }
          var myGen = gen;
          var res;
          try {
            res = await translateBatch(batch);
          } catch (e) {
            res = { error: 'error', message: String(e && e.message || e) };
          }
          if (res && res.error === 'disconnected' && myGen === gen) {
            res = await translateBatch(batch).catch(function (e) { return { error: 'error', message: String(e) }; });
          }
          sentChars += chars;
          // langue cible changée pendant le lot : réponse dans l'ancienne langue, ignorée
          if (myGen !== gen) continue;
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

    /* Relance automatique (contenu ajouté, navigation SPA) seulement après une traduction terminée :
     * jamais après « Arrêter », une erreur (pas de clé, limite) ou une pause (plafond de la page). */
    function canRestart() {
      return state === 'done' || state === 'idle';
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
      // L'affichage a pu changer depuis le dernier passage (menu ouvert, section dépliée) :
      // on oublie les styles mémorisés, sinon un élément caché hier le resterait pour toujours.
      styleCache = new WeakMap();
      blockDescCache = new WeakMap();
      var found = [];
      if (doc.body) collect(doc.body, found);
      collectTitle(found);
      if (found.length) {
        rankUnits(found);
        units = units.concat(found).sort(byRank);
      }
      return found;
    }

    /* Oublie les unités dont les nœuds ont disparu ; une unité appliquée que la page a modifiée
     * (React qui réécrit un texte, Vue qui retire un nœud) est rendue à la page puis oubliée, pour
     * que le nouveau texte soit retraduit. */
    function sweep() {
      withObserverOff(function () {
        units.forEach(function (u) {
          if (u.gone) return;
          if (!unitConnected(u)) { if (u.applied) restoreUnit(u); dropUnit(u); return; }
          if (u.kind !== 'run') return;
          if (u.applied) { if (touched(u)) { restoreUnit(u); edited(u); } }
          else if (!stillInPlace(u)) edited(u);
        });
      });
      units = units.filter(function (u) { return !u.gone; });
    }
    /* Texte réécrit par la page : retraduit, sauf s'il change sans cesse au même endroit (horloge,
     * compteur, « il y a 3 s ») : au-delà de MAX_EDITS, il reste tel que la page l'écrit (quota). */
    var MAX_EDITS = 5;
    var edits = new WeakMap();
    function edited(u) {
      var n = (edits.get(u.parent) || 0) + 1;
      edits.set(u.parent, n);
      if (n > MAX_EDITS) { u.gone = true; return; }   // nœuds gardés comme « vus » : plus repris
      dropUnit(u);
    }

    /* ---------------- Commandes publiques ---------------- */
    function start(opts) {
      options = Object.assign({}, options, opts || {});
      if (opts && opts.settings) settings = Object.assign(settings, opts.settings);
      closed = false;
      ensureBadge();
      withObserverOff(preparePlain);
      markPage();
      showing = 'translated';
      withObserverOff(function () {
        units.forEach(function (u) { if (u.out && !u.applied) applyUnit(u); });
      });
      scan();
      // page encore vide (SPA qui affiche son contenu ensuite) : on observe quand même
      observeStart();
      watchUrl();
      if (!units.length) {
        state = 'done';
        lastMessage = t('badgeNothing');
        updateBadge();
        return Promise.resolve();
      }
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
      // ce que la page a changé pendant l'affichage de l'original est repris
      sweep();
      scan();
      observeStart();
      updateBadge();
      if (pendingUnits().length && state !== 'running') return run();
      return Promise.resolve();
    }

    function toggle(opts) {
      closed = false;
      if (showing === 'translated') { showOriginal(); return Promise.resolve(); }
      if (units.some(function (u) { return u.out; })) return showTranslation();
      return start(opts);
    }

    function stop() {
      stopFlag = true;
      if (state === 'running') { state = 'stopped'; lastMessage = ''; }   // pas d'ancien message (attente de limite) sur « Arrêté »
      updateBadge();
    }

    function continueAfterCap() {
      capExtra += Number(settings.pageCap) || DDT.DEFAULT_SETTINGS.pageCap;
      state = 'running';
      return run();
    }

    function status() {
      var done = 0;
      var total = 0;
      units.forEach(function (u) {
        if (!activeUnit(u)) return;
        total++;
        if (u.out) done++;
      });
      return {
        state: state, showing: showing, done: done, total: total, failed: failed,
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
            if (r.type === 'attributes') return revealed(r.target);
            if (r.type === 'characterData') return textEdited(r.target);
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
      // Les attributs comptent aussi : beaucoup de pages montrent un texte déjà présent mais caché
      // (menu, section repliée de la barre latérale, résultats de recherche) en changeant une classe.
      // characterData : un framework qui réécrit un texte (nodeValue=) sans remplacer le nœud.
      observer.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: REVEAL_ATTRS });
    }
    /* Un élément vient-il peut-être de devenir visible avec du texte à traduire ? */
    function revealed(el) {
      if (!el || el.nodeType !== 1 || built.has(el) || isUi(el)) return false;
      if (el.closest && el.closest('[data-tr-ui],[data-tr-bi],pre,code,script,style,textarea')) return false;
      if (!/[^\s\d]/.test(el.textContent || '')) return false;
      try { return win.getComputedStyle(el).display !== 'none'; } catch (e) { return false; }
    }
    /* Un texte de la page vient d'être réécrit (hors code, hors interface de l'extension) ? */
    function textEdited(n) {
      if (!n || n.nodeType !== 3 || built.has(n)) return false;
      var p = n.parentElement;
      if (!p) return false;
      return !(p.closest && p.closest('[data-tr-ui],[data-tr-bi],pre,code,script,style,textarea'));
    }
    function observeStop() {
      if (observer) observer.disconnect();
    }
    function onDomChange() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        checkUrl();
        if (showing !== 'translated') return;
        sweep();
        var found = scan();
        if (found.length && canRestart()) run();
      }, 800);
    }
    function checkUrl() {
      var href = win.location ? win.location.href : '';
      if (href !== lastUrl) {
        lastUrl = href;
        glossed = new Set();
        // unités détachées (ancienne page) : oubliées, sinon fuite mémoire et total qui gonfle
        sweep();
        // titre remplacé par la nouvelle page : l'ancienne unité titre ne doit plus le restaurer
        units = units.filter(function (u) {
          if (u.kind !== 'title') return true;
          return titleIs(u.applied ? DDT.unescapeText(u.out) : u.orig);
        });
        if (onUrlChange) onUrlChange(href);
        if (showing === 'translated') {
          var found = scan();
          if (found.length && canRestart()) run();
        }
      }
    }
    function watchUrl() {
      if (urlTimer || !win.setInterval) return;
      urlTimer = win.setInterval(function () { if (showing === 'translated') checkUrl(); }, 1000);
      try { win.addEventListener('popstate', function () { setTimeout(checkUrl, 50); }); } catch (e) { /* rien */ }
    }

    /* ---------------- Badge : très discret, uniquement fonctionnel (shadow DOM) ----------------
     * Valeurs recopiées de src/tokens.css (vérifiées par tests/design.test.js). Pas d'irisation. */
    var BADGE_CSS = [
      ':host{all:initial;--b-text-1:#12152b;--b-text-2:#4a5071;--b-accent:#2f6bff;--b-focus:rgba(47, 107, 255, .55);',
      '--b-surface:rgba(255,255,255,.80);--b-solid:#f8f9fd;--b-hairline:rgba(24, 32, 84, .10);--b-err:#c81e45;--b-warn:#a35f00;--b-ok:#138a45;',
      '--b-shadow:0 8px 24px rgba(28, 40, 110, .12), 0 1px 2px rgba(20, 28, 80, .06);--b-pill:999px;--b-r:18px}',
      ':host([data-theme=dark]){--b-text-1:#eef0ff;--b-text-2:#a9b0d8;--b-accent:#5b8cff;--b-focus:rgba(110, 160, 255, .6);',
      '--b-surface:rgba(24,28,64,.80);--b-solid:#141836;--b-hairline:rgba(170, 190, 255, .14);--b-err:#fb7185;--b-warn:#fbbf24;--b-ok:#4ade80;',
      '--b-shadow:0 10px 28px rgba(0, 0, 0, .45), 0 1px 2px rgba(0, 0, 0, .3)}',
      '@media (prefers-color-scheme:dark){:host(:not([data-theme=light])){--b-text-1:#eef0ff;--b-text-2:#a9b0d8;--b-accent:#5b8cff;--b-focus:rgba(110, 160, 255, .6);',
      '--b-surface:rgba(24,28,64,.80);--b-solid:#141836;--b-hairline:rgba(170, 190, 255, .14);--b-err:#fb7185;--b-warn:#fbbf24;--b-ok:#4ade80;',
      '--b-shadow:0 10px 28px rgba(0, 0, 0, .45), 0 1px 2px rgba(0, 0, 0, .3)}}',
      '.b{position:fixed;right:16px;bottom:16px;z-index:2147483647;box-sizing:border-box;max-width:min(320px,calc(100vw - 32px));',
      'font:12.5px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;color:var(--b-text-1);',
      // Verre sur ::before, découpé par clip-path : Chromium ne découpe pas toujours le flou selon border-radius
      '--b-cr:var(--b-r);isolation:isolate;background:transparent;border-radius:var(--b-cr);box-shadow:var(--b-shadow);overflow:hidden;',
      'transition:opacity .2s cubic-bezier(.2,.8,.2,1),transform .2s cubic-bezier(.2,.8,.2,1)}',
      '.b::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background:var(--b-solid);',
      'border:1px solid var(--b-hairline);box-sizing:border-box;clip-path:inset(0 round var(--b-cr))}',
      '@supports ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.b::before{background:var(--b-surface);-webkit-backdrop-filter:blur(16px) saturate(160%);backdrop-filter:blur(16px) saturate(160%)}}',
      '@media (prefers-reduced-transparency:reduce){.b::before{background:var(--b-solid)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}',
      '.row{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 10px}',
      '.sym{width:16px;height:16px;flex:none;color:var(--b-text-2)}',
      '.msg{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:550;font-variant-numeric:tabular-nums}',
      '.err .msg,.warn .msg{white-space:normal}',
      '.err .sym{color:var(--b-err)}.warn .sym{color:var(--b-warn)}.ok .sym{color:var(--b-ok)}',
      'button{all:unset;box-sizing:border-box;display:inline-grid;place-items:center;height:26px;min-width:26px;padding:0 6px;border-radius:var(--b-pill);',
      'color:var(--b-text-2);cursor:pointer;font:600 12px/1 inherit;font-family:inherit;transition:background .12s,color .12s}',
      'button:hover{background:var(--b-hairline);color:var(--b-text-1)}',
      'button:focus-visible{outline:2px solid var(--b-focus);outline-offset:1px}',
      'button svg{width:15px;height:15px}',
      'button.txt{padding:0 9px;color:var(--b-accent)}',
      '.bar{height:2px;background:var(--b-hairline)}.fill{height:100%;width:0;background:var(--b-accent);transition:width .3s cubic-bezier(.2,.8,.2,1)}',
      '.hide{display:none!important}',
      '.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
      '.min{--b-cr:var(--b-pill)}.min .row{padding:5px}.min .msg,.min [data-a=stop],.min [data-a=toggle],.min [data-a=continue],.min [data-a=close],.min .bar{display:none}',
      '.min [data-a=min]{width:26px}',
      '@media (prefers-reduced-motion:reduce){.b,.fill,button{transition:none}}'
    ].join('');

    var BI = {
      sym: '<rect x="2.6" y="2.2" width="7.4" height="9.4" rx="1.8" transform="rotate(-9 6.3 6.9)" fill="currentColor" opacity=".45"/><rect x="6" y="4.6" width="7.6" height="9.6" rx="1.9" fill="currentColor"/>',
      stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
      original: '<path d="M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z"/><circle cx="12" cy="12" r="2.5"/>',
      translate: '<rect x="3.5" y="3" width="11" height="14" rx="2.5" transform="rotate(-8 9 10)"/><rect x="9.5" y="7" width="11" height="14" rx="2.5"/>',
      min: '<path d="M6 12h12"/>',
      max: '<path d="M7 14l5-5 5 5"/>',
      close: '<path d="M7 7l10 10M17 7L7 17"/>'
    };
    function svg(name, fillMode) {
      if (fillMode) return '<svg class="sym" viewBox="0 0 16 16" aria-hidden="true">' + BI[name] + '</svg>';
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + BI[name] + '</svg>';
    }

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
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', 'DevDocTrad');
      box.innerHTML = '<div class="row">' + svg('sym', true) +
        '<span class="msg"></span>' +
        // région annoncée aux lecteurs d'écran : seulement les changements d'état, pas chaque lot
        // ni chaque seconde du compte à rebours
        '<span class="sr" role="status" aria-live="polite"></span>' +
        '<button data-a="continue" class="txt hide"></button>' +
        '<button data-a="stop">' + svg('stop') + '</button>' +
        '<button data-a="toggle"></button>' +
        '<button data-a="min">' + svg('min') + '</button>' +
        '<button data-a="close">' + svg('close') + '</button></div>' +
        '<div class="bar"><div class="fill"></div></div>';
      sr.appendChild(box);
      box.querySelector('[data-a=continue]').textContent = t('btnContinue');
      box.querySelector('[data-a=stop]').setAttribute('aria-label', t('btnStop'));
      box.querySelector('[data-a=stop]').title = t('btnStop');
      box.querySelector('[data-a=min]').setAttribute('aria-label', t('btnMinimize'));
      box.querySelector('[data-a=min]').title = t('btnMinimize');
      box.querySelector('[data-a=close]').setAttribute('aria-label', t('btnClose'));
      box.querySelector('[data-a=close]').title = t('btnClose');
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('[data-a]');
        if (!b) return;
        var a = b.getAttribute('data-a');
        if (a === 'min') {
          var m = box.classList.toggle('min');
          b.innerHTML = svg(m ? 'max' : 'min');
          b.setAttribute('aria-label', m ? t('badgeShowBadge') : t('btnMinimize'));
          b.title = b.getAttribute('aria-label');
        } else if (a === 'close') { closed = true; host.style.display = 'none'; }
        else if (a === 'stop') stop();
        else if (a === 'toggle') toggle();
        else if (a === 'continue') continueAfterCap();
      });
      (doc.body || doc.documentElement).appendChild(host);
      badge = { host: host, box: box };
      built.add(host);
      applyBadgeTheme();
    }
    function applyBadgeTheme() {
      if (!badge) return;
      var th = settings.theme;
      if (th === 'light' || th === 'dark') badge.host.setAttribute('data-theme', th);
      else badge.host.removeAttribute('data-theme');
    }

    function updateBadge() {
      if (!badge) return;
      var st = status();
      badge.host.style.display = closed ? 'none' : '';
      var msg = st.message;
      var kind = '';
      if (st.state === 'error') kind = 'err';
      else if (st.state === 'paused' || (st.state === 'running' && msg)) kind = 'warn';
      else if (st.state === 'done' && !st.failed) kind = 'ok';
      if (!msg) {
        if (st.state === 'running') msg = t('badgeTranslating', [st.done, st.total]);
        else if (st.state === 'stopped') msg = t('badgeStopped');
        else if (st.state === 'done') msg = st.failed ? t('badgeDoneFailed', [st.done, st.failed]) : t('badgeDone', [st.done]);
      }
      var full = msg;
      if (st.state === 'done' && st.via) full += ' · ' + (st.via.local ? t('badgeViaLocal') : t('badgeViaOnline', [st.via.label]));
      badge.box.className = 'b' + (badge.box.classList.contains('min') ? ' min' : '') + (kind ? ' ' + kind : '');
      badge.box.querySelector('.msg').textContent = msg || '';
      badge.box.querySelector('.msg').title = full || '';
      var pct = st.total ? Math.round((st.done + st.failed) / st.total * 100) : 0;
      badge.box.querySelector('.fill').style.width = pct + '%';
      badge.box.querySelector('[data-a=stop]').classList.toggle('hide', st.state !== 'running');
      badge.box.querySelector('[data-a=continue]').classList.toggle('hide', st.state !== 'paused');
      var tg = badge.box.querySelector('[data-a=toggle]');
      var label = st.showing === 'translated' ? t('btnOriginal') : t('btnTranslation');
      tg.innerHTML = svg(st.showing === 'translated' ? 'original' : 'translate');
      tg.setAttribute('aria-label', label);
      tg.title = label;
      tg.classList.toggle('hide', !st.done);
      if (st.state !== announced) {
        announced = st.state;
        badge.box.querySelector('.sr').textContent = full || '';
      }
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
      setSettings: function (s) {
        var before = DDT.resolveTarget(settings.target);
        settings = Object.assign(settings, s || {});
        applyBadgeTheme();
        // Nouvelle langue cible (choisie dans le popup) : on revient à l'original et on oublie les
        // traductions déjà faites, pour que « Traduire » retraduise dans la nouvelle langue.
        if (DDT.resolveTarget(settings.target) === before) return;
        // un lot en cours est dans l'ancienne langue : sa réponse sera ignorée
        gen++;
        // les échecs de l'ancienne langue ne valent pas pour la nouvelle
        units.forEach(function (u) { u.failed = false; });
        failed = 0;
        if (units.some(function (u) { return u.out; })) {
          if (showing === 'translated') showOriginal();
          units.forEach(function (u) { u.out = null; });
          glossed = new Set();
          if (state !== 'running') state = 'idle';
        }
        updateBadge();
      }
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
// Même objet global que shared.js : dans un script de contenu Firefox, window et globalThis sont deux
// objets différents ; avec window, DDT (posé sur globalThis) restait introuvable et rien ne marchait.
})(typeof globalThis !== 'undefined' ? globalThis : window);
