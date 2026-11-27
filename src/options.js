/* DevDocTrad - options.js : page de réglages (navigation latérale, 7 sections). Licence MIT. */
(function () {
  'use strict';
  var DDT = window.DDT;
  var UI = window.DDT_UI;
  var api = DDT.api;
  var t = DDT.t;
  var $ = function (id) { return document.getElementById(id); };

  var keys = [];
  var TEXT_MASK = !!(window.CSS && CSS.supports && CSS.supports('-webkit-text-security', 'disc'));
  var settings = Object.assign({}, DDT.DEFAULT_SETTINGS);
  var glossary = [];
  var publicKeys = {};
  var saveTimer = null;
  var current = '';

  var SECTIONS = {
    keys: { icon: 'key', title: 'optNavKeys', desc: 'optDescKeys' },
    translation: { icon: 'translate', title: 'optTabTranslation', desc: 'optDescTranslation' },
    privacy: { icon: 'shield', title: 'optNavPrivacy', desc: 'optDescPrivacy' },
    sites: { icon: 'globe', title: 'optTabSites', desc: 'optDescSites' },
    glossary: { icon: 'book', title: 'optTabGlossary', desc: 'optDescGlossary' },
    data: { icon: 'database', title: 'optTabData', desc: 'optDescData' },
    appearance: { icon: 'palette', title: 'optNavAppearance', desc: 'optDescAppearance' }
  };
  var PROVIDER_ORDER = ['gemini', 'groq', 'mistral', 'openrouter', 'ollama'];
  var MONO = { gemini: 'Ge', groq: 'Gr', mistral: 'Mi', openrouter: 'OR', ollama: 'Ol' };
  var WARN = { gemini: 'warnGemini', groq: 'warnGroq', mistral: 'warnMistral', openrouter: 'warnOpenRouter', ollama: 'warnOllama' };

  DDT.localizePage(document);
  UI.fillIcons(document);
  UI.syncTheme();
  try { $('version').textContent = t('optVersion', [api.runtime.getManifest().version]); } catch (e) { /* rien */ }

  /* ---------------- Outils ---------------- */
  function send(msg) { return api.runtime.sendMessage(msg); }
  function uid() { return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function iconEl(name) { return UI.setOnly(el('span'), UI.icon(name)); }
  function setChip(c, kind, iconName, text) {
    c.className = c.className.replace(/\b(ok|warn|err|info)\b/g, '').replace(/\s+/g, ' ').trim();
    if (kind) c.classList.add(kind);
    UI.setOnly(c, UI.icon(iconName));
    c.appendChild(document.createTextNode(text));
  }
  function makeChip(kind, iconName, text) { var c = el('span', 'chip'); setChip(c, kind, iconName, text); return c; }
  function fmtTime(ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function providerLabel(p) { return (DDT.PROVIDERS[p] || {}).label || p; }

  /* Notification « Enregistré » courte, sans empiler pendant la frappe */
  var savedToast = null;
  function notifySaved() {
    if (savedToast && savedToast.el.parentNode && !savedToast.el.classList.contains('out')) return;
    savedToast = UI.toast('success', t('optSaved'));
  }

  /* Enregistrement des clés : différé de 400 ms pendant la frappe, immédiat pour supprimer, monter,
     descendre ou ajouter ; l'enregistrement en attente est forcé quand l'onglet se ferme ou passe
     en arrière-plan (sinon une modification faite juste avant la fermeture était perdue).
     resetKey (oubli d'une pause ou d'un arrêt 401/402) ne vise que les cartes modifiées : réenregistrer
     les autres ne doit pas réactiver une clé arrêtée. */
  var resetIds = {};
  function saveKeys(changedId, now) {
    if (changedId) resetIds[changedId] = true;
    clearTimeout(saveTimer);
    saveTimer = null;
    if (now) return flushKeys();
    saveTimer = setTimeout(flushKeys, 400);
    return Promise.resolve();
  }
  function flushKeys() {
    clearTimeout(saveTimer);
    saveTimer = null;
    var ids = Object.keys(resetIds);
    resetIds = {};
    keys.forEach(function (k, i) { k.order = i; });
    return api.storage.local.set({ keys: keys }).then(function () {
      ids.forEach(function (id) {
        if (keys.some(function (k) { return k.id === id; })) send({ type: 'resetKey', keyId: id });
      });
      notifySaved();
      refreshPublic();
    });
  }
  function flushPending() { if (saveTimer) flushKeys(); }
  window.addEventListener('pagehide', flushPending);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushPending(); });

  /* Champs numériques : mêmes bornes que les attributs min/max de options.html. Une valeur
     invalide (négative, trop petite, illisible) n'est pas enregistrée ; le champ est marqué. */
  function numberValue(inp) {
    if (inp.value === '' && !(inp.validity && inp.validity.badInput)) return { ok: true, value: '' };
    var n = Number(inp.value);
    var min = inp.getAttribute('min');
    var max = inp.getAttribute('max');
    var bad = inp.validity && (inp.validity.badInput || inp.validity.rangeUnderflow || inp.validity.rangeOverflow);
    if (bad || inp.value === '' || !isFinite(n) || (min !== null && n < Number(min)) || (max !== null && n > Number(max))) return { ok: false };
    return { ok: true, value: n };
  }

  /* Adresse d'Ollama : http(s) seulement ; un « /api » final est retiré (l'extension l'ajoute). */
  function ollamaUrl(raw) {
    var v = String(raw || '').trim();
    if (!v) return { ok: true, value: '' };
    var u;
    try { u = new URL(v); } catch (e) { return { ok: false }; }
    if (!/^https?:$/.test(u.protocol) || !u.hostname) return { ok: false };
    var p = u.pathname.replace(/\/+$/, '').replace(/\/api$/, '').replace(/\/+$/, '');
    return { ok: true, value: u.origin + p, origin: u.origin };
  }
  function isDefaultOllama(origin) {
    return DDT.OLLAMA_ORIGINS.some(function (o) { return o === origin + '/*'; });
  }
  function markInvalid(inp, message) {
    if (message) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
    if (inp.setCustomValidity) inp.setCustomValidity(message || '');
  }
  // Relit les réglages avant d'écrire : la liste des sites automatiques peut avoir changé depuis le popup.
  function saveSettings(patch) {
    Object.assign(settings, patch);
    return api.storage.local.get('settings').then(function (r) {
      settings = Object.assign({}, DDT.DEFAULT_SETTINGS, r.settings || {}, patch);
      return api.storage.local.set({ settings: settings });
    }).then(notifySaved);
  }
  function saveGlossary() {
    return api.storage.local.set({ glossary: glossary }).then(notifySaved);
  }

  /* ---------------- Navigation ---------------- */
  function replay(node) { node.classList.remove('enter'); void node.offsetWidth; node.classList.add('enter'); }
  function show(sec) {
    if (!SECTIONS[sec]) sec = 'keys';
    var first = !current;
    current = sec;
    document.querySelectorAll('.nav a').forEach(function (a) {
      if (a.getAttribute('data-sec') === sec) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.sec').forEach(function (s) { s.hidden = s.id !== 'sec-' + sec; });
    var def = SECTIONS[sec];
    UI.setOnly($('phIcon'), UI.icon(def.icon));
    $('phTitle').textContent = t(def.title);
    $('phDesc').textContent = t(def.desc);
    document.title = t(def.title) + ' · DevDocTrad';
    replay($('pagehead'));
    replay($('sec-' + sec));
    if (sec === 'privacy') { renderNotes(); refreshUsage(); }
    if (sec === 'sites') refreshSites();
    if (sec === 'data') refreshData();
    if (!first) window.scrollTo(0, 0);
    if (location.hash !== '#' + sec && history.replaceState) history.replaceState(null, '', '#' + sec);
    // garde l'élément actif visible dans la rangée horizontale (petit écran)
    var active = document.querySelector('.nav a[aria-current]');
    if (active && active.scrollIntoView && window.innerWidth < 760) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  document.querySelectorAll('.nav a').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); show(a.getAttribute('data-sec')); });
  });
  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });

  /* ---------------- Permissions des API (Firefox MV3) ---------------- */
  function checkApiPerms() {
    if (!api.permissions || !api.permissions.contains) return;
    api.permissions.contains({ origins: DDT.API_ORIGINS }).then(function (ok) {
      $('permBanner').hidden = !!ok;
    }).catch(function () { /* rien */ });
  }
  $('grantApi').addEventListener('click', function () {
    api.permissions.request({ origins: DDT.API_ORIGINS }).then(checkApiPerms);
  });

  /* ---------------- Fournisseurs et clés ---------------- */
  function fillProviderSelect(sel) {
    PROVIDER_ORDER.forEach(function (p) {
      var o = el('option', null, p === 'ollama' ? providerLabel(p) + ' (' + t('tier_local') + ')' : providerLabel(p));
      o.value = p;
      sel.appendChild(o);
    });
  }
  fillProviderSelect($('newProvider'));
  fillProviderSelect($('emptyProvider'));

  function stateOf(pk) {
    if (!pk) return null;
    if (!pk.enabled) return ['', 'off', t('keyDisabled')];
    if (pk.reason === 'no_key') return ['warn', 'key', t('keyNoApiKey')];
    if (!pk.configured) return ['warn', 'alert', t('keyNoModel')];
    if (pk.available) return ['ok', 'check', t('keyAvailable')];
    if (pk.until) return ['warn', 'pause', t('keyPausedUntil', [fmtTime(pk.until)])];
    return ['err', 'error', t('keyProblem')];
  }
  function fillCardState(card, k) {
    var c = card.querySelector('.kc-state');
    var s = stateOf(publicKeys[k.id]);
    c.hidden = !s;
    if (s) setChip(c, s[0], s[1], s[2]);
  }
  function paidReady(k) {
    var cap = parseFloat(k.dailyCap);
    return cap > 0 && k.priceIn !== '' && k.priceIn !== undefined && !isNaN(parseFloat(k.priceIn)) &&
      k.priceOut !== '' && k.priceOut !== undefined && !isNaN(parseFloat(k.priceOut));
  }
  function fillPaidState(card, k) {
    var p = card.querySelector('.paid-state');
    var ok = paidReady(k);
    p.className = 'paid-state ' + (ok ? 'ok' : 'warn');
    UI.setOnly(p, UI.icon(ok ? 'check' : 'alert'));
    var msg = ok ? t('optPaidOk') : t('errPaidUnset');
    p.appendChild(document.createTextNode(msg.charAt(0).toUpperCase() + msg.slice(1)));
  }
  function fillMeta(card, k, index) {
    var tier = k.provider === 'ollama' ? 'local' : (k.tier === 'paid' ? 'paid' : 'free');
    card.querySelector('.kc-meta').textContent = providerLabel(k.provider) + ' · ' + t('tier_' + tier) + ' · ' + t('optPriority', [index + 1]);
  }

  function fillCard(card, k, index) {
    var isOllama = k.provider === 'ollama';
    var prov = DDT.PROVIDERS[k.provider] || {};
    card.querySelector('.mono-badge').textContent = MONO[k.provider] || '?';
    fillMeta(card, k, index);
    card.querySelector('.kc-note-txt').textContent = WARN[k.provider] ? t(WARN[k.provider]) : '';
    card.querySelector('.kc-note').hidden = !WARN[k.provider];
    card.querySelector('.f-key').hidden = isOllama;
    // Une clé d'API n'est pas un mot de passe : un champ « password » fait proposer par le navigateur
    // les identifiants enregistrés (et parfois les écrire dedans). Si le navigateur sait masquer un champ
    // texte, on l'utilise : plus aucune suggestion de mot de passe, la clé reste masquée par défaut.
    var keyInp = card.querySelector('[data-f=key]');
    if (TEXT_MASK) { keyInp.type = 'text'; keyInp.classList.add('masked'); }
    else {
      // Firefox ne sait pas masquer un champ texte : masqué au repos, champ texte pendant la saisie
      // (sinon il propose « mot de passe généré », qui écraserait la clé).
      keyInp.addEventListener('focus', function () { keyInp.type = 'text'; });
      keyInp.addEventListener('blur', function () { if (!keyInp.dataset.shown) keyInp.type = 'password'; });
    }
    card.querySelector('.f-url').hidden = !isOllama;
    card.querySelector('.f-tier').hidden = isOllama;
    card.querySelector('.f-paid').hidden = k.tier !== 'paid' || isOllama;
    // Identifiants uniques : libellés reliés aux champs, liste de modèles propre à la carte
    card.querySelectorAll('label[data-for]').forEach(function (l) { l.htmlFor = 'f-' + k.id + '-' + l.getAttribute('data-for'); });
    card.querySelectorAll('[data-f]').forEach(function (inp) {
      if (inp.type !== 'radio' && !inp.id) inp.id = 'f-' + k.id + '-' + inp.getAttribute('data-f');
    });
    var tierLbl = card.querySelector('.tier-lbl');
    tierLbl.id = 'f-' + k.id + '-tierlbl';
    card.querySelector('.f-tier .seg').setAttribute('aria-labelledby', tierLbl.id);
    var dl = card.querySelector('datalist');
    dl.id = 'models-' + k.id;
    card.querySelector('[data-f=modelEasy]').setAttribute('list', dl.id);
    card.querySelector('[data-f=modelHard]').setAttribute('list', dl.id);
    card.querySelectorAll('[data-f=tier]').forEach(function (r) { r.name = 'tier-' + k.id; r.checked = (k.tier || 'free') === r.value; });
    card.querySelectorAll('[data-f]').forEach(function (inp) {
      var f = inp.getAttribute('data-f');
      if (f === 'tier') return;
      if (inp.type === 'checkbox') { inp.checked = k[f] !== false; return; }
      var v = k[f];
      if (f === 'maxChars' || f === 'minIntervalMs' || f === 'maxRequestsPerDay') {
        inp.placeholder = prov[f] !== undefined ? String(prov[f]) : (f === 'maxRequestsPerDay' ? '0' : '');
      }
      if (f === 'baseUrl') inp.placeholder = DDT.PROVIDERS.ollama.base;
      if (f === 'modelEasy') inp.placeholder = isOllama ? 'qwen3:8b' : '';
      inp.value = v === undefined || v === null ? '' : v;
    });
    card.querySelector('[data-a=up]').disabled = index === 0;
    card.querySelector('[data-a=down]').disabled = index === keys.length - 1;
    if (k.tier === 'paid' && !isOllama) fillPaidState(card, k);
    fillCardState(card, k);
  }

  function renderKeys(focusId, focusAction) {
    var list = $('keyList');
    list.textContent = '';
    var tpl = $('keyTpl');
    keys.forEach(function (k, i) {
      var frag = tpl.content.cloneNode(true);
      var card = frag.querySelector('.keycard');
      card.setAttribute('data-id', k.id);
      card.setAttribute('aria-label', (k.label || providerLabel(k.provider)));
      DDT.localizePage(card);
      UI.fillIcons(card);
      fillCard(card, k, i);
      bindCard(card, k);
      list.appendChild(frag);
    });
    $('keysEmpty').hidden = keys.length > 0;
    $('addGroup').hidden = keys.length === 0;
    if (focusId) {
      var c = list.querySelector('[data-id="' + focusId + '"]');
      if (c) {
        var b = focusAction && c.querySelector('[data-a=' + focusAction + ']');
        if (b && b.disabled) b = c.querySelector('[data-a=' + (focusAction === 'up' ? 'down' : 'up') + ']');
        if (b && !b.disabled) b.focus();
      }
    }
  }

  /* Après une suppression, le focus ne doit pas retomber sur <body> : carte suivante, sinon le
     bouton d'ajout visible (sous la liste, ou celui de l'écran « aucune clé »). */
  function focusAfterDelete(index) {
    var next = $('keyList').querySelectorAll('.keycard')[index];
    if (next) {
      next.setAttribute('tabindex', '-1');
      next.focus();
      return;
    }
    var add = !$('addGroup').hidden ? $('addKeyBtn') : $('emptyAdd');
    if (add) add.focus();
  }

  function setResult(card, kind, text) {
    var res = card.querySelector('.kc-result');
    res.hidden = false;
    res.className = 'kc-result ' + (kind || '');
    UI.setOnly(res, kind === 'busy' ? UI.spinner() : UI.icon(kind === 'ok' ? 'check' : 'error'));
    res.appendChild(el('span', null, text));
  }

  function bindCard(card, k) {
    card.addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-f');
      if (!f || f === 'tier') return;
      if (e.target.type === 'checkbox') k[f] = e.target.checked;
      else if (e.target.type === 'number') {
        var num = numberValue(e.target);
        markInvalid(e.target, num.ok ? '' : (e.target.validationMessage || t('errUnknown')));
        if (!num.ok) return;   // jamais de prix, de plafond ou de limite négatifs enregistrés
        k[f] = num.value;
      } else if (f === 'baseUrl') {
        var url = ollamaUrl(e.target.value);
        markInvalid(e.target, url.ok ? '' : t('optUrlInvalid'));
        if (!url.ok) return;
        k[f] = url.value;
      } else k[f] = e.target.value.trim();
      if (f === 'label') card.setAttribute('aria-label', k.label || providerLabel(k.provider));
      if (f === 'priceIn' || f === 'priceOut' || f === 'dailyCap') fillPaidState(card, k);
      saveKeys(k.id);
    });
    card.addEventListener('change', function (e) {
      var f = e.target.getAttribute('data-f');
      // Fin de saisie : la valeur refusée est signalée (message du navigateur), l'adresse est nettoyée
      if (e.target.getAttribute('aria-invalid') === 'true') {
        if (e.target.reportValidity) e.target.reportValidity();
        return;
      }
      if (f === 'baseUrl' && e.target.value.trim() && e.target.value !== k.baseUrl) e.target.value = k.baseUrl;
      if (f !== 'tier' || !e.target.checked) return;
      k.tier = e.target.value;
      card.querySelector('.f-paid').hidden = k.tier !== 'paid';
      if (k.tier === 'paid') fillPaidState(card, k);
      fillMeta(card, k, keys.indexOf(k));
      saveKeys(k.id);
    });
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]');
      if (!b) return;
      e.preventDefault();
      var a = b.getAttribute('data-a');
      var i = keys.indexOf(k);
      if (a === 'show') {
        var inp = card.querySelector('[data-f=key]');
        var hidden = TEXT_MASK ? inp.classList.contains('masked') : inp.type === 'password';
        if (TEXT_MASK) inp.classList.toggle('masked', !hidden);
        else {
          if (document.activeElement === inp) hidden = !inp.dataset.shown;
          inp.type = hidden ? 'text' : 'password';
          if (hidden) inp.dataset.shown = '1'; else delete inp.dataset.shown;
        }
        var lbl = hidden ? t('optHide') : t('optShow');
        b.setAttribute('aria-label', lbl);
        b.setAttribute('title', lbl);
        b.setAttribute('aria-pressed', String(hidden));
      } else if (a === 'del') {
        if (!confirm(t('optDeleteConfirm'))) return;
        keys.splice(i, 1);
        saveKeys(null, true);
        renderKeys();
        focusAfterDelete(i);
      } else if (a === 'up' && i > 0) {
        keys.splice(i - 1, 0, keys.splice(i, 1)[0]); saveKeys(null, true); renderKeys(k.id, 'up');
      } else if (a === 'down' && i < keys.length - 1) {
        keys.splice(i + 1, 0, keys.splice(i, 1)[0]); saveKeys(null, true); renderKeys(k.id, 'down');
      } else if (a === 'models' || a === 'test') {
        var perm = Promise.resolve(true);
        if (k.provider === 'ollama') {
          var url = ollamaUrl(card.querySelector('[data-f=baseUrl]').value);
          if (!url.ok) { setResult(card, 'err', t('optUrlInvalid')); return; }
          // Ollama ailleurs que sur localhost:11434 : permission pour cette origine, demandée tout de
          // suite (geste utilisateur, avant tout await : obligatoire dans Firefox).
          var origin = url.origin || new URL(DDT.PROVIDERS.ollama.base).origin;
          if (!isDefaultOllama(origin) && api.permissions && api.permissions.request) {
            perm = api.permissions.request({ origins: [origin + '/*'] }).catch(function () { return false; });
          }
        }
        setResult(card, 'busy', t('optWorking'));
        b.disabled = true;
        perm.then(function (ok) {
          if (!ok) { b.disabled = false; setResult(card, 'err', t('optOllamaPermDenied', [origin])); return null; }
          return send({ type: a === 'test' ? 'testKey' : 'listModels', draft: k });
        }).then(function (r) {
          if (r === null) return;
          b.disabled = false;
          if (!r || !r.ok) {
            var msg = (r && r.message) || t('errUnknown');
            setResult(card, 'err', msg);
            UI.toast('error', (k.label || providerLabel(k.provider)) + ' : ' + msg);
            return;
          }
          var models = r.models || [];
          var dl = card.querySelector('datalist');
          dl.textContent = '';
          models.forEach(function (m) {
            if (k.provider === 'openrouter' && k.tier !== 'paid' && !/:free$/.test(m.id)) return;
            var o = document.createElement('option');
            o.value = m.id;
            if (m.free) o.label = m.id + ' (' + t('tier_free') + ')';
            dl.appendChild(o);
          });
          setResult(card, 'ok', a === 'test' ? t(k.provider === 'ollama' ? 'optTestOkLocal' : 'optTestOk', [models.length]) : t('optModelsLoaded', [dl.children.length]));
        }, function (err) {
          b.disabled = false;
          var msg = String(err && err.message || err);
          setResult(card, 'err', msg);
          UI.toast('error', msg);
        });
      }
    });
  }

  function addKey(p) {
    var k = { id: uid(), provider: p, label: providerLabel(p), key: '', tier: p === 'ollama' ? 'local' : 'free', enabled: true, modelEasy: '', modelHard: '' };
    if (p === 'ollama') {
      k.baseUrl = DDT.PROVIDERS.ollama.base;
      // Geste utilisateur : la demande de permission part avant tout await.
      api.permissions.request({ origins: DDT.OLLAMA_ORIGINS }).catch(function () { return false; });
    }
    keys.push(k);
    saveKeys(null, true);
    renderKeys();
    var card = $('keyList').querySelector('[data-id="' + k.id + '"]');
    if (card) {
      card.classList.add('enter');
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      var first = card.querySelector(p === 'ollama' ? '[data-f=modelEasy]' : '[data-f=key]');
      if (first) first.focus({ preventScroll: true });
    }
  }
  $('addKeyBtn').addEventListener('click', function () { addKey($('newProvider').value); });
  $('emptyAdd').addEventListener('click', function () { addKey($('emptyProvider').value); });

  function refreshPublic() {
    return send({ type: 'getState' }).then(function (s) {
      publicKeys = {};
      ((s && s.keys) || []).forEach(function (k) { publicKeys[k.id] = k; });
      document.querySelectorAll('.keycard').forEach(function (card) {
        var k = keys.filter(function (x) { return x.id === card.getAttribute('data-id'); })[0];
        if (k) fillCardState(card, k);
      });
      if (current === 'privacy') renderUsage(s);
    }).catch(function () { /* rien */ });
  }

  /* ---------------- Traduction ---------------- */
  function renderSettings() {
    var sel = $('target');
    sel.textContent = '';
    var autoOpt = el('option', null, t('optTargetAuto', [DDT.languageName(DDT.resolveTarget('auto'))]));
    autoOpt.value = 'auto';
    sel.appendChild(autoOpt);
    Object.keys(DDT.TARGETS).map(function (code) { return { code: code, name: DDT.languageName(code) }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (l) {
        var o = el('option', null, l.name);
        o.value = l.code;
        sel.appendChild(o);
      });
    sel.value = settings.target;
    document.querySelectorAll('input[name=mode]').forEach(function (r) { r.checked = r.value === settings.mode; });
    document.querySelectorAll('input[name=theme]').forEach(function (r) { r.checked = r.value === (settings.theme || 'system'); });
    $('explainTerms').checked = !!settings.explainTerms;
    $('translateComments').checked = !!settings.translateComments;
    $('pageCap').value = settings.pageCap;
    $('voiceRate').value = String(DDT.clampVoiceRate(settings.voiceRate));
    renderVoiceRate();
    var pats = $('sensitiveBase');
    pats.textContent = '';
    DDT.DEFAULT_SENSITIVE.forEach(function (p) { pats.appendChild(el('span', 'pat', p)); });
    $('sensitiveExtra').value = (settings.sensitiveExtra || []).join('\n');
  }
  $('target').addEventListener('change', function (e) { saveSettings({ target: e.target.value }); });
  document.querySelectorAll('input[name=mode]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) saveSettings({ mode: r.value }); });
  });
  $('explainTerms').addEventListener('change', function (e) { saveSettings({ explainTerms: e.target.checked }); });
  $('translateComments').addEventListener('change', function (e) { saveSettings({ translateComments: e.target.checked }); });
  $('pageCap').addEventListener('change', function (e) {
    var v = Math.max(10000, Number(e.target.value) || DDT.DEFAULT_SETTINGS.pageCap);
    e.target.value = v;
    saveSettings({ pageCap: v });
  });
  /* Vitesse de la voix traduite : 0,5 à 2, pas de 0,1 ; appliquée tout de suite à la vidéo en cours
     (la voix lit le réglage à chaque changement du stockage) */
  function renderVoiceRate() {
    var v = DDT.clampVoiceRate($('voiceRate').value);
    var label = DDT.formatVoiceRate(v);
    $('voiceRateOut').textContent = label;
    $('voiceRate').setAttribute('aria-valuetext', label);
  }
  var rateTimer = null;
  $('voiceRate').addEventListener('input', function () {
    renderVoiceRate();
    // enregistré pendant le glissement, sans écrire à chaque pixel
    if (rateTimer) clearTimeout(rateTimer);
    rateTimer = setTimeout(function () { rateTimer = null; saveSettings({ voiceRate: DDT.clampVoiceRate($('voiceRate').value) }); }, 250);
  });
  $('voiceRate').addEventListener('change', function () {
    if (rateTimer) { clearTimeout(rateTimer); rateTimer = null; }
    renderVoiceRate();
    saveSettings({ voiceRate: DDT.clampVoiceRate($('voiceRate').value) });
  });
  $('sensitiveExtra').addEventListener('change', function (e) {
    saveSettings({ sensitiveExtra: e.target.value.split(/\n+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean) });
  });

  function renderShortcut() {
    var box = $('shortcutKeys');
    var isFirefox = /^moz-extension:/.test(location.protocol + '');
    $('shortcutWhere').textContent = isFirefox ? t('optShortcutWhereFirefox') : t('optShortcutWhereChrome');
    function none() { box.textContent = ''; box.appendChild(makeChip('', 'off', t('optShortcutNone'))); }
    if (!api.commands || !api.commands.getAll) { none(); return; }
    api.commands.getAll().then(function (cmds) {
      var c = (cmds || []).filter(function (x) { return x.name === 'toggle-translation'; })[0];
      if (!c || !c.shortcut) { none(); return; }
      box.textContent = '';
      box.setAttribute('aria-label', t('optShortcutCurrent', [c.shortcut]));
      c.shortcut.split('+').forEach(function (key) { box.appendChild(el('kbd', null, key)); });
    }).catch(none);
  }

  /* ---------------- Apparence ---------------- */
  document.querySelectorAll('input[name=theme]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      UI.applyTheme(r.value);           // immédiat, sans attendre le stockage
      saveSettings({ theme: r.value });
    });
  });

  /* ---------------- Confidentialité et coûts ---------------- */
  function renderNotes() {
    var g = $('notesGroup');
    g.querySelectorAll('.line').forEach(function (l) { l.remove(); });
    var used = {};
    keys.forEach(function (k) { used[k.provider] = true; });
    PROVIDER_ORDER.forEach(function (p) {
      var line = el('div', 'line note-line');
      var who = el('div', 'who');
      who.appendChild(el('span', 'mono-badge', MONO[p]));
      who.lastChild.setAttribute('aria-hidden', 'true');
      who.appendChild(el('b', null, providerLabel(p)));
      line.appendChild(who);
      var txt = el('p', null, t(WARN[p]));
      line.appendChild(txt);
      if (used[p]) who.appendChild(makeChip('info', 'key', t('optProviderUsed')));
      g.appendChild(line);
    });
  }

  function renderUsage(s) {
    var g = $('usageGroup');
    g.querySelectorAll('.line, .empty').forEach(function (l) { l.remove(); });
    var list = (s && s.keys) || [];
    if (!list.length) {
      var line = el('div', 'line');
      line.appendChild(el('p', 'help', t('optUsageEmpty')));
      g.appendChild(line);
      return;
    }
    list.forEach(function (k) {
      var line = el('div', 'line usage-line');
      var txt = el('div', 'txt');
      var b = el('b', null, k.label);
      b.appendChild(makeChip(k.tier === 'paid' ? 'warn' : k.tier === 'local' ? 'ok' : '', k.tier === 'paid' ? 'coin' : k.tier === 'local' ? 'cpu' : 'key', t('tier_' + k.tier)));
      txt.appendChild(b);
      txt.appendChild(el('span', null, providerLabel(k.provider)));
      line.appendChild(txt);
      var ctl = el('div', 'ctl');
      if (k.maxPerDay) {
        var pct = Math.min(100, Math.round(k.requests / k.maxPerDay * 100));
        var bar = el('div', 'progress meter');
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', String(k.maxPerDay));
        bar.setAttribute('aria-valuenow', String(k.requests));
        bar.setAttribute('aria-label', k.label);
        var fill = el('i');
        fill.style.width = pct + '%';
        bar.appendChild(fill);
        ctl.appendChild(bar);
      }
      ctl.appendChild(el('span', 'usage-val', t('optUsageLine', [k.requests, k.maxPerDay ? ' / ' + k.maxPerDay : '', k.tier === 'paid' ? ' · ~' + (k.cost || 0).toFixed(4) + ' $' : ''])));
      line.appendChild(ctl);
      g.appendChild(line);
    });
  }
  function refreshUsage() { send({ type: 'getState' }).then(renderUsage).catch(function () { /* rien */ }); }

  /* ---------------- Glossaire ---------------- */
  function renderGlossary() {
    var body = $('glossBody');
    body.textContent = '';
    glossary.forEach(function (g, i) {
      var row = el('div', 'gl-row');
      var term = el('input');
      term.type = 'text'; term.value = g.term || ''; term.spellcheck = false;
      term.setAttribute('data-k', 'term');
      term.setAttribute('aria-label', t('optGlTerm'));
      term.addEventListener('change', function () { g.term = term.value.trim(); saveGlossary(); });
      var sel = el('select');
      sel.setAttribute('aria-label', t('optGlType'));
      ['never', 'always'].forEach(function (v) { var o = el('option', null, t('gl_' + v)); o.value = v; sel.appendChild(o); });
      sel.value = g.type || 'never';
      var tr = el('input');
      tr.type = 'text'; tr.value = g.translation || ''; tr.disabled = sel.value !== 'always';
      tr.setAttribute('aria-label', t('optGlTranslation'));
      tr.addEventListener('change', function () { g.translation = tr.value.trim(); saveGlossary(); });
      sel.addEventListener('change', function () { g.type = sel.value; tr.disabled = sel.value !== 'always'; saveGlossary(); if (!tr.disabled) tr.focus(); });
      var del = el('button', 'btn small icon ghost danger');
      UI.setOnly(del, UI.icon('trash'));
      del.setAttribute('aria-label', t('optDelete') + (g.term ? ' : ' + g.term : ''));
      del.title = t('optDelete');
      del.addEventListener('click', function () { glossary.splice(i, 1); saveGlossary(); renderGlossary(); });
      row.appendChild(term); row.appendChild(sel); row.appendChild(tr); row.appendChild(del);
      body.appendChild(row);
    });
    $('glEmpty').hidden = glossary.length > 0;
    document.querySelector('.gl-head').hidden = glossary.length === 0;
    $('glCount').textContent = t('optGlCount', [glossary.length]);
    $('glAdd').disabled = glossary.length >= 500;
    $('glExport').disabled = !glossary.some(function (g) { return g.term; });
  }
  $('glAdd').addEventListener('click', function () {
    if (glossary.length >= 500) return;
    glossary.push({ term: '', type: 'never', translation: '' });
    renderGlossary();
    var inputs = $('glossBody').querySelectorAll('.gl-row:last-child input');
    if (inputs[0]) inputs[0].focus();
  });
  $('glExport').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(glossary.filter(function (g) { return g.term; }), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'devdoctrad-glossaire.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $('glImportBtn').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('glImport').click(); }
  });
  $('glImport').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    f.text().then(function (txt) {
      var data = JSON.parse(txt);
      if (!Array.isArray(data)) throw new Error('format');
      var n = 0;
      data.forEach(function (g) {
        if (!g || typeof g.term !== 'string' || !g.term.trim()) return;
        var type = g.type === 'always' ? 'always' : 'never';
        var existing = glossary.filter(function (x) { return x.term.toLowerCase() === g.term.trim().toLowerCase(); })[0];
        var entry = { term: g.term.trim(), type: type, translation: type === 'always' ? String(g.translation || '') : '' };
        if (existing) { Object.assign(existing, entry); n++; } else if (glossary.length < 500) { glossary.push(entry); n++; }
      });
      return saveGlossary().then(function () {
        renderGlossary();
        UI.toast('success', t('optGlImported', [n]));
      });
    }).catch(function () { UI.toast('error', t('optGlImportError')); });
    e.target.value = '';
  });

  /* ---------------- Sites ---------------- */
  function refreshSites() {
    send({ type: 'autoSites' }).then(function (list) {
      var box = $('autoList');
      box.textContent = '';
      if (!list || !list.length) {
        var empty = el('div', 'empty inline');
        var ic = el('span', 'empty-icon');
        UI.setOnly(ic, UI.icon('globe'));
        empty.appendChild(ic);
        empty.appendChild(el('h3', null, t('optAutoEmptyTitle')));
        empty.appendChild(el('p', 'help', t('optAutoEmptyLong')));
        box.appendChild(empty);
        return;
      }
      list.forEach(function (s) {
        var line = el('div', 'line site-line');
        var host = el('div', 'host');
        host.appendChild(iconEl('globe'));
        host.appendChild(el('span', null, s.host));
        line.appendChild(host);
        var ctl = el('div', 'ctl');
        ctl.appendChild(s.granted ? makeChip('ok', 'check', t('optAutoGranted')) : makeChip('warn', 'alert', t('optAutoRevoked')));
        var del = el('button', 'btn small danger');
        UI.setOnly(del, UI.icon('trash'));
        del.appendChild(el('span', null, t('optDelete')));
        del.setAttribute('aria-label', t('optDelete') + ' : ' + s.host);
        del.addEventListener('click', function () {
          if (!confirm(t('optAutoRemoveConfirm', [s.host]))) return;
          send({ type: 'removeAutoSite', host: s.host }).then(function () {
            settings.autoSites = (settings.autoSites || []).filter(function (h) { return h !== s.host; });
            UI.toast('info', t('toastAutoOff', [s.host]));
            refreshSites();
          });
        });
        ctl.appendChild(del);
        line.appendChild(ctl);
        box.appendChild(line);
      });
    });
  }

  /* ---------------- Données ---------------- */
  function refreshData() {
    send({ type: 'cacheInfo' }).then(function (c) {
      $('cacheInfo').textContent = t('optCacheInfo', [c.entries, (c.bytes / 1048576).toFixed(2)]);
      $('clearCache').disabled = !c.entries;
    }).catch(function () { /* rien */ });
  }
  $('clearCache').addEventListener('click', function () {
    if (!confirm(t('optCacheConfirm'))) return;
    send({ type: 'clearCache' }).then(function () {
      UI.toast('success', t('optCacheCleared'));
      refreshData();
    });
  });

  /* ---------------- Chargement ---------------- */
  show(location.hash.slice(1));
  api.storage.local.get(['keys', 'settings', 'glossary']).then(function (r) {
    keys = (r.keys || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    settings = Object.assign({}, DDT.DEFAULT_SETTINGS, r.settings || {});
    glossary = r.glossary || [];
    renderKeys();
    renderSettings();
    renderGlossary();
    renderShortcut();
    checkApiPerms();
    if (current === 'privacy') renderNotes();
    refreshPublic();
  });
  setInterval(refreshPublic, 5000);
})();
