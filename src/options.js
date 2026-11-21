/* DevDocTrad - options.js. Licence MIT. */
(function () {
  'use strict';
  var DDT = window.DDT;
  var api = DDT.api;
  var t = DDT.t;
  var $ = function (id) { return document.getElementById(id); };

  var keys = [];
  var settings = Object.assign({}, DDT.DEFAULT_SETTINGS);
  var glossary = [];
  var publicKeys = {};
  var saveTimer = null;

  DDT.localizePage(document);

  function send(msg) { return api.runtime.sendMessage(msg); }
  function uid() { return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function flashSaved() {
    var s = $('saved');
    s.textContent = t('optSaved');
    clearTimeout(flashSaved.tm);
    flashSaved.tm = setTimeout(function () { s.textContent = ''; }, 1500);
  }
  function saveKeys() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      keys.forEach(function (k, i) { k.order = i; });
      api.storage.local.set({ keys: keys }).then(function () {
        keys.forEach(function (k) { send({ type: 'resetKey', keyId: k.id }); });
        flashSaved();
        refreshPublic();
      });
    }, 400);
  }
  function saveSettings() {
    return api.storage.local.set({ settings: settings }).then(flashSaved);
  }
  function saveGlossary() {
    return api.storage.local.set({ glossary: glossary }).then(flashSaved);
  }

  /* ---------------- Onglets ---------------- */
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('hidden', p.id !== 'tab-' + b.getAttribute('data-tab')); });
      if (b.getAttribute('data-tab') === 'data') refreshData();
      if (b.getAttribute('data-tab') === 'sites') refreshSites();
    });
  });

  /* ---------------- Permissions des API (Firefox MV3) ---------------- */
  function checkApiPerms() {
    if (!api.permissions || !api.permissions.contains) return;
    api.permissions.contains({ origins: DDT.API_ORIGINS }).then(function (ok) {
      $('permBanner').classList.toggle('hidden', !!ok);
    }).catch(function () { /* rien */ });
  }
  $('grantApi').addEventListener('click', function () {
    api.permissions.request({ origins: DDT.API_ORIGINS }).then(checkApiPerms);
  });

  /* ---------------- Clés ---------------- */
  function warnFor(k) {
    if (k.provider === 'gemini') return t('warnGemini');
    if (k.provider === 'groq') return t('warnGroq');
    if (k.provider === 'mistral') return t('warnMistral');
    if (k.provider === 'openrouter') return t('warnOpenRouter');
    if (k.provider === 'ollama') return t('warnOllama');
    return '';
  }

  function fillCard(card, k, index) {
    var isOllama = k.provider === 'ollama';
    card.querySelector('.prov').textContent = DDT.PROVIDERS[k.provider].label;
    card.querySelector('.warnline').textContent = warnFor(k);
    card.querySelector('.keyfield').classList.toggle('hidden', isOllama);
    card.querySelector('.urlfield').classList.toggle('hidden', !isOllama);
    card.querySelector('.tierfield').classList.toggle('hidden', isOllama);
    card.querySelector('.paid').classList.toggle('hidden', k.tier !== 'paid' || isOllama);
    var dl = card.querySelector('datalist');
    dl.id = 'models-' + k.id;
    card.querySelector('[data-f=modelEasy]').setAttribute('list', dl.id);
    card.querySelector('[data-f=modelHard]').setAttribute('list', dl.id);
    var radios = card.querySelectorAll('[data-f=tier]');
    radios.forEach(function (r) { r.name = 'tier-' + k.id; r.checked = (k.tier || 'free') === r.value; });
    card.querySelectorAll('[data-f]').forEach(function (inp) {
      var f = inp.getAttribute('data-f');
      if (f === 'tier') return;
      if (inp.type === 'checkbox') inp.checked = k[f] !== false;
      else {
        var v = k[f];
        if ((v === undefined || v === '') && DDT.PROVIDERS[k.provider]) {
          if (f === 'maxChars' || f === 'minIntervalMs' || f === 'maxRequestsPerDay') {
            inp.placeholder = String(DDT.PROVIDERS[k.provider][f] !== undefined ? DDT.PROVIDERS[k.provider][f] : '');
          }
          if (f === 'baseUrl') inp.placeholder = DDT.PROVIDERS.ollama.base;
        }
        inp.value = v === undefined || v === null ? '' : v;
      }
    });
    card.querySelector('[data-a=up]').disabled = index === 0;
    card.querySelector('[data-a=down]').disabled = index === keys.length - 1;
    var st = card.querySelector('.state');
    var pk = publicKeys[k.id];
    st.className = 'state pill';
    if (!pk) st.textContent = '';
    else if (!pk.enabled) st.textContent = t('keyDisabled');
    else if (!pk.configured) { st.textContent = t('keyNoModel'); st.className += ' warn'; }
    else if (pk.available) { st.textContent = t('keyAvailable'); st.className += ' ok'; }
    else if (pk.until) { st.textContent = t('keyPausedUntil', [new Date(pk.until).toLocaleTimeString().slice(0, 5)]); st.className += ' warn'; }
    else { st.textContent = t('keyProblem'); st.className += ' bad'; }
  }

  function renderKeys() {
    var list = $('keyList');
    list.textContent = '';
    var tpl = $('keyTpl');
    keys.forEach(function (k, i) {
      var frag = tpl.content.cloneNode(true);
      var card = frag.querySelector('.keycard');
      card.setAttribute('data-id', k.id);
      DDT.localizePage(card);
      fillCard(card, k, i);
      bindCard(card, k);
      list.appendChild(frag);
    });
  }

  function bindCard(card, k) {
    card.addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-f');
      if (!f) return;
      if (f === 'tier') { k.tier = e.target.value; fillCard(card, k, keys.indexOf(k)); }
      else if (e.target.type === 'checkbox') k[f] = e.target.checked;
      else if (e.target.type === 'number') k[f] = e.target.value === '' ? '' : Number(e.target.value);
      else k[f] = e.target.value.trim();
      saveKeys();
    });
    card.addEventListener('change', function (e) {
      if (e.target.getAttribute('data-f') === 'tier') { k.tier = e.target.value; fillCard(card, k, keys.indexOf(k)); saveKeys(); }
    });
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]');
      if (!b) return;
      e.preventDefault();
      var a = b.getAttribute('data-a');
      var res = card.querySelector('.result');
      var i = keys.indexOf(k);
      if (a === 'show') {
        var inp = card.querySelector('[data-f=key]');
        inp.type = inp.type === 'password' ? 'text' : 'password';
        b.textContent = inp.type === 'password' ? t('optShow') : t('optHide');
      } else if (a === 'del') {
        if (!confirm(t('optDeleteConfirm'))) return;
        keys.splice(i, 1);
        saveKeys();
        renderKeys();
      } else if (a === 'up' && i > 0) {
        keys.splice(i - 1, 0, keys.splice(i, 1)[0]); saveKeys(); renderKeys();
      } else if (a === 'down' && i < keys.length - 1) {
        keys.splice(i + 1, 0, keys.splice(i, 1)[0]); saveKeys(); renderKeys();
      } else if (a === 'models' || a === 'test') {
        res.className = 'result muted';
        res.textContent = t('optWorking');
        send({ type: a === 'test' ? 'testKey' : 'listModels', draft: k }).then(function (r) {
          if (!r || !r.ok) {
            res.className = 'result bad';
            res.textContent = (r && r.message) || t('errUnknown');
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
          res.className = 'result ok';
          res.textContent = a === 'test' ? t('optTestOk', [models.length]) : t('optModelsLoaded', [dl.children.length]);
        }, function (err) {
          res.className = 'result bad';
          res.textContent = String(err && err.message || err);
        });
      }
    });
  }

  $('addKeyBtn').addEventListener('click', function () {
    var p = $('newProvider').value;
    var k = { id: uid(), provider: p, label: DDT.PROVIDERS[p].label, key: '', tier: p === 'ollama' ? 'local' : 'free', enabled: true, modelEasy: '', modelHard: '' };
    if (p === 'ollama') {
      k.baseUrl = DDT.PROVIDERS.ollama.base;
      // Geste utilisateur : la demande de permission part avant tout await.
      api.permissions.request({ origins: DDT.OLLAMA_ORIGINS }).catch(function () { return false; });
    }
    keys.push(k);
    saveKeys();
    renderKeys();
  });

  function refreshPublic() {
    return send({ type: 'getState' }).then(function (s) {
      publicKeys = {};
      ((s && s.keys) || []).forEach(function (k) { publicKeys[k.id] = k; });
      document.querySelectorAll('.keycard').forEach(function (card) {
        var k = keys.filter(function (x) { return x.id === card.getAttribute('data-id'); })[0];
        if (k) fillCardState(card, k);
      });
    }).catch(function () { /* rien */ });
  }
  function fillCardState(card, k) {
    var st = card.querySelector('.state');
    var pk = publicKeys[k.id];
    st.className = 'state pill';
    if (!pk) { st.textContent = ''; return; }
    if (!pk.enabled) st.textContent = t('keyDisabled');
    else if (!pk.configured) { st.textContent = t('keyNoModel'); st.className += ' warn'; }
    else if (pk.available) { st.textContent = t('keyAvailable'); st.className += ' ok'; }
    else if (pk.until) { st.textContent = t('keyPausedUntil', [new Date(pk.until).toLocaleTimeString().slice(0, 5)]); st.className += ' warn'; }
    else { st.textContent = t('keyProblem'); st.className += ' bad'; }
  }

  /* ---------------- Traduction ---------------- */
  function renderSettings() {
    var sel = $('target');
    sel.textContent = '';
    var autoOpt = document.createElement('option');
    autoOpt.value = 'auto';
    autoOpt.textContent = t('optTargetAuto', [DDT.languageName(DDT.resolveTarget('auto'))]);
    sel.appendChild(autoOpt);
    Object.keys(DDT.TARGETS).map(function (code) { return { code: code, name: DDT.languageName(code) }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (l) {
        var o = document.createElement('option');
        o.value = l.code;
        o.textContent = l.name;
        sel.appendChild(o);
      });
    sel.value = settings.target;
    document.querySelectorAll('input[name=mode]').forEach(function (r) { r.checked = r.value === settings.mode; });
    $('explainTerms').checked = !!settings.explainTerms;
    $('translateComments').checked = !!settings.translateComments;
    $('pageCap').value = settings.pageCap;
    $('sensitiveBase').textContent = DDT.DEFAULT_SENSITIVE.join(', ');
    $('sensitiveExtra').value = (settings.sensitiveExtra || []).join('\n');
  }
  $('target').addEventListener('change', function (e) { settings.target = e.target.value; saveSettings(); });
  document.querySelectorAll('input[name=mode]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) { settings.mode = r.value; saveSettings(); } });
  });
  $('explainTerms').addEventListener('change', function (e) { settings.explainTerms = e.target.checked; saveSettings(); });
  $('translateComments').addEventListener('change', function (e) { settings.translateComments = e.target.checked; saveSettings(); });
  $('pageCap').addEventListener('change', function (e) {
    settings.pageCap = Math.max(10000, Number(e.target.value) || DDT.DEFAULT_SETTINGS.pageCap);
    e.target.value = settings.pageCap;
    saveSettings();
  });
  $('sensitiveExtra').addEventListener('change', function (e) {
    settings.sensitiveExtra = e.target.value.split(/\n+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    saveSettings();
  });

  function renderShortcut() {
    var el = $('shortcutInfo');
    var isFirefox = typeof browser !== 'undefined';
    var where = isFirefox ? t('optShortcutWhereFirefox') : t('optShortcutWhereChrome');
    if (!api.commands || !api.commands.getAll) { el.textContent = where; return; }
    api.commands.getAll().then(function (cmds) {
      var c = (cmds || []).filter(function (x) { return x.name === 'toggle-translation'; })[0];
      el.textContent = t('optShortcutCurrent', [(c && c.shortcut) || t('optShortcutNone')]) + ' ' + where;
    }).catch(function () { el.textContent = where; });
  }

  /* ---------------- Glossaire ---------------- */
  function renderGlossary() {
    var body = $('glossBody');
    body.textContent = '';
    glossary.forEach(function (g, i) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      var term = document.createElement('input');
      term.type = 'text'; term.value = g.term || ''; term.spellcheck = false;
      term.addEventListener('change', function () { g.term = term.value.trim(); saveGlossary(); });
      td1.appendChild(term);
      var td2 = document.createElement('td');
      var sel = document.createElement('select');
      ['never', 'always'].forEach(function (v) {
        var o = document.createElement('option'); o.value = v; o.textContent = t('gl_' + v); sel.appendChild(o);
      });
      sel.value = g.type || 'never';
      td2.appendChild(sel);
      var td3 = document.createElement('td');
      var tr3 = document.createElement('input');
      tr3.type = 'text'; tr3.value = g.translation || ''; tr3.disabled = sel.value !== 'always';
      tr3.addEventListener('change', function () { g.translation = tr3.value.trim(); saveGlossary(); });
      sel.addEventListener('change', function () { g.type = sel.value; tr3.disabled = sel.value !== 'always'; saveGlossary(); });
      td3.appendChild(tr3);
      var td4 = document.createElement('td');
      var del = document.createElement('button');
      del.className = 'btn small danger'; del.textContent = t('optDelete');
      del.addEventListener('click', function () { glossary.splice(i, 1); saveGlossary(); renderGlossary(); });
      td4.appendChild(del);
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
      body.appendChild(tr);
    });
  }
  $('glAdd').addEventListener('click', function () {
    if (glossary.length >= 500) return;
    glossary.push({ term: '', type: 'never', translation: '' });
    renderGlossary();
    var inputs = $('glossBody').querySelectorAll('tr:last-child input');
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
  $('glImport').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    f.text().then(function (txt) {
      var data = JSON.parse(txt);
      if (!Array.isArray(data)) throw new Error('format');
      data.forEach(function (g) {
        if (!g || typeof g.term !== 'string' || !g.term.trim()) return;
        var type = g.type === 'always' ? 'always' : 'never';
        var existing = glossary.filter(function (x) { return x.term.toLowerCase() === g.term.trim().toLowerCase(); })[0];
        var entry = { term: g.term.trim(), type: type, translation: type === 'always' ? String(g.translation || '') : '' };
        if (existing) Object.assign(existing, entry); else if (glossary.length < 500) glossary.push(entry);
      });
      saveGlossary();
      renderGlossary();
    }).catch(function () { alert(t('optGlImportError')); });
    e.target.value = '';
  });

  /* ---------------- Sites et données ---------------- */
  function refreshSites() {
    send({ type: 'autoSites' }).then(function (list) {
      var ul = $('autoList');
      ul.textContent = '';
      if (!list || !list.length) {
        var li = document.createElement('li');
        li.className = 'muted';
        li.textContent = t('optAutoEmpty');
        ul.appendChild(li);
        return;
      }
      list.forEach(function (s) {
        var li = document.createElement('li');
        var name = document.createElement('span');
        name.textContent = s.host;
        var right = document.createElement('span');
        right.className = 'row';
        var pill = document.createElement('span');
        pill.className = 'pill ' + (s.granted ? 'ok' : 'warn');
        pill.textContent = s.granted ? t('optAutoGranted') : t('optAutoRevoked');
        var del = document.createElement('button');
        del.className = 'btn small danger';
        del.textContent = t('optDelete');
        del.addEventListener('click', function () {
          send({ type: 'removeAutoSite', host: s.host }).then(function () {
            settings.autoSites = settings.autoSites.filter(function (h) { return h !== s.host; });
            refreshSites();
          });
        });
        right.appendChild(pill);
        right.appendChild(del);
        li.appendChild(name);
        li.appendChild(right);
        ul.appendChild(li);
      });
    });
  }

  function refreshData() {
    send({ type: 'cacheInfo' }).then(function (c) {
      $('cacheInfo').textContent = t('optCacheInfo', [c.entries, (c.bytes / 1048576).toFixed(2)]);
    });
    send({ type: 'getState' }).then(function (s) {
      var ul = $('usageList');
      ul.textContent = '';
      ((s && s.keys) || []).forEach(function (k) {
        var li = document.createElement('li');
        var a = document.createElement('span');
        a.textContent = k.label + ' · ' + t('tier_' + k.tier);
        var b = document.createElement('span');
        b.className = 'muted';
        b.textContent = t('optUsageLine', [k.requests, k.maxPerDay ? ' / ' + k.maxPerDay : '', k.tier === 'paid' ? ' · ~' + k.cost.toFixed(4) + ' $' : '']);
        li.appendChild(a);
        li.appendChild(b);
        ul.appendChild(li);
      });
    });
  }
  $('clearCache').addEventListener('click', function () {
    send({ type: 'clearCache' }).then(refreshData);
  });

  /* ---------------- Chargement ---------------- */
  api.storage.local.get(['keys', 'settings', 'glossary']).then(function (r) {
    keys = (r.keys || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    settings = Object.assign({}, DDT.DEFAULT_SETTINGS, r.settings || {});
    glossary = r.glossary || [];
    renderKeys();
    renderSettings();
    renderGlossary();
    renderShortcut();
    checkApiPerms();
    refreshPublic();
  });
  setInterval(refreshPublic, 5000);
})();
