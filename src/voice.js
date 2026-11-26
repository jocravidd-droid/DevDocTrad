/*
 * DevDocTrad - voice.js
 * Traduit la voix des vidéos, gratuitement, en sous-titres affichés sur la vidéo.
 *
 * Trois sources, dans cet ordre :
 *   1. les sous-titres de la vidéo (<track>, pistes texte HTML5) : traduits à l'avance, sans aucun coût audio ;
 *   2. les sous-titres de YouTube (activés automatiquement s'ils existent) ;
 *   3. sinon, le son de la vidéo : morceaux de quelques secondes transcrits par Groq Whisper
 *      (palier gratuit, avec la clé Groq de l'utilisateur), puis traduits comme le reste.
 * Option : lecture de la traduction à voix haute par la synthèse vocale du navigateur (locale, gratuite).
 *
 * Injecté seulement à la demande (popup ou raccourci Alt+Maj+V). Licence MIT.
 */
(function (root) {
  'use strict';
  if (root.__DDT_VOICE_LOADED) return;
  root.__DDT_VOICE_LOADED = true;
  var DDT = root.DDT;

  var CHUNK_MS = 8000;           // durée d'un morceau de son (Groq compte au moins 10 s par requête)
  var SILENCE_RMS = 0.006;       // en dessous : morceau considéré comme silencieux, pas envoyé
  var YT_WAIT_MS = 6000;         // délai pour voir apparaître des sous-titres YouTube
  var YT_STABLE_MS = 700;        // texte YouTube stable depuis ce délai : on le traduit
  var YT_MAX_WAIT_MS = 2500;     // texte qui défile sans arrêt : traduit quand même après ce délai
  var BATCH = 40;                // sous-titres traduits par demande

  function cueText(s) {
    return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  }

  function createVoice(doc, win, deps) {
    var transport = deps.transport;
    var transcribe = deps.transcribe;
    var t = deps.t || DDT.t;
    var settings = Object.assign({}, DDT.DEFAULT_SETTINGS, deps.settings || {});
    var keyId = null;
    var chunkMs = deps.chunkMs || CHUNK_MS;
    var ytWaitMs = deps.ytWaitMs || YT_WAIT_MS;

    var active = false;
    var mode = null;             // 'track' | 'youtube' | 'audio'
    var video = null;
    var message = '';
    var cleanups = [];
    var memo = {};               // texte original -> traduction
    var pending = {};            // texte original -> promesse
    var speaking = false;
    var savedVolume = null;
    var host = null;
    var box = null;
    var lastShown = '';
    var stats = { translated: 0, transcribed: 0 };

    /* ---------------- Choix de la vidéo ---------------- */
    function area(v) {
      var r = v.getBoundingClientRect ? v.getBoundingClientRect() : { width: 0, height: 0 };
      return Math.max(0, r.width) * Math.max(0, r.height);
    }
    function pickVideo() {
      var list = Array.prototype.slice.call(doc.querySelectorAll('video'));
      if (!list.length) return null;
      list.sort(function (a, b) {
        var pa = a.paused ? 0 : 1;
        var pb = b.paused ? 0 : 1;
        if (pa !== pb) return pb - pa;
        return area(b) - area(a);
      });
      return list[0];
    }
    function isYouTube() { return /(^|\.)youtube(-nocookie)?\.com$/i.test(win.location.hostname); }
    function textTracks(v) {
      var out = [];
      var tl = v && v.textTracks;
      if (!tl) return out;
      for (var i = 0; i < tl.length; i++) {
        if (tl[i].kind === 'subtitles' || tl[i].kind === 'captions') out.push(tl[i]);
      }
      return out;
    }

    /* ---------------- Traduction ---------------- */
    function translateMany(texts) {
      var todo = [];
      texts.forEach(function (s) { if (s && !(s in memo) && !pending[s] && todo.indexOf(s) === -1) todo.push(s); });
      if (!todo.length) return Promise.resolve();
      var batches = [];
      for (var i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
      var seq = Promise.resolve();
      batches.forEach(function (b) {
        var p = seq.then(function () {
          if (!active) return;
          return transport.translate(b.map(DDT.escapeText), { keyId: keyId }).then(function (res) {
            if (!res || res.error) { noteError(res); return; }
            b.forEach(function (s, j) {
              var tr = res.translations && res.translations[j];
              if (typeof tr === 'string') { memo[s] = DDT.plainText(tr); stats.translated++; }
            });
          });
        });
        b.forEach(function (s) { pending[s] = p; });
        seq = p.then(function () { b.forEach(function (s) { delete pending[s]; }); },
          function () { b.forEach(function (s) { delete pending[s]; }); });
      });
      return seq;
    }
    function translateOne(s) {
      if (s in memo) return Promise.resolve(memo[s]);
      if (!pending[s]) translateMany([s]);
      return (pending[s] || Promise.resolve()).then(function () { return memo[s]; });
    }
    function noteError(res) {
      if (!res) return;
      if (res.error === 'no_key') setMessage(t('badgeNoKey'));
      else if (res.error === 'rate_limited') setMessage(t('badgeRateGiveUp'));
      else if (res.error === 'disconnected') setMessage(t('badgeError', ['disconnected']));
      else setMessage(res.message || t('badgeError', [res.error]));
    }

    /* ---------------- Affichage sur la vidéo ---------------- */
    var CSS = [
      ':host{all:initial}',
      '.box{position:fixed;z-index:2147483646;display:none;flex-direction:column;align-items:center;gap:6px;',
      'pointer-events:none;font:600 clamp(15px,2.1vw,26px)/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}',
      '.box.on{display:flex}',
      '.line{pointer-events:auto;max-width:100%;padding:6px 14px;border-radius:12px;background:rgba(0,0,0,.78);color:#fff;',
      'text-align:center;text-shadow:0 1px 2px rgba(0,0,0,.6);white-space:pre-wrap}',
      '.orig{font-size:.72em;font-weight:500;opacity:.82}',
      '.orig:empty,.tr:empty{display:none}',
      '.bar{pointer-events:auto;display:flex;gap:6px;align-items:center;font:500 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;',
      'color:#fff;background:rgba(0,0,0,.6);border-radius:999px;padding:3px 4px 3px 10px}',
      '.bar button{all:unset;cursor:pointer;width:24px;height:24px;border-radius:12px;display:grid;place-items:center}',
      '.bar button:hover{background:rgba(255,255,255,.18)}',
      '.bar button:focus-visible{outline:2px solid #4da3ff;outline-offset:1px}',
      '.bar button[aria-pressed=true]{background:#0a84ff}',
      '.bar svg{width:15px;height:15px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.msg{max-width:46ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    ].join('');
    var ICON_SPEAK = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg>';
    var ICON_CLOSE = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    function ensureBox() {
      if (host) return;
      host = doc.createElement('div');
      host.setAttribute('data-tr-ui', 'voice');
      host.setAttribute('translate', 'no');
      var sr = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
      var style = doc.createElement('style');
      style.textContent = CSS;
      sr.appendChild(style);
      box = doc.createElement('div');
      box.className = 'box';
      box.setAttribute('role', 'region');
      box.setAttribute('aria-live', 'polite');
      box.setAttribute('aria-label', t('popupVoice'));
      box.innerHTML = '<div class="line orig"></div><div class="line tr"></div>' +
        '<div class="bar"><span class="msg"></span><button class="speak" type="button" aria-pressed="false">' + ICON_SPEAK +
        '</button><button class="close" type="button">' + ICON_CLOSE + '</button></div>';
      sr.appendChild(box);
      var speak = box.querySelector('.speak');
      speak.title = t('voiceSpeak');
      speak.setAttribute('aria-label', t('voiceSpeak'));
      speak.addEventListener('click', function () { setSpeaking(!speaking); });
      var close = box.querySelector('.close');
      close.title = t('btnClose');
      close.setAttribute('aria-label', t('btnClose'));
      close.addEventListener('click', function () { stop(); });
      placeHost();
      var onFs = function () { placeHost(); position(); };
      doc.addEventListener('fullscreenchange', onFs);
      doc.addEventListener('webkitfullscreenchange', onFs);
      var timer = win.setInterval(position, 300);
      var onScroll = function () { position(); };
      win.addEventListener('scroll', onScroll, true);
      win.addEventListener('resize', onScroll);
      cleanups.push(function () {
        win.clearInterval(timer);
        doc.removeEventListener('fullscreenchange', onFs);
        doc.removeEventListener('webkitfullscreenchange', onFs);
        win.removeEventListener('scroll', onScroll, true);
        win.removeEventListener('resize', onScroll);
        if (host && host.parentNode) host.parentNode.removeChild(host);
        host = null;
        box = null;
      });
    }
    /* En plein écran, seul l'élément en plein écran est visible : la bande y est déplacée
       (sauf si c'est la vidéo elle-même, qui ne peut pas contenir d'élément). */
    function placeHost() {
      if (!host) return;
      var fs = doc.fullscreenElement || doc.webkitFullscreenElement;
      var parent = fs && fs.tagName !== 'VIDEO' ? fs : (doc.body || doc.documentElement);
      if (host.parentNode !== parent) parent.appendChild(host);
    }
    function position() {
      if (!box || !video) return;
      var r = video.getBoundingClientRect();
      var vw = win.innerWidth || 1024;
      var vh = win.innerHeight || 768;
      var visible = r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < vh;
      var left = visible ? Math.max(8, r.left + r.width * 0.05) : 16;
      var width = visible ? Math.min(vw - 16, r.width * 0.9) : vw - 32;
      var bottom = visible ? Math.max(8, vh - r.bottom + Math.max(52, r.height * 0.12)) : 24;
      box.style.left = Math.round(left) + 'px';
      box.style.width = Math.round(width) + 'px';
      box.style.bottom = Math.round(bottom) + 'px';
    }
    function show(original, translated) {
      ensureBox();
      var bilingual = settings.mode === 'bilingual';
      box.querySelector('.orig').textContent = bilingual && translated ? original || '' : '';
      box.querySelector('.tr').textContent = translated || '';
      box.classList.add('on');
      position();
      if (translated && translated !== lastShown) {
        lastShown = translated;
        if (speaking) say(translated);
      }
    }
    function clearLines() {
      if (!box) return;
      box.querySelector('.orig').textContent = '';
      box.querySelector('.tr').textContent = '';
    }
    function setMessage(m) {
      message = m || '';
      ensureBox();
      box.querySelector('.msg').textContent = message;
      box.querySelector('.msg').title = message;
      box.classList.add('on');
      position();
    }

    /* ---------------- Lecture à voix haute (synthèse vocale du navigateur) ---------------- */
    function synth() { return win.speechSynthesis || null; }
    function say(text) {
      var s = synth();
      if (!s || !win.SpeechSynthesisUtterance) return;
      if (s.speaking || s.pending) s.cancel();      // pas de retard qui s'accumule
      var u = new win.SpeechSynthesisUtterance(text);
      u.lang = DDT.resolveTarget(settings.target);
      u.rate = 1.05;
      s.speak(u);
    }
    function setSpeaking(on) {
      speaking = !!on && !!synth();
      if (box) {
        var b = box.querySelector('.speak');
        b.setAttribute('aria-pressed', speaking ? 'true' : 'false');
        var label = t(speaking ? 'voiceSpeakOff' : 'voiceSpeak');
        b.title = label;
        b.setAttribute('aria-label', label);
      }
      if (video) {
        if (speaking && savedVolume === null) { savedVolume = video.volume; video.volume = Math.min(video.volume, 0.25); }
        if (!speaking && savedVolume !== null) { video.volume = savedVolume; savedVolume = null; }
      }
      if (!speaking && synth()) synth().cancel();
      if (speaking && lastShown) say(lastShown);
    }

    /* ---------------- 1. Pistes de sous-titres HTML5 ---------------- */
    function startTrack(tracks) {
      mode = 'track';
      var target = DDT.resolveTarget(settings.target).slice(0, 2);
      var track = tracks.filter(function (tr) { return tr.mode === 'showing'; })[0] ||
        tracks.filter(function (tr) { return String(tr.language || '').slice(0, 2) !== target; })[0] || tracks[0];
      var before = track.mode;
      tracks.forEach(function (tr) { if (tr !== track && tr.mode === 'showing') tr.mode = 'disabled'; });
      track.mode = 'hidden';          // charge les sous-titres sans les dessiner : la bande les remplace
      setMessage(t('voiceSourceTrack'));
      var prepared = false;
      function prepare() {
        if (prepared || !track.cues || !track.cues.length) return;
        prepared = true;
        var texts = [];
        for (var i = 0; i < track.cues.length; i++) texts.push(cueText(track.cues[i].text));
        // d'abord les sous-titres autour de la position actuelle, puis le reste
        var now = video ? video.currentTime : 0;
        var order = texts.map(function (s, i2) { return { s: s, d: Math.abs((track.cues[i2].startTime || 0) - now) }; })
          .sort(function (a, b) { return a.d - b.d; }).map(function (x) { return x.s; });
        translateMany(order);
      }
      function onCue() {
        prepare();
        var list = track.activeCues || [];
        var parts = [];
        for (var i = 0; i < list.length; i++) parts.push(cueText(list[i].text));
        var s = parts.join('\n').trim();
        if (!s) { clearLines(); return; }
        if (s in memo) { show(s, memo[s]); return; }
        show(s, '');
        translateOne(s).then(function (tr) {
          var cur = [];
          var l2 = track.activeCues || [];
          for (var j = 0; j < l2.length; j++) cur.push(cueText(l2[j].text));
          if (active && cur.join('\n').trim() === s) show(s, tr || '');
        });
      }
      track.addEventListener('cuechange', onCue);
      var poll = win.setInterval(prepare, 500);
      win.setTimeout(function () { win.clearInterval(poll); }, 15000);
      prepare();
      onCue();
      cleanups.push(function () {
        track.removeEventListener('cuechange', onCue);
        win.clearInterval(poll);
        try { track.mode = before; } catch (e) { /* rien */ }
      });
    }

    /* ---------------- 2. Sous-titres YouTube ---------------- */
    function ytText() {
      var segs = doc.querySelectorAll('.ytp-caption-window-container .ytp-caption-segment');
      var parts = [];
      for (var i = 0; i < segs.length; i++) parts.push(segs[i].textContent);
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    function startYouTube() {
      mode = 'youtube';
      var btn = doc.querySelector('.ytp-subtitles-button');
      var turnedOn = false;
      if (btn && btn.getAttribute('aria-pressed') === 'false') { btn.click(); turnedOn = true; }
      var style = doc.createElement('style');
      style.setAttribute('data-tr-ui', 'voice-style');
      style.textContent = '.ytp-caption-window-container{opacity:0!important}';
      (doc.head || doc.documentElement).appendChild(style);
      setMessage(t('voiceSourceTrack'));
      var seen = false;
      var last = '';
      var changedAt = 0;
      var firstChangeAt = 0;
      var sent = '';
      var tick = win.setInterval(function () {
        var s = ytText();
        var now = Date.now();
        if (s !== last) {
          if (!last || !firstChangeAt) firstChangeAt = now;
          last = s;
          changedAt = now;
        }
        if (!s) { if (sent) { clearLines(); sent = ''; } firstChangeAt = 0; return; }
        seen = true;
        if (s === sent) return;
        if (now - changedAt >= YT_STABLE_MS || now - firstChangeAt >= YT_MAX_WAIT_MS) {
          sent = s;
          firstChangeAt = now;
          translateOne(s).then(function (tr) { if (active && sent === s && tr) show(s, tr); });
        }
      }, 200);
      var fallback = win.setTimeout(function () {
        if (seen || !active || mode !== 'youtube') return;
        if (video && video.paused) { setMessage(t('voicePlay')); return; }
        stopYouTube();
        startAudio();
      }, ytWaitMs);
      function stopYouTube() {
        win.clearInterval(tick);
        win.clearTimeout(fallback);
        if (style.parentNode) style.parentNode.removeChild(style);
        if (turnedOn && btn && btn.getAttribute('aria-pressed') === 'true') btn.click();
        turnedOn = false;
      }
      cleanups.push(stopYouTube);
    }

    /* ---------------- 3. Son de la vidéo -> Groq Whisper ---------------- */
    function pickMime(MR) {
      var list = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
      for (var i = 0; i < list.length; i++) { try { if (MR.isTypeSupported(list[i])) return list[i]; } catch (e) { /* rien */ } }
      return '';
    }
    /* Le son enregistré (un Blob de la page) est lu par FileReader, qui rend directement une chaîne.
       Lire ses octets (arrayBuffer + Uint8Array) échoue dans Firefox : « Permission denied to access
       property constructor », l'objet appartient à la page et non au script d'extension. */
    function blobToBase64(blob) {
      return new Promise(function (resolve, reject) {
        var fr = new win.FileReader();
        fr.onload = function () { resolve(String(fr.result).replace(/^data:[^,]*,/, '')); };
        fr.onerror = function () { reject(fr.error); };
        fr.readAsDataURL(blob);
      });
    }
    function captureAudio(v) {
      var stream = null;
      var moz = false;
      try {
        if (typeof v.captureStream === 'function') stream = v.captureStream();
        else if (typeof v.mozCaptureStream === 'function') { stream = v.mozCaptureStream(); moz = true; }
      } catch (e) { stream = null; }
      return stream ? { stream: stream, moz: moz } : null;
    }
    function startAudio() {
      mode = 'audio';
      var MR = deps.MediaRecorder || win.MediaRecorder;
      var AC = deps.AudioContext || win.AudioContext || win.webkitAudioContext;
      var cap = captureAudio(video);
      if (!MR || !cap) { setMessage(t('voiceNoAudio')); return; }
      var mime = pickMime(MR);
      setMessage(t('voiceListening'));
      var ctx = null;
      var analyser = null;
      var source = null;
      var stopped = false;
      var recorder = null;
      var chain = Promise.resolve();
      var level = 0;
      var meter = null;

      function audioTracks() { return cap.stream.getAudioTracks ? cap.stream.getAudioTracks() : []; }
      function setupGraph(tracks) {
        if (!AC || ctx) return;
        try {
          ctx = new AC();
          source = ctx.createMediaStreamSource(new win.MediaStream(tracks));
          analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          // Firefox : mozCaptureStream retire le son de la vidéo ; on le renvoie vers les haut-parleurs.
          if (cap.moz) source.connect(ctx.destination);
          // Tampon créé côté page : dans Firefox, un tableau du script d'extension passé à une méthode
          // de la page n'est pas rempli (frontière Xray) et tout semblait silencieux.
          var buf = new (win.Float32Array || Float32Array)(analyser.fftSize);
          // Le contexte audio d'une page démarre souvent « suspendu » (pas de clic sur la page) : il ne
          // mesure alors que des zéros. On tente de le relancer ; sinon, pas de détection de silence.
          if (ctx.state !== 'running' && ctx.resume) { try { ctx.resume().catch(function () {}); } catch (e) { /* rien */ } }
          meter = win.setInterval(function () {
            if (ctx.state !== 'running') { level = 1; return; }
            analyser.getFloatTimeDomainData(buf);
            var sum = 0;
            for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            level = Math.max(level, Math.sqrt(sum / buf.length));
          }, 100);
        } catch (e) { ctx = null; analyser = null; }
      }
      function recordOne() {
        if (stopped || !active) return;
        var tracks = audioTracks();
        if (!tracks.length) {                      // pas encore de son (vidéo en pause ou pas chargée)
          if (video.paused) setMessage(t('voicePlay'));
          win.setTimeout(recordOne, 800);
          return;
        }
        setupGraph(tracks);
        var chunks = [];
        level = analyser ? 0 : 1;
        var startedPlaying = !video.paused;
        try {
          recorder = new MR(new win.MediaStream(tracks), mime ? { mimeType: mime } : undefined);
        } catch (e) { setMessage(t('voiceNoAudio')); return; }
        recorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
        recorder.onstop = function () {
          var silent = level < SILENCE_RMS;
          var wasPlaying = startedPlaying || !video.paused;
          var blob = chunks.length ? new win.Blob(chunks, { type: (mime || 'audio/webm').split(';')[0] }) : null;
          if (!stopped) recordOne();               // le morceau suivant démarre tout de suite
          if (!blob || silent || !wasPlaying) return;
          // traitement dans l'ordre d'arrivée : les sous-titres ne se doublent jamais
          chain = chain.then(function () { return handleChunk(blob, mime); }).catch(function () { /* rien */ });
        };
        try { recorder.start(); } catch (e) { setMessage(t('voiceNoAudio')); return; }
        win.setTimeout(function () { try { if (recorder.state !== 'inactive') recorder.stop(); } catch (e) { /* rien */ } }, chunkMs);
      }
      recordOne();
      cleanups.push(function () {
        stopped = true;
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (e) { /* rien */ }
        if (meter) win.clearInterval(meter);
        try { if (ctx) ctx.close(); } catch (e) { /* rien */ }
      });
    }
    function handleChunk(blob, mime) {
      if (!active) return Promise.resolve();
      return blobToBase64(blob).then(function (b64) {
        return transcribe(b64, mime);
      }).then(function (r) {
        if (!active) return;
        if (!r || !r.ok) {
          if (r && r.error === 'no_groq') setMessage(t('voiceNeedGroq'));
          else if (r && r.error === 'rate_limited') setMessage(t('voiceRate'));
          else if (r && r.error === 'empty') return;
          else setMessage((r && r.message) || t('badgeError', [(r && r.error) || '?']));
          return;
        }
        stats.transcribed++;
        setMessage(t('voiceSourceAudio'));
        if (!r.text) return;
        show(r.text, '');
        return translateOne(r.text).then(function (tr) { if (active && tr) show(r.text, tr); });
      });
    }

    /* ---------------- Commandes ---------------- */
    function start(opts) {
      opts = opts || {};
      if (opts.settings) settings = Object.assign({}, DDT.DEFAULT_SETTINGS, opts.settings);
      keyId = opts.keyId || null;
      if (active) return status();
      video = pickVideo();
      if (!video) { message = t('voiceNoVideo'); return status({ ok: false, error: 'no_video' }); }
      active = true;
      memo = {};
      pending = {};
      lastShown = '';
      ensureBox();
      var tracks = textTracks(video);
      if (tracks.length) startTrack(tracks);
      else if (isYouTube()) startYouTube();
      else startAudio();
      return status();
    }
    function stop() {
      if (!active && !host) return status();
      active = false;
      setSpeaking(false);
      var list = cleanups;
      cleanups = [];
      list.reverse().forEach(function (fn) { try { fn(); } catch (e) { /* rien */ } });
      mode = null;
      message = '';
      return status();
    }
    function toggle(opts) { return active ? stop() : start(opts); }
    function status(extra) {
      return Object.assign({ ok: true, active: active, mode: mode, message: message, speaking: speaking,
        translated: stats.translated, transcribed: stats.transcribed }, extra || {});
    }

    return {
      start: start, stop: stop, toggle: toggle, status: status, setSpeaking: setSpeaking,
      _memo: function () { return memo; }, _video: function () { return video; }
    };
  }

  root.DDT_createVoice = createVoice;
  root.DDT_cueText = cueText;

  /* ---------------- Mise en route dans l'extension ---------------- */
  var api = DDT && DDT.api;
  if (!api || !api.runtime || !api.runtime.id || root.__DDT_TEST) return;

  var port = null;
  var seq = 0;
  var waiting = {};
  function ensurePort() {
    if (port) return port;
    port = api.runtime.connect({ name: 'ddt' });
    port.onMessage.addListener(function (m) { var cb = waiting[m.id]; if (cb) { delete waiting[m.id]; cb(m); } });
    port.onDisconnect.addListener(function () {
      port = null;
      var w = waiting;
      waiting = {};
      Object.keys(w).forEach(function (id) { w[id]({ error: 'disconnected' }); });
    });
    return port;
  }
  var transport = {
    translate: function (texts, opts) {
      return new Promise(function (resolve) {
        var id = ++seq;
        waiting[id] = resolve;
        try { ensurePort().postMessage({ type: 'translate', id: id, texts: texts, opts: opts }); } catch (e) {
          delete waiting[id];
          port = null;
          resolve({ error: 'disconnected' });
        }
      });
    }
  };
  function transcribe(b64, mime) {
    return api.runtime.sendMessage({ type: 'transcribe', audio: b64, mime: mime }).catch(function (e) {
      return { ok: false, error: 'error', message: String(e && e.message || e) };
    });
  }

  var voice = createVoice(document, window, { transport: transport, transcribe: transcribe });
  root.__DDT_VOICE = voice;

  api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.to !== 'voice') return;
    if (msg.cmd === 'status') { sendResponse(voice.status()); return; }
    if (msg.cmd === 'stop') { sendResponse(voice.stop()); return; }
    api.storage.local.get('settings').then(function (r) {
      var s = Object.assign({}, DDT.DEFAULT_SETTINGS, (r && r.settings) || {});
      var opts = { settings: s, keyId: msg.keyId };
      sendResponse(msg.cmd === 'toggle' ? voice.toggle(opts) : voice.start(opts));
    }).catch(function (e) { sendResponse({ ok: false, error: String(e) }); });
    return true;
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
