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
  var hasPaidKey = false;   // clé payante prête : utilisable seulement si choisie dans le menu « Clé »
  var lastStatus = null;
  var lastState = null;
  var pollTimer = null;
  var sensitive = false;
  var autoEntries = [];     // entrées de la liste des sites automatiques qui couvrent ce site
  var voiceBusy = false;
  var MAX_KEYS = 2;         // clés listées au plus ; une seule si le popup dépasse 600 px
  var MAX_HEIGHT = 600;     // au-delà, le navigateur ajoute une barre de défilement au popup
  var keyLimit = MAX_KEYS;

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
    UI.setOnly(el, spin ? UI.spinner() : UI.icon(iconName));
    el.appendChild(document.createTextNode(text));
  }

  /* ---------- Clés ---------- */
  function renderKeys(state) {
    lastState = state;
    var sel = $('keySel');
    var current = sel.value;
    sel.textContent = '';
    var auto = document.createElement('option');
    auto.value = '';
    auto.textContent = t('popupKeyAuto');
    sel.appendChild(auto);
    hasUsableKey = false;
    hasPaidKey = false;
    state.keys.forEach(function (k) {
      if (k.enabled && k.configured && k.tier !== 'paid') hasUsableKey = true;
      if (k.enabled && k.configured && k.tier === 'paid') hasPaidKey = true;
      if (k.enabled && k.configured) {
        var o = document.createElement('option');
        o.value = k.id;
        o.textContent = k.label + ' (' + t('tier_' + k.tier) + ')';
        sel.appendChild(o);
      }
    });
    sel.value = current || '';
    if (sel.selectedIndex < 0) sel.value = '';   // clé choisie supprimée entre-temps
    renderKeyList(state);
    $('noKeys').hidden = state.keys.length > 0;
  }

  /* Liste des clés : au plus keyLimit lignes, puis « et N autres » */
  function renderKeyList(state) {
    var ul = $('keys');
    ul.textContent = '';
    state.keys.forEach(function (k, i) {
      if (i < keyLimit) {
        var li = document.createElement('li');
        var name = document.createElement('span');
        name.className = 'kname';
        name.textContent = k.label;
        var small = document.createElement('small');
        small.textContent = t('tier_' + k.tier) + (k.maxPerDay ? ' · ' + k.requests + '/' + k.maxPerDay : '');
        name.appendChild(small);
        var c = document.createElement('span');
        if (!k.enabled) chip(c, '', 'off', t('keyDisabled'));
        else if (k.reason === 'no_key') chip(c, 'warn', 'key', t('keyNoApiKey'));
        else if (!k.configured) chip(c, 'warn', 'alert', t('keyNoModel'));
        else if (k.available) chip(c, 'ok', 'check', t('keyAvailable'));
        else if (k.until) chip(c, 'warn', 'pause', t('keyPausedUntil', [fmtTime(k.until)]));
        else chip(c, 'err', 'error', t('keyProblem'));
        name.title = name.textContent;
        li.appendChild(name);
        li.appendChild(c);
        ul.appendChild(li);
      }
    });
    if (state.keys.length > keyLimit) {
      var more = document.createElement('li');
      more.className = 'more';
      more.textContent = t('popupMoreKeys', [state.keys.length - keyLimit]);
      ul.appendChild(more);
    }
  }

  /* ---------- Hauteur : jamais plus de 600 px (sinon barre de défilement) ----------
     Langue longue + message d'état long + note « page sensible » + 3 clés + raccourci peuvent
     dépasser 600 px. On retire alors, dans l'ordre : la 2e clé listée, le pied (raccourci), puis on
     resserre (message d'état et note limités à 2 lignes, texte complet dans title). */
  function tooTall() { return Math.ceil(document.body.getBoundingClientRect().height) > MAX_HEIGHT; }
  var fitSig = '';
  function fitHeight() {
    var foot = $('foot');
    // l'actualisation tourne toutes les 800 ms : rien à refaire si le contenu n'a pas changé
    var sig = [$('status').textContent, $('stop').hidden, $('progress').hidden, $('count').textContent.length, $('stateChip').textContent,
      $('sensitiveNote').hidden, foot.textContent, foot.classList.contains('hidden'), lastState ? JSON.stringify(lastState.keys) : ''].join('|');
    if (sig === fitSig) return;
    fitSig = sig;
    document.body.classList.remove('tight');
    foot.classList.remove('squeezed');
    if (keyLimit !== MAX_KEYS) { keyLimit = MAX_KEYS; if (lastState) renderKeyList(lastState); }
    if (!tooTall()) return;
    if (lastState && lastState.keys.length > 1) { keyLimit = 1; renderKeyList(lastState); }
    if (tooTall()) foot.classList.add('squeezed');
    if (tooTall()) document.body.classList.add('tight');
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
      if (hasUsableKey || $('keySel').value) chip(c, 'info', 'translate', t('stateReady'));
      else if (hasPaidKey) { chip(c, 'warn', 'coin', t('statePaidOnly')); msg = t('popupPaidOnly'); }
      else chip(c, 'warn', 'key', t('stateNoKey'));
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
    if (running && heroIcon && !heroIcon.classList.contains('spinner')) heroIcon.replaceWith(UI.spinner());
    if (!running && heroIcon && heroIcon.classList.contains('spinner')) {
      var back = document.createElement('span');
      back.setAttribute('data-icon', 'translate');
      heroIcon.replaceWith(back);
      UI.fillIcons(hero);
    }

    var radios = document.querySelectorAll('input[name=view]');
    radios.forEach(function (r) {
      r.disabled = !(done > 0);
      r.checked = r.value === (done > 0 ? showing : 'original');
    });
    $('stop').hidden = !running;
    $('status').textContent = msg || '';
    $('status').title = msg || '';
    fitHeight();
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
      // docs.example.com est couvert par « example.com » : on garde l'entrée réelle de la liste,
      // c'est elle qu'il faudra retirer si l'utilisateur décoche.
      var lower = host.toLowerCase();
      autoEntries = (state.settings.autoSites || []).filter(function (h) {
        return lower === h || lower.slice(-(h.length + 1)) === '.' + h;
      });
      $('autoSite').checked = autoEntries.length > 0;
      if (!lastStatus) renderStatus(null);
      else fitHeight();
    });
  }

  function cmd(c) {
    if (!tab) return;
    send({ type: 'tabCommand', tabId: tab.id, cmd: c, keyId: $('keySel').value || null }).then(function () {
      setTimeout(refreshStatus, 250);
    }).catch(function (e) { UI.toast('error', DDT.injectionHelp(e)); });
  }

  $('translate').addEventListener('click', function () {
    if (!hasUsableKey && !$('keySel').value) { UI.toast('warning', t(hasPaidKey ? 'popupPaidOnly' : 'badgeNoKey')); return; }
    cmd('translate');
  });
  // Choisir une clé (payante notamment) change l'état « prête » du popup
  $('keySel').addEventListener('change', function () { renderStatus(lastStatus); });
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
    var h = host.toLowerCase().replace(/^www\./, '');
    if (e.target.checked) {
      api.storage.local.set({ pendingAutoSite: h });
      api.permissions.request({ origins: ['*://' + h + '/*', '*://*.' + h + '/*'] }).then(function (granted) {
        if (!granted) { e.target.checked = false; UI.toast('info', t('toastPermDenied')); return; }
        return send({ type: 'addAutoSite', host: h }).then(function () {
          autoEntries = [h];
          UI.toast('success', t('toastAutoOn', [h]));
          return api.storage.local.remove('pendingAutoSite');
        });
      }).catch(function () { e.target.checked = false; });
    } else {
      // Retire les entrées qui couvrent vraiment ce site (« example.com » pour docs.example.com),
      // l'une après l'autre : chaque retrait relit puis réécrit les réglages.
      var entries = autoEntries.length ? autoEntries.slice() : [h];
      entries.reduce(function (p, entry) {
        return p.then(function () { return send({ type: 'removeAutoSite', host: entry }); });
      }, Promise.resolve()).then(function () {
        autoEntries = [];
        UI.toast('info', t('toastAutoOff', [entries.join(', ')]));
      });
    }
  });

  /* ---------- Voix des vidéos : sous-titres traduits, ou son transcrit (Groq Whisper gratuit) ---------- */
  function voiceStatus() {
    if (!tab || !supported || voiceBusy) return;
    send({ type: 'voiceCommand', tabId: tab.id, cmd: 'status' }).then(function (r) {
      if (!voiceBusy) { var was = $('voiceSwitch').checked; $('voiceSwitch').checked = !!(r && r.active); if (was !== $('voiceSwitch').checked) fitHeight(); }
    }).catch(function () { /* page sans script voix */ });
  }
  $('voiceSwitch').addEventListener('change', function (e) {
    fitHeight();   // le menu du doublage apparaît ou disparaît avec l'interrupteur
    if (!tab) return;
    var on = e.target.checked;
    voiceBusy = true;   // pas de relecture de l'état pendant le démarrage ou l'arrêt
    send({ type: 'voiceCommand', tabId: tab.id, cmd: on ? 'start' : 'stop', keyId: $('keySel').value || null }).then(function (r) {
      voiceBusy = false;
      if (on && (!r || !r.active)) {
        e.target.checked = false;
        UI.toast('warning', (r && r.message) || t('voiceNoVideo'));
      } else if (on) UI.toast('success', t('voiceOn'));
    }).catch(function (err) {
      voiceBusy = false;
      e.target.checked = false;
      UI.toast('error', t('badgeError', [String(err && err.message || err)]));
    });
  });

  /* Sous-titres seuls ou doublage (voix de synthèse du navigateur) : réglage enregistré,
     appliqué tout de suite si la voix de la vidéo est déjà traduite dans l'onglet */
  api.storage.local.get('settings').then(function (r) {
    var s = Object.assign({}, DDT.DEFAULT_SETTINGS, (r && r.settings) || {});
    $('voiceDubSel').value = s.voiceDub ? 'dub' : 'subs';
    dubTitle();
  });
  function dubTitle() { var sel = $('voiceDubSel'); var o = sel.selectedOptions && sel.selectedOptions[0]; if (o) sel.title = o.textContent; }
  $('voiceDubSel').addEventListener('change', function (e) {
    dubTitle();
    var on = e.target.value === 'dub';
    api.storage.local.get('settings').then(function (r) {
      var s = Object.assign({}, DDT.DEFAULT_SETTINGS, r.settings || {}, { voiceDub: on });
      return api.storage.local.set({ settings: s });
    }).then(function () {
      if (tab && supported && $('voiceSwitch').checked) {
        return send({ type: 'voiceCommand', tabId: tab.id, cmd: 'dub', on: on }).then(function (r) {
          if (on && r && r.active && !r.speaking && r.message) UI.toast('warning', r.message);
        });
      }
    }).catch(function () { /* rien */ });
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
        fitHeight();
      });
    }
    refreshState().then(function () {
      if (supported) {
        refreshStatus();
        voiceStatus();
        // La voix peut s'arrêter seule (vidéo finie, raccourci Alt+Maj+V, page rechargée) :
        // son interrupteur est relu une actualisation sur quatre.
        var ticks = 0;
        pollTimer = setInterval(function () {
          refreshStatus();
          if (++ticks % 4 === 0) voiceStatus();
        }, 800);
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
        fitHeight();
      } else $('foot').classList.add('hidden');
    }).catch(function () { $('foot').classList.add('hidden'); });
  }
  window.addEventListener('unload', function () { clearInterval(pollTimer); });
})();
