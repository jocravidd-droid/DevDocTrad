/* DevDocTrad - popup.js. Licence MIT. */
(function () {
  'use strict';
  var DDT = window.DDT;
  var UI = window.DDT_UI;
  var api = DDT.api;
  var t = DDT.t;
  var $ = function (id) { return document.getElementById(id); };
  var tab = null;
  var host = '';
  var supported = true;
  var hasUsableKey = false;
  var lastStatus = null;
  var pollTimer = null;
  var sensitive = false;
  var MAX_KEYS = 2;   // le popup ne doit jamais dépasser 600 px de haut (barre de défilement sinon)

  DDT.localizePage(document);
  UI.fillIcons(document);
  UI.syncTheme();

  function send(msg) { return api.runtime.sendMessage(msg); }
  function fmtTime(ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function chip(el, kind, iconName, text, spin) {
    el.className = 'chip ' + (kind || '');
    el.innerHTML = spin ? '<span class="spinner" aria-hidden="true"></span>' : UI.icon(iconName);
    el.appendChild(document.createTextNode(text));
  }

  /* ---------- Clés ---------- */
  function renderKeys(state) {
    var ul = $('keys');
    ul.textContent = '';
    var sel = $('keySel');
    var current = sel.value;
    sel.textContent = '';
    var auto = document.createElement('option');
    auto.value = '';
    auto.textContent = t('popupKeyAuto');
    sel.appendChild(auto);
    hasUsableKey = false;
    state.keys.forEach(function (k, i) {
      if (k.enabled && k.configured && k.tier !== 'paid') hasUsableKey = true;
      if (i < MAX_KEYS) {
        var li = document.createElement('li');
        var name = document.createElement('span');
        name.className = 'kname';
        name.textContent = k.label;
        var small = document.createElement('small');
        small.textContent = t('tier_' + k.tier) + (k.maxPerDay ? ' · ' + k.requests + '/' + k.maxPerDay : '');
        name.appendChild(small);
        var c = document.createElement('span');
        if (!k.enabled) chip(c, '', 'off', t('keyDisabled'));
        else if (!k.configured) chip(c, 'warn', 'alert', t('keyNoModel'));
        else if (k.available) chip(c, 'ok', 'check', t('keyAvailable'));
        else if (k.until) chip(c, 'warn', 'pause', t('keyPausedUntil', [fmtTime(k.until)]));
        else chip(c, 'err', 'error', t('keyProblem'));
        li.appendChild(name);
        li.appendChild(c);
        ul.appendChild(li);
      }
      if (k.enabled && k.configured) {
        var o = document.createElement('option');
        o.value = k.id;
        o.textContent = k.label + ' (' + t('tier_' + k.tier) + ')';
        sel.appendChild(o);
      }
    });
    if (state.keys.length > MAX_KEYS) {
      var more = document.createElement('li');
      more.className = 'more';
      more.textContent = t('popupMoreKeys', [state.keys.length - MAX_KEYS]);
      ul.appendChild(more);
    }
    sel.value = current || '';
    $('noKeys').hidden = state.keys.length > 0;
  }

  /* ---------- État de la page ---------- */
  function renderStatus(st) {
    lastStatus = st;
    var c = $('stateChip');
    var hero = $('translate');
    var msg = '';
    var running = st && st.state === 'running';
    var done = st ? st.done || 0 : 0;
    var total = st ? st.total || 0 : 0;
    var showing = st ? st.showing : 'original';

    if (!st || (st.state === 'idle' && !done)) {
      if (!hasUsableKey) chip(c, 'warn', 'key', t('stateNoKey'));
      else chip(c, 'info', 'translate', t('stateReady'));
    } else if (running) chip(c, 'info', null, t('stateRunning'), true);
    else if (st.state === 'error') { chip(c, 'err', 'error', t('stateError')); msg = st.message; }
    else if (st.state === 'paused') { chip(c, 'warn', 'pause', t('statePaused')); msg = st.message; }
    else if (st.state === 'stopped') chip(c, 'warn', 'stop', t('stateStopped'));
    else if (showing === 'translated') chip(c, 'ok', 'check', t('stateTranslated'));
    else chip(c, '', 'original', t('stateOriginal'));
    if (st && st.state === 'done' && st.message && !msg) msg = st.message;
    if (st && st.state === 'done' && st.failed) msg = t('badgeDoneFailed', [done, st.failed]);
    if (st && st.via && st.state === 'done' && !msg) msg = st.via.local ? t('badgeViaLocal') : t('badgeViaOnline', [st.via.label]);

    $('count').textContent = total ? t('popupCount', [done, total]) : '';
    var pct = total ? Math.round((done + (st.failed || 0)) / total * 100) : 0;
    $('progress').querySelector('i').style.width = pct + '%';
    $('progress').setAttribute('aria-valuenow', String(pct));
    $('progress').hidden = !total;

    hero.disabled = running || !supported;
    hero.classList.toggle('busy', !!running);
    $('translateLabel').textContent = running ? t('popupTranslating') : t('popupTranslate');
    var heroIcon = hero.querySelector('[data-icon], .spinner');
    if (running && heroIcon && !heroIcon.classList.contains('spinner')) heroIcon.outerHTML = '<span class="spinner" aria-hidden="true"></span>';
    if (!running && heroIcon && heroIcon.classList.contains('spinner')) { heroIcon.outerHTML = '<span data-icon="translate"></span>'; UI.fillIcons(hero); }

    var radios = document.querySelectorAll('input[name=view]');
    radios.forEach(function (r) {
      r.disabled = !(done > 0);
      r.checked = r.value === (done > 0 ? showing : 'original');
    });
    $('stop').hidden = !running;
    $('status').textContent = msg || '';
  }

  function refreshStatus() {
    if (!tab || !supported) return;
    api.tabs.sendMessage(tab.id, { to: 'content', cmd: 'status' }).then(renderStatus, function () { renderStatus(null); });
  }

  function refreshState() {
    return send({ type: 'getState' }).then(function (state) {
      if (!state) return;
      renderKeys(state);
      renderTargets(state.settings.targetChoice || state.settings.target);
      $('autoSite').checked = (state.settings.autoSites || []).some(function (h) {
        return host === h || host.slice(-(h.length + 1)) === '.' + h;
      });
      if (!lastStatus) renderStatus(null);
    });
  }

  function cmd(c) {
    if (!tab) return;
    send({ type: 'tabCommand', tabId: tab.id, cmd: c, keyId: $('keySel').value || null }).then(function () {
      setTimeout(refreshStatus, 250);
    }).catch(function (e) { UI.toast('error', DDT.injectionHelp(e)); });
  }

  $('translate').addEventListener('click', function () {
    if (!hasUsableKey && !$('keySel').value) { UI.toast('warning', t('badgeNoKey')); return; }
    cmd('translate');
  });
  document.querySelectorAll('input[name=view]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked || !lastStatus) return;
      if (r.value === 'original' && lastStatus.showing === 'translated') cmd('original');
      if (r.value === 'translated' && lastStatus.showing !== 'translated') cmd('toggle');
    });
  });
  $('stop').addEventListener('click', function () { cmd('stop'); });
  function openOptions(e) { if (e) e.preventDefault(); api.runtime.openOptionsPage(); window.close(); }
  $('openOptions').addEventListener('click', openOptions);
  $('manageKeys').addEventListener('click', openOptions);
  $('addKey').addEventListener('click', openOptions);

  /* ---------- Langue cible : les 37 langues, comme dans les réglages ---------- */
  function renderTargets(current) {
    var sel = $('targetSel');
    sel.textContent = '';
    var o = document.createElement('option');
    o.value = 'auto';
    o.textContent = DDT.languageName(DDT.resolveTarget('auto')) + ' (auto)';   // court : le menu est étroit
    o.title = t('optTargetAuto', [DDT.languageName(DDT.resolveTarget('auto'))]);
    sel.appendChild(o);
    Object.keys(DDT.TARGETS).map(function (code) { return { code: code, name: DDT.languageName(code) }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (l) {
        var opt = document.createElement('option');
        opt.value = l.code;
        opt.textContent = l.name;
        sel.appendChild(opt);
      });
    sel.value = current || 'auto';
  }
  $('targetSel').addEventListener('change', function (e) {
    var v = e.target.value;
    api.storage.local.get('settings').then(function (r) {
      var s = Object.assign({}, DDT.DEFAULT_SETTINGS, r.settings || {}, { target: v });
      return api.storage.local.set({ settings: s });
    }).then(function () {
      // la page oublie l'ancienne langue ; l'utilisateur relance avec « Traduire cette page »
      if (tab && supported) api.tabs.sendMessage(tab.id, { to: 'content', cmd: 'status' }).catch(function () {});
      lastStatus = null;
      setTimeout(refreshStatus, 150);
    });
  });

  // Geste utilisateur : la demande de permission part tout de suite, avant tout await (Firefox).
  $('autoSite').addEventListener('change', function (e) {
    if (!host) return;
    var h = host.replace(/^www\./, '');
    if (e.target.checked) {
      api.storage.local.set({ pendingAutoSite: h });
      api.permissions.request({ origins: ['*://' + h + '/*', '*://*.' + h + '/*'] }).then(function (granted) {
        if (!granted) { e.target.checked = false; UI.toast('info', t('toastPermDenied')); return; }
        return send({ type: 'addAutoSite', host: h }).then(function () {
          UI.toast('success', t('toastAutoOn', [h]));
          return api.storage.local.remove('pendingAutoSite');
        });
      }).catch(function () { e.target.checked = false; });
    } else {
      send({ type: 'removeAutoSite', host: h }).then(function () { UI.toast('info', t('toastAutoOff', [h])); });
    }
  });

  /* ---------- Voix des vidéos : sous-titres traduits, ou son transcrit (Groq Whisper gratuit) ---------- */
  function voiceStatus() {
    if (!tab || !supported) return;
    send({ type: 'voiceCommand', tabId: tab.id, cmd: 'status' }).then(function (r) {
      $('voiceSwitch').checked = !!(r && r.active);
    }).catch(function () { /* page sans script voix */ });
  }
  $('voiceSwitch').addEventListener('change', function (e) {
    if (!tab) return;
    var on = e.target.checked;
    send({ type: 'voiceCommand', tabId: tab.id, cmd: on ? 'start' : 'stop', keyId: $('keySel').value || null }).then(function (r) {
      if (on && (!r || !r.active)) {
        e.target.checked = false;
        UI.toast('warning', (r && r.message) || t('voiceNoVideo'));
      } else if (on) UI.toast('success', t('voiceOn'));
    }).catch(function (err) {
      e.target.checked = false;
      UI.toast('error', t('badgeError', [String(err && err.message || err)]));
    });
  });

  api.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    tab = tabs && tabs[0];
    var url = tab && tab.url ? tab.url : '';
    // efface le « ! » laissé sur l'icône par un raccourci refusé
    try { if (tab && api.action) { api.action.setBadgeText({ tabId: tab.id, text: '' }); api.action.setTitle({ tabId: tab.id, title: '' }); } } catch (e) { /* rien */ }
    var why = DDT.unsupportedReason(url);
    supported = !why;
    if (why && why !== 'scheme') $('unsupportedMsg').textContent = t(why === 'pdf' ? 'popupPdf' : 'popupRestricted');
    try { host = url ? new URL(url).hostname : ''; } catch (e) { host = ''; }
    $('host').textContent = host || (url ? url.split(':')[0] + ':' : '');
    if (!supported) {
      $('unsupported').hidden = false;
      $('main').hidden = true;
      $('opts').hidden = true;
    }
    if (host) {
      api.storage.local.get('settings').then(function (r) {
        var s = Object.assign({}, DDT.DEFAULT_SETTINGS, r.settings || {});
        sensitive = DDT.isSensitiveHost(host, s.sensitiveExtra);
        $('sensitiveNote').hidden = !sensitive;
      });
    }
    refreshState().then(function () {
      if (supported) {
        refreshStatus();
        voiceStatus();
        pollTimer = setInterval(refreshStatus, 800);
      }
    });
  });

  if (api.commands && api.commands.getAll) {
    api.commands.getAll().then(function (cmds) {
      var c = (cmds || []).filter(function (x) { return x.name === 'toggle-translation'; })[0];
      var f = $('shortcut');
      if (c && c.shortcut) {
        f.textContent = t('popupShortcut') + ' ';
        c.shortcut.split('+').forEach(function (k, i) {
          if (i) f.appendChild(document.createTextNode(' '));
          var kb = document.createElement('kbd');
          kb.textContent = k;
          f.appendChild(kb);
        });
      } else $('foot').classList.add('hidden');
    }).catch(function () { $('foot').classList.add('hidden'); });
  }
  window.addEventListener('unload', function () { clearInterval(pollTimer); });
})();
