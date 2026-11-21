/* DevDocTrad - popup.js. Licence MIT. */
(function () {
  'use strict';
  var DDT = window.DDT;
  var api = DDT.api;
  var t = DDT.t;
  var $ = function (id) { return document.getElementById(id); };
  var tab = null;
  var host = '';
  var pollTimer = null;

  DDT.localizePage(document);

  function send(msg) { return api.runtime.sendMessage(msg); }

  function fmtTime(ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

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
    state.keys.forEach(function (k) {
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.textContent = k.label + ' · ' + t('tier_' + k.tier);
      var pill = document.createElement('span');
      pill.className = 'pill';
      if (!k.enabled) { pill.textContent = t('keyDisabled'); }
      else if (!k.configured) { pill.textContent = t('keyNoModel'); pill.className += ' warn'; }
      else if (k.available) { pill.textContent = t('keyAvailable'); pill.className += ' ok'; }
      else if (k.until) { pill.textContent = t('keyPausedUntil', [fmtTime(k.until)]); pill.className += ' warn'; }
      else { pill.textContent = t('keyProblem'); pill.className += ' bad'; }
      li.appendChild(name);
      li.appendChild(pill);
      ul.appendChild(li);
      if (k.enabled && k.configured) {
        var o = document.createElement('option');
        o.value = k.id;
        o.textContent = k.label + ' (' + t('tier_' + k.tier) + ')';
        sel.appendChild(o);
      }
    });
    sel.value = current || '';
    $('noKeys').hidden = state.keys.length > 0;
  }

  function renderStatus(st) {
    var msg = '';
    if (st && st.state) {
      if (st.message) msg = st.message;
      else if (st.state === 'running') msg = t('badgeTranslating', [st.done, st.total]);
      else if (st.state === 'done') msg = st.failed ? t('badgeDoneFailed', [st.done, st.failed]) : t('badgeDone', [st.done]);
      else if (st.state === 'stopped') msg = t('badgeStopped');
      $('toggle').textContent = st.showing === 'translated' ? t('btnOriginal') : t('btnTranslation');
      $('toggle').disabled = !(st.done > 0);
      $('stop').disabled = st.state !== 'running';
    } else {
      $('toggle').disabled = true;
      $('stop').disabled = true;
    }
    $('status').textContent = msg;
  }

  function refreshStatus() {
    if (!tab) return;
    api.tabs.sendMessage(tab.id, { to: 'content', cmd: 'status' }).then(renderStatus, function () { renderStatus(null); });
  }

  function refreshState() {
    return send({ type: 'getState' }).then(function (state) {
      if (!state) return;
      renderKeys(state);
      $('autoSite').checked = (state.settings.autoSites || []).some(function (h) {
        return host === h || host.slice(-(h.length + 1)) === '.' + h;
      });
    });
  }

  function cmd(c) {
    if (!tab) return;
    send({ type: 'tabCommand', tabId: tab.id, cmd: c, keyId: $('keySel').value || null }).then(function () {
      setTimeout(refreshStatus, 300);
    }).catch(function (e) { $('status').textContent = t('badgeError', [String(e && e.message || e)]); });
  }

  $('translate').addEventListener('click', function () { cmd('translate'); });
  $('toggle').addEventListener('click', function () { cmd('toggle'); });
  $('stop').addEventListener('click', function () { cmd('stop'); });
  $('openOptions').addEventListener('click', function (e) { e.preventDefault(); api.runtime.openOptionsPage(); window.close(); });
  $('addKey').addEventListener('click', function (e) { e.preventDefault(); api.runtime.openOptionsPage(); window.close(); });

  // Geste utilisateur : la demande de permission part tout de suite, avant tout await (Firefox).
  $('autoSite').addEventListener('change', function (e) {
    if (!host) return;
    var h = host.replace(/^www\./, '');
    if (e.target.checked) {
      api.storage.local.set({ pendingAutoSite: h });
      api.permissions.request({ origins: ['*://' + h + '/*', '*://*.' + h + '/*'] }).then(function (granted) {
        if (!granted) { e.target.checked = false; return; }
        return send({ type: 'addAutoSite', host: h }).then(function () { return api.storage.local.remove('pendingAutoSite'); });
      }).catch(function () { e.target.checked = false; });
    } else {
      send({ type: 'removeAutoSite', host: h });
    }
  });

  api.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    tab = tabs && tabs[0];
    var url = tab && tab.url ? tab.url : '';
    var ok = /^https?:/i.test(url) && !/^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com|addons\.mozilla\.org)/i.test(url);
    try { host = url ? new URL(url).hostname : ''; } catch (e) { host = ''; }
    $('host').textContent = host || '';
    if (!ok) {
      $('unsupported').hidden = false;
      $('main').hidden = true;
      $('opts').hidden = true;
    }
    if (host) {
      api.storage.local.get('settings').then(function (r) {
        var s = Object.assign({}, DDT.DEFAULT_SETTINGS, r.settings || {});
        $('sensitiveNote').hidden = !DDT.isSensitiveHost(host, s.sensitiveExtra);
      });
    }
    refreshState();
    if (ok) {
      refreshStatus();
      pollTimer = setInterval(refreshStatus, 1000);
    }
  });

  if (api.commands && api.commands.getAll) {
    api.commands.getAll().then(function (cmds) {
      var c = (cmds || []).filter(function (x) { return x.name === 'toggle-translation'; })[0];
      if (c && c.shortcut) {
        var f = $('shortcut');
        f.textContent = t('popupShortcut') + ' ';
        var k = document.createElement('kbd');
        k.textContent = c.shortcut;
        f.appendChild(k);
      }
    }).catch(function () { /* rien */ });
  }
  window.addEventListener('unload', function () { clearInterval(pollTimer); });
})();
