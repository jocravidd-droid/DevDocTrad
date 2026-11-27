/*
 * DevDocTrad - voice.js
 * Traduit la voix des vidéos, gratuitement, en sous-titres affichés sur la vidéo.
 *
 * Sources, dans cet ordre :
 *   1. les sous-titres de la vidéo (<track>, pistes texte HTML5) : traduits à l'avance, sans aucun coût audio ;
 *   2. YouTube : la transcription entière (fichier de sous-titres du lecteur, jeton « pot » compris),
 *      traduite d'avance (par YouTube lui-même si la langue est proposée) et dite à l'heure de chaque phrase ;
 *      repli : le texte des sous-titres affiché à l'écran ;
 *   3. sinon, le son de la vidéo : morceaux de quelques secondes transcrits par Groq Whisper
 *      (palier gratuit, avec la clé Groq de l'utilisateur), puis traduits comme le reste.
 * Trois modes (popup) : sous-titres ; sous-titres + voix traduite (doublage) ; voix traduite seule.
 * La voix est produite par l'extension elle-même (message « speak » au background : chrome.tts sous
 * Chrome / Edge / Brave, speechSynthesis de la page de fond sous Firefox), gratuite, calée sur les
 * sous-titres et multipliée par la vitesse choisie, pendant que le son d'origine est baissé.
 * Pourquoi pas speechSynthesis dans la page : Chrome la refuse (« not-allowed ») tant que la page n'a
 * reçu aucun clic, et le clic dans le popup ne compte pas. Elle ne sert plus que de repli.
 *
 * Vidéos et sons (<video>, <audio>) cherchés aussi dans les shadow roots ouverts (lecteurs en composants
 * web). Lecteur intégré d'un autre site (<iframe> YouTube, Vimeo...) : lien pour l'ouvrir dans un onglet.
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
  var YT_POLL_MS = 300;          // transcription : nouvel essai (lecteur pas prêt, adresse avec jeton attendue)
  var YT_POT_WAIT_MS = 5000;     // attente de la demande de sous-titres du lecteur (jeton « pot »)
  var YT_INFO_WAIT_MS = 4000;    // attente du lecteur de la nouvelle vidéo (navigation interne)
  var AHEAD_SEC = 150;           // transcription : phrases traduites d'avance (2 min 30 devant la lecture)
  var TICK_MS = 150;             // transcription : phrase en cours relue sur video.currentTime
  var BATCH = 40;                // sous-titres traduits par demande
  var WATCH_MS = 1000;           // surveillance : vidéo retirée ou remplacée, vidéo YouTube suivante
  var OWN_LABEL = 'DevDocTrad';  // piste texte ajoutée pour le plein écran natif (jamais prise comme source)
  var DUCK = 0.15;               // doublage : son d'origine à 15 % pendant que la voix parle
  var RAMP_MS = 280;             // durée de la baisse ou de la remontée du son
  var UNDUCK_MS = 350;           // silence entre deux phrases avant de remonter le son
  var MAX_LAG_MS = 2000;         // retard de la voix au-delà duquel la phrase en cours est coupée
  var RATE_MIN = 0.9;            // calage sur la durée du sous-titre (jamais plus de 1,3 par lui-même)
  var RATE_MAX = 1.3;
  var FINAL_RATE_MIN = 0.5;      // après la vitesse choisie par l'utilisateur
  var FINAL_RATE_MAX = 1.5;      // au-delà, une voix de synthèse devient incompréhensible
  var ROBOTIC_RATE_MAX = 1.15;   // eSpeak et voix basiques : pas de calage, vitesse de l'utilisateur bornée
  var TTS_MAX_CHARS = 1000;      // texte d'une phrase envoyée à la synthèse (limite du background)
  var VOICES_WAIT_MS = 1500;     // attente de « voiceschanged » (liste des voix chargée plus tard)
  var MAX_SHADOW_DEPTH = 8;

  /* Lecteurs vidéo intégrés connus (adresse d'un <iframe>) */
  var PLAYER_RE = new RegExp([
    'youtube(-nocookie)?\\.com/(embed|shorts|live)/', 'youtu\\.be/', 'player\\.vimeo\\.com/', 'vimeo\\.com/(video|event)/',
    'dailymotion\\.com/(embed|player)', 'geo\\.dailymotion\\.com/', 'dai\\.ly/', 'wistia\\.(com|net)/', 'wi\\.st/',
    'loom\\.com/(embed|share)/', 'player\\.twitch\\.tv', 'clips\\.twitch\\.tv', 'streamable\\.com/[eo]/', 'vidyard\\.com/',
    'players\\.brightcove\\.net/', 'jwplayer\\.com/players', 'jwplatform\\.com/', 'facebook\\.com/plugins/video',
    'player\\.bilibili\\.com/', 'rumble\\.com/embed/', 'embed\\.ted\\.com/', '/videos/embed/', 'bitchute\\.com/embed/',
    'odysee\\.com/\\$/embed/', 'vk\\.com/video_ext', 'ok\\.ru/videoembed/', 'mediadelivery\\.net/embed/',
    'cloudflarestream\\.com/', 'videodelivery\\.net/', 'vidyard\\.com/', 'kaltura\\.com/', 'panopto\\.(com|eu)/',
    'canva\\.com/design/.*/watch', 'descript\\.com/embed', 'tella\\.tv/video'
  ].join('|'), 'i');

  /* Langue et qualité des voix : outils partagés avec les réglages (shared.js) */
  function normLang(code) { return String(code || '').replace(/_/g, '-').toLowerCase(); }
  function primary(code) { return normLang(code).split('-')[0]; }
  var LANG_ALIAS = DDT.LANG_ALIAS;
  function sameLanguage(voiceLang, target) { return DDT.sameLanguage(voiceLang, target); }
  /* Meilleure voix de la langue cible (jamais une autre langue) : Google <langue>, puis voix réseau ou
     naturelles, puis locales correctes, eSpeak et voix basiques en dernier. opts : { name, linux }. */
  function pickTtsVoice(voices, target, opts) { return DDT.pickTtsVoice(voices, target, opts); }
  /* Durée naturelle d'une phrase (secondes, vitesse 1) : environ 15 caractères par seconde,
     moins pour le chinois, le japonais et le coréen (une syllabe par caractère). */
  function speechSeconds(text, lang) {
    var n = String(text || '').replace(/\s+/g, '').length;
    var cps = /^(zh|ja)/.test(primary(lang)) ? 6.5 : primary(lang) === 'ko' ? 8 : 15;
    return 0.15 + n / cps;
  }
  /* Vitesse de lecture : la phrase doit tenir dans le temps du sous-titre (moins le retard de la voix),
     bornée entre 0,9 et 1,3. Sans durée connue (YouTube, son transcrit) : rythme un peu soutenu. */
  function dubRate(text, availSec, lagSec, lang) {
    var est = speechSeconds(text, lang);
    var lag = Math.max(0, lagSec || 0);
    var room = availSec == null ? est / 1.1 - lag : availSec - lag;
    room = Math.max(room, 0.4);
    var r = est / room;
    return Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, r)) * 100) / 100;
  }

  function cueText(s) {
    return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim();
  }

  /* ---------------- YouTube : transcription entière (outils sans état, testés à part) ----------------
   * Les sous-titres de YouTube (fichier « timedtext ») sont lus d'avance, en entier, horodatés :
   * format json3 (events[].tStartMs / dDurationMs / segs[].utf8 / tOffsetMs ; un « seg » par mot pour les
   * sous-titres automatiques) ou XML (srv1 <text start dur>, srv3 <p t d>). Tout ce qui vient de la page
   * est traité comme du texte non sûr : jamais interprété, seulement affiché avec textContent. */
  var CJK_RE = /[぀-ヿ㐀-鿿豈-﫿가-힯]/;
  var SENT_END_RE = /[.!?。！？…‼⁇]["'»”’)\]]*\s*$/;
  var SENT_MAX_SEC = 12;         // phrase fusionnée : 12 s au plus
  var SENT_SOFT_SEC = 6;         // au-delà, coupée à la première petite pause (sous-titres sans ponctuation)
  var SENT_PAUSE_SEC = 1;        // silence qui termine une phrase
  var WORD_MAX_SEC = 0.8;        // durée prise pour un mot des sous-titres automatiques (avant le suivant)

  /* Fichier timedtext -> morceaux { start, end, text, first } triés (secondes). first : début d'une ligne
     (une espace la sépare de la précédente ; dans une ligne, les mots gardent leurs propres espaces). */
  function parseTimedText(raw, DOMParserCtor) {
    var s = String(raw || '').replace(/^﻿/, '').trim();
    var out = [];
    if (!s) return out;
    if (s.charAt(0) === '{') {
      var j = null;
      try { j = JSON.parse(s); } catch (e) { return out; }
      var events = j && Array.isArray(j.events) ? j.events : [];
      events.forEach(function (ev) {
        if (!ev || !Array.isArray(ev.segs)) return;
        var st = Number(ev.tStartMs) || 0;
        var du = Math.max(0, Number(ev.dDurationMs) || 0);
        var toks = [];
        ev.segs.forEach(function (g) {
          var tx = g && typeof g.utf8 === 'string' ? g.utf8.replace(/\n/g, ' ') : '';
          if (!tx.trim()) return;
          toks.push({ t: (st + Math.max(0, Number(g.tOffsetMs) || 0)) / 1000, text: tx });
        });
        var word = toks.length > 1;
        toks.forEach(function (k, i) {
          var end = i + 1 < toks.length ? toks[i + 1].t : (st + du) / 1000;
          if (word) end = Math.min(end, k.t + WORD_MAX_SEC + 0.05 * k.text.trim().length);
          out.push({ start: k.t, end: Math.max(end, k.t), text: k.text, first: i === 0, word: word });
        });
      });
    } else if (s.charAt(0) === '<' && DOMParserCtor) {
      var xml = null;
      try { xml = new DOMParserCtor().parseFromString(s, 'text/xml'); } catch (e) { return out; }
      if (!xml || xml.getElementsByTagName('parsererror').length) return out;
      var add = function (start, dur, text) {
        var tx = cueText(text);
        if (!tx || !isFinite(start)) return;
        out.push({ start: start, end: start + Math.max(0, dur || 0), text: tx, first: true, word: false });
      };
      var texts = xml.getElementsByTagName('text');
      for (var i = 0; i < texts.length; i++) {
        add(parseFloat(texts[i].getAttribute('start')), parseFloat(texts[i].getAttribute('dur')), texts[i].textContent);
      }
      var ps = xml.getElementsByTagName('p');
      for (var k2 = 0; k2 < ps.length; k2++) {
        add(parseFloat(ps[k2].getAttribute('t')) / 1000, parseFloat(ps[k2].getAttribute('d')) / 1000, ps[k2].textContent);
      }
    }
    out.sort(function (a, b) { return a.start - b.start; });
    // un morceau s'arrête au plus tard quand le suivant commence (les lignes de YouTube se chevauchent)
    for (var n = 0; n + 1 < out.length; n++) {
      if (out[n + 1].start > out[n].start && out[n].end > out[n + 1].start) out[n].end = out[n + 1].start;
    }
    return out;
  }
  function joinText(a, b, newLine) {
    if (!a) return b;
    if (!newLine) return a + b;
    var last = a.replace(/\s+$/, '').slice(-1);
    var next = b.replace(/^\s+/, '').charAt(0);
    return CJK_RE.test(last) && CJK_RE.test(next) ? a.replace(/\s+$/, '') + b.replace(/^\s+/, '') : a + ' ' + b;
  }
  /* Morceaux -> phrases { start, end, text } : coupées à la ponctuation de fin, à un silence, à 12 s au
     plus (et dès 6 s à la première petite pause, pour les sous-titres automatiques sans ponctuation).
     La fin d'une phrase est prolongée jusqu'à la suivante (1 s au plus) : plus de temps pour la voix. */
  function mergeSentences(cues, maxSec) {
    maxSec = maxSec || SENT_MAX_SEC;
    var out = [];
    var cur = null;
    function flush() {
      if (!cur) return;
      var text = cueText(cur.text);
      if (text) out.push({ start: cur.start, end: cur.end, text: text });
      cur = null;
    }
    (cues || []).forEach(function (c) {
      if (!c || !c.text) return;
      if (cur) {
        var gap = c.start - cur.end;
        if (gap > SENT_PAUSE_SEC || c.end - cur.start > maxSec || (cur.end - cur.start >= SENT_SOFT_SEC && gap >= 0.3)) flush();
      }
      if (!cur) cur = { start: c.start, end: c.end, text: '' };
      cur.text = joinText(cur.text, c.text, c.first !== false);
      cur.end = Math.max(cur.end, c.end);
      if (SENT_END_RE.test(c.text) && cur.end - cur.start >= 0.6) flush();
    });
    flush();
    for (var i = 0; i + 1 < out.length; i++) {
      out[i].end = Math.max(out[i].end, Math.min(out[i + 1].start, out[i].end + 1));
    }
    return out;
  }
  /* Texte d'origine de chaque phrase traduite : les morceaux d'origine qui commencent pendant cette phrase */
  function originalsFor(sentences, cues) {
    var parts = sentences.map(function () { return ''; });
    var i = 0;
    (cues || []).forEach(function (c) {
      while (i + 1 < sentences.length && c.start >= sentences[i + 1].start - 0.05) i++;
      if (sentences.length) parts[i] = joinText(parts[i], c.text, c.first !== false);
    });
    return parts.map(cueText);
  }
  /* Piste choisie : celle de la langue parlée, écrite à la main avant l'automatique (« asr ») ;
     une piste écrite à la main déjà dans la langue cible passe avant tout (traduction humaine). */
  function pickCaptionTrack(tracks, spokenLang, target) {
    var list = (tracks || []).filter(function (k) { return k && k.lang && k.url; });
    var asr = list.filter(function (k) { return k.kind === 'asr'; });
    var manual = list.filter(function (k) { return k.kind !== 'asr'; });
    var spoken = spokenLang || (asr[0] && asr[0].lang) || '';
    var find = function (arr, lang) { return arr.filter(function (k) { return sameLanguage(k.lang, lang); })[0] || null; };
    return find(manual, target) || (spoken && (find(manual, spoken) || find(asr, spoken))) ||
      manual.filter(function (k) { return !sameLanguage(k.lang, target); })[0] || manual[0] || asr[0] || null;
  }
  /* Code de langue de YouTube (translationLanguages) pour la langue cible : zh-CN -> zh-Hans, he -> iw... */
  function ytLanguage(codes, target) {
    var tg = normLang(target);
    var want = [{ 'zh-cn': 'zh-hans', 'zh-tw': 'zh-hant' }[tg] || tg, tg, primary(tg)].concat(LANG_ALIAS[primary(tg)] || []);
    for (var i = 0; i < want.length; i++) {
      for (var j = 0; j < (codes || []).length; j++) if (normLang(codes[j]) === want[i]) return codes[j];
    }
    return '';
  }
  /* Adresses timedtext à essayer, dans l'ordre :
     1. l'adresse de la piste (baseUrl) complétée par les paramètres de celle demandée par le lecteur
        lui-même (jeton « pot » exigé désormais par YouTube : sans lui, la réponse est souvent vide) ;
     2. l'adresse demandée par le lecteur (sa piste à lui, jeton compris) ;
     3. la baseUrl nue. Toujours au format json3, jamais traduite (tlang ajouté plus tard). */
  function captionUrls(track, observed, base) {
    var out = [];
    var push = function (u) {
      if (!u) return;
      u.searchParams.set('fmt', 'json3');
      u.searchParams.delete('tlang');
      if (out.indexOf(u.href) === -1) out.push(u.href);
    };
    var parse = function (s) { try { return new URL(s, base); } catch (e) { return null; } };
    var obs = parse(observed);
    if (obs && !/\/api\/timedtext$/.test(obs.pathname)) obs = null;
    var bu = track && parse(track.url);
    if (bu && obs) {
      var merged = parse(bu.href);
      obs.searchParams.forEach(function (v, k) { if (!merged.searchParams.has(k) && k !== 'tlang' && k !== 'fmt') merged.searchParams.set(k, v); });
      push(merged);
    }
    if (obs) push(obs);
    if (bu) push(bu);
    return out;
  }
  /* Adresses timedtext vues par le lecteur (entrées de performance) pour cette vidéo, jeton « pot » d'abord */
  function observedUrls(list, videoId, base) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (s) {
      var u;
      try { u = new URL(String(s), base); } catch (e) { return; }
      if (!/\/api\/timedtext$/.test(u.pathname)) return;
      if (videoId && u.searchParams.get('v') && u.searchParams.get('v') !== videoId) return;
      out.push(u.href);
    });
    var pot = out.filter(function (s) { return /[?&]pot=/.test(s); });
    return pot.reverse().concat(out.filter(function (s) { return pot.indexOf(s) === -1; }).reverse());
  }

  function createVoice(doc, win, deps) {
    var transport = deps.transport;
    var transcribe = deps.transcribe;
    var t = deps.t || DDT.t;
    var settings = Object.assign({}, DDT.DEFAULT_SETTINGS, deps.settings || {});
    var keyId = null;
    var chunkMs = deps.chunkMs || CHUNK_MS;
    var ytWaitMs = deps.ytWaitMs || YT_WAIT_MS;
    var watchMs = deps.watchMs || WATCH_MS;
    var ytPollMs = deps.ytPollMs || YT_POLL_MS;
    var ytPotWaitMs = deps.ytPotWaitMs || YT_POT_WAIT_MS;
    var ytInfoWaitMs = deps.ytInfoWaitMs || YT_INFO_WAIT_MS;
    var openAction = null;       // bouton de la barre : ouvrir la vidéo dans un onglet, ou les réglages
    var noCaptions = false;      // YouTube sans aucun sous-titre : message propre si la clé Groq manque
    var ytUnreadable = false;    // YouTube : des pistes existent mais n'ont pas pu être lues (autre message)
    var diag = [];               // diagnostic : sources essayées et leur résultat (statut, tools/yt_probe.js)
    var diagT0 = Date.now();
    var sentCount = 0;           // phrases de la transcription en cours (YouTube)

    var active = false;
    var mode = null;             // 'track' | 'youtube' | 'audio'
    var video = null;
    var message = '';
    var cleanups = [];           // bande et surveillance : défaits à l'arrêt
    var srcCleanups = [];        // source en cours (pistes, YouTube, son) : défaits aussi au changement de vidéo
    var ytCurrent = null;        // identifiant de la vidéo YouTube en cours (null : pas YouTube)
    var memo = {};               // texte original -> traduction
    var pending = {};            // texte original -> promesse
    var speaking = false;        // doublage (lecture à voix haute) en marche
    var frameAnchor = null;      // <iframe> de lecteur signalé quand la page n'a pas de vidéo
    var ttsVoice = null;         // voix de synthèse choisie pour la langue cible
    var ttsKind = null;          // moteur de cette voix : 'tts' (chrome.tts), 'synth' (Firefox, page de fond), 'page'
    var ttsTier = null;          // qualité de cette voix (4 Google, 3 naturelle, 2 locale, 1 robotique : eSpeak)
    var voiceInfo = { ext: null, page: null, engine: null };   // nombre de voix vues (diagnostic, aide Linux)
    var noVoice = '';            // message « pas de voix » gardé dans la barre
    var warnText = '';           // avertissement persistant de la barre (pas de voix, voix robotique)
    var warnKind = null;
    var voicesPromise = null;    // voix de la page (repli)
    var choicePromise = null;    // voix choisie : { kind: 'ext' | 'page', voice, engine }
    var extBroken = false;       // synthèse de l'extension indisponible : repli sur la page
    var extUsed = false;         // au moins une phrase envoyée au background (à couper à l'arrêt)
    var clickArmed = false;      // repli page sous Chrome : phrase redite au premier clic
    var lastRate = null;         // vitesse de la dernière phrase envoyée
    var rawSettings = deps.settings || {};
    var voiceMode = DDT.voiceModeOf(rawSettings);
    var userRate = DDT.clampVoiceRate(rawSettings.voiceRate);
    var frameMode = false;       // message « lecteur intégré » affiché (pas de voix)
    var fsSync = null;           // plein écran natif : resynchronise la piste DevDocTrad (mode voix seule)
    var speakGen = 0;            // incrémenté à chaque annulation : les rappels des phrases annulées sont ignorés
    var queued = 0;              // phrases envoyées à la synthèse et pas encore finies
    var speakEnd = 0;            // heure (ms) prévue de fin des phrases en file
    var lastSaid = '';           // dernière phrase envoyée (évite de la redire en double)
    var live = [];               // phrases en cours : gardées en mémoire (Chrome perd sinon leurs événements)
    var baseVolume = null;       // volume d'origine pendant le doublage (null : son non baissé)
    var ducked = false;
    var rampTimer = null;
    var volumeHook = null;       // Firefox (mozCaptureStream) : recopie le volume de la vidéo sur le son renvoyé
    var unduckTimer = null;
    var resumeHook = null;       // source en cours : redire le bon sous-titre après une pause ou un saut
    var mediaOff = null;         // retire les écouteurs pause / lecture / saut de la vidéo suivie
    var rampMs = deps.rampMs != null ? deps.rampMs : RAMP_MS;
    var unduckMs = deps.unduckMs != null ? deps.unduckMs : UNDUCK_MS;
    var host = null;
    var box = null;
    var lastShown = '';
    var stats = { translated: 0, transcribed: 0 };

    function note(src, result) {
      diag.push({ t: Math.round((Date.now() - diagT0) / 100) / 10, src: String(src).slice(0, 40),
        result: String(result == null ? '' : result).slice(0, 240) });
      if (diag.length > 80) diag.shift();
    }

    /* ---------------- Choix de la vidéo (ou du son) ---------------- */
    function area(v) {
      var r = v.getBoundingClientRect ? v.getBoundingClientRect() : { width: 0, height: 0 };
      return Math.max(0, r.width) * Math.max(0, r.height);
    }
    /* Surface réellement visible dans la fenêtre */
    function visibleArea(el) {
      if (!el.getBoundingClientRect) return 0;
      var r = el.getBoundingClientRect();
      var vw = win.innerWidth || 1024;
      var vh = win.innerHeight || 768;
      var w = Math.min(r.right != null ? r.right : r.left + r.width, vw) - Math.max(r.left || 0, 0);
      var h = Math.min(r.bottom != null ? r.bottom : r.top + r.height, vh) - Math.max(r.top || 0, 0);
      return Math.max(0, w) * Math.max(0, h);
    }
    /* <video>, <audio> et <iframe> du document et des shadow roots ouverts (lecteurs en composants web) */
    function collect(node, out, depth) {
      var list;
      try { list = node.querySelectorAll('video, audio, iframe'); } catch (e) { return; }
      for (var i = 0; i < list.length; i++) (list[i].tagName === 'IFRAME' ? out.frames : out.media).push(list[i]);
      if (depth >= MAX_SHADOW_DEPTH) return;
      var all = node.querySelectorAll('*');
      for (var j = 0; j < all.length; j++) {
        var sr = all[j].shadowRoot;
        if (sr && sr !== host && all[j] !== host) collect(sr, out, depth + 1);
      }
    }
    function scan() {
      var out = { media: [], frames: [] };
      collect(doc, out, 0);
      return out;
    }
    function playing(m) { return !m.paused && !m.ended; }
    function hasSource(m) {
      return !!(m.currentSrc || m.src || m.srcObject || (m.querySelector && m.querySelector('source[src]')) ||
        (m.textTracks && m.textTracks.length));
    }
    /* Plusieurs vidéos : celle qui joue, sinon la plus grande visible ; une vidéo passe avant un son */
    function pickVideo() {
      var list = scan().media;
      if (!list.length) return null;
      var info = list.map(function (m, i) {
        return { m: m, i: i, play: playing(m) ? 1 : 0, area: visibleArea(m) || area(m) * 0.001,
          video: m.tagName === 'VIDEO' ? 1 : 0, src: hasSource(m) ? 1 : 0 };
      });
      info.sort(function (a, b) {
        return (b.play - a.play) || (b.area - a.area) || (b.video - a.video) || (b.src - a.src) || (a.i - b.i);
      });
      return info[0].m;
    }
    function isAudio(m) { return !!m && m.tagName === 'AUDIO'; }
    /* Lecteur intégré d'un autre site : l'extension n'est injectée que dans le cadre principal.
       On rend l'adresse à ouvrir dans un onglet (YouTube : page de la vidéo, avec ses sous-titres). */
    function playerUrl(src) {
      var u;
      try { u = new URL(src, doc.baseURI); } catch (e) { return ''; }
      if (!/^https?:$/.test(u.protocol)) return '';
      var yt = /(^|\.)youtube(-nocookie)?\.com$/i.test(u.hostname) && /^\/(embed|shorts|live)\/([^/?#]+)/.exec(u.pathname);
      if (yt && yt[2] !== 'videoseries') {
        var start = u.searchParams.get('start') || u.searchParams.get('t');
        return 'https://www.youtube.com/watch?v=' + encodeURIComponent(yt[2]) + (start ? '&t=' + encodeURIComponent(start) : '');
      }
      return u.href;
    }
    function isPlayerFrame(f) {
      var src = f.src || f.getAttribute('src') || f.getAttribute('data-src') || '';
      if (!src || /^(about|javascript|data|blob):/i.test(src)) return false;
      if (PLAYER_RE.test(src)) return true;
      var allow = (f.getAttribute('allow') || '') + (f.hasAttribute('allowfullscreen') ? ' fullscreen' : '');
      return /fullscreen|autoplay|encrypted-media|picture-in-picture/i.test(allow) && /embed|player|video/i.test(src);
    }
    function pickPlayerFrame(frames) {
      var best = null;
      var bestArea = 0;
      (frames || scan().frames).forEach(function (f) {
        var a = visibleArea(f);
        var r = f.getBoundingClientRect ? f.getBoundingClientRect() : { width: 0, height: 0 };
        if (r.width < 120 || r.height < 68 || a <= 0 || !isPlayerFrame(f)) return;
        if (a > bestArea) { best = f; bestArea = a; }
      });
      return best;
    }
    function isYouTube() { return /(^|\.)youtube(-nocookie)?\.com$/i.test(win.location.hostname); }
    function textTracks(v) {
      var out = [];
      var tl = v && v.textTracks;
      if (!tl) return out;
      for (var i = 0; i < tl.length; i++) {
        if (tl[i].label === OWN_LABEL) continue;   // notre propre piste du plein écran
        if (tl[i].kind === 'subtitles' || tl[i].kind === 'captions') out.push(tl[i]);
      }
      return out;
    }

    /* ---------------- Traduction ---------------- */
    function translateMany(texts) {
      // mémoire capturée : une traduction qui arrive après un changement de vidéo YouTube
      // ne remplit pas la nouvelle mémoire
      var store = memo;
      var pend = pending;
      var todo = [];
      texts.forEach(function (s) { if (s && !(s in store) && !pend[s] && todo.indexOf(s) === -1) todo.push(s); });
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
              if (typeof tr === 'string') { store[s] = DDT.plainText(tr); stats.translated++; }
            });
          });
        });
        b.forEach(function (s) { pend[s] = p; });
        seq = p.then(function () { b.forEach(function (s) { delete pend[s]; }); },
          function () { b.forEach(function (s) { delete pend[s]; }); });
      });
      return seq;
    }
    function translateOne(s) {
      if (s in memo) return Promise.resolve(memo[s]);
      if (!pending[s]) translateMany([s]);
      return (pending[s] || Promise.resolve()).then(function () { return memo[s]; });
    }
    function noteError(res) {
      // réponse arrivée après « Arrêter » : rien à afficher (sinon la bande est recréée)
      if (!res || !active) return;
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
      '.orig:empty,.tr:empty,.line[hidden]{display:none}',
      '.bar{pointer-events:auto;display:flex;gap:6px;align-items:center;font:500 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;',
      'color:#fff;background:rgba(0,0,0,.6);border-radius:999px;padding:3px 4px 3px 10px}',
      '.bar button{all:unset;cursor:pointer;width:24px;height:24px;border-radius:12px;display:grid;place-items:center}',
      '.bar button:hover{background:rgba(255,255,255,.18)}',
      '.bar button:focus-visible{outline:2px solid #4da3ff;outline-offset:1px}',
      '.bar button[aria-pressed=true]{background:#0a84ff}',
      '.bar button[disabled]{opacity:.4;cursor:default;background:none}',
      '.bar svg{width:15px;height:15px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.msg{max-width:46ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.msg:empty{display:none}',
      '.msg.long{white-space:normal;max-width:60ch;padding:3px 0}',
      '.rates{display:flex;align-items:center;gap:1px}',
      '.rates[hidden],.bar button[hidden],.warn[hidden]{display:none}',
      '.warn{flex:none;padding:2px 8px;border-radius:999px;background:#b45309;color:#fff;font-weight:600;white-space:nowrap;cursor:help}',
      '.rate{min-width:3.4em;text-align:center;font-variant-numeric:tabular-nums}',
      '.bar button.open{width:auto;padding:0 10px;background:#0a84ff;font-weight:600;white-space:nowrap}',
      '.bar button.open:hover{background:#3d9bff}'
    ].join('');
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var ICON_SPEAK = ['M4 9v6h4l5 4V5L8 9z', 'M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12'];
    var ICON_CLOSE = ['M6 6l12 12M18 6L6 18'];
    var ICON_MINUS = ['M6 12h12'];
    var ICON_PLUS = ['M12 6v12M6 12h12'];

    /* Bande construite élément par élément (jamais de HTML en texte : rien de la page ni des
       traductions ne peut y devenir du code) */
    function make(tag, cls) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      return e;
    }
    function icon(paths) {
      var svg = doc.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      paths.forEach(function (d) {
        var p = doc.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d);
        svg.appendChild(p);
      });
      return svg;
    }
    function iconButton(cls, paths, label) {
      var b = make('button', cls);
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.appendChild(icon(paths));
      return b;
    }
    function ensureBox() {
      if (host) return;
      host = doc.createElement('div');
      host.setAttribute('data-tr-ui', 'voice');
      host.setAttribute('translate', 'no');
      var sr = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
      var style = doc.createElement('style');
      style.textContent = CSS;
      sr.appendChild(style);
      box = make('div', 'box');
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', t('popupVoice'));
      var orig = make('div', 'line orig');
      var tr = make('div', 'line tr');
      // aria-live seulement sur la traduction (pas sur les boutons ni les messages), et coupé
      // pendant la lecture à voix haute : sinon le lecteur d'écran la lirait une seconde fois
      tr.setAttribute('aria-live', speaking ? 'off' : 'polite');
      var bar = make('div', 'bar');
      var msg = make('span', 'msg');
      var warn = make('span', 'warn');
      warn.hidden = true;
      warn.setAttribute('role', 'note');
      var open = make('button', 'open');
      open.type = 'button';
      open.hidden = true;
      open.textContent = t('voiceOpenTab');
      open.addEventListener('click', function () { if (openAction) openAction(); });
      var speak = iconButton('speak', ICON_SPEAK, t('voiceSpeak'));
      speak.setAttribute('aria-pressed', 'false');
      speak.addEventListener('click', function () { setSpeaking(!speaking); });
      // vitesse de la voix : − / valeur / +, appliquée dès la phrase suivante et enregistrée
      var rates = make('span', 'rates');
      rates.setAttribute('role', 'group');
      rates.setAttribute('aria-label', t('optVoiceRate'));
      var slower = iconButton('slower', ICON_MINUS, t('voiceSlower'));
      var value = make('span', 'rate');
      var faster = iconButton('faster', ICON_PLUS, t('voiceFaster'));
      slower.addEventListener('click', function () { setRate(userRate - 0.1, true); });
      faster.addEventListener('click', function () { setRate(userRate + 0.1, true); });
      rates.appendChild(slower);
      rates.appendChild(value);
      rates.appendChild(faster);
      var close = iconButton('close', ICON_CLOSE, t('btnClose'));
      close.addEventListener('click', function () { stop(); });
      [warn, msg, open, speak, rates, close].forEach(function (n) { bar.appendChild(n); });
      [orig, tr, bar].forEach(function (n) { box.appendChild(n); });
      sr.appendChild(box);
      renderSpeak();
      renderWarn();
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
    /* Bande sur la vidéo ; pour un son (<audio>, podcast) ou sans vidéo visible : en bas de la fenêtre */
    function position() {
      if (!box) return;
      var anchor = video || frameAnchor;
      var r = anchor && !isAudio(anchor) && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { width: 0, height: 0, top: 0, bottom: 0, left: 0 };
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
    /* « Voix traduite seule » : pas de lignes de texte tant que la voix parle (seulement la barre).
       Sans voix (aucune pour la langue, haut-parleur coupé) : les sous-titres reviennent. */
    function linesHidden() { return voiceMode === 'voice' && speaking; }
    function show(original, translated, timing) {
      if (!active) return;            // réponse asynchrone arrivée après « Arrêter »
      ensureBox();
      var bilingual = settings.mode === 'bilingual';
      box.querySelector('.orig').textContent = bilingual && translated ? original || '' : '';
      box.querySelector('.tr').textContent = translated || '';
      box.classList.add('on');
      position();
      if (translated && translated !== lastShown) {
        lastShown = translated;
        if (speaking) say(translated, timing);
      }
    }
    function clearLines() {
      if (!box) return;
      box.querySelector('.orig').textContent = '';
      box.querySelector('.tr').textContent = '';
    }
    /* Après « Arrêter », aucun message (erreur, transcription en retard) ne recrée la bande,
       ses écouteurs ni son intervalle. */
    function setMessage(m, action) {
      if (!active) return;
      message = m || '';
      ensureBox();
      box.querySelector('.msg').textContent = message;
      box.querySelector('.msg').title = message;
      box.querySelector('.msg').classList.toggle('long', !!action);
      setAction(action || null);
      box.classList.add('on');
      position();
    }
    /* Bouton de la barre à côté du message (ouvrir la vidéo dans un onglet, ouvrir les réglages) */
    function setAction(action) {
      if (!box) return;
      var open = box.querySelector('.open');
      openAction = action ? action.run : null;
      open.hidden = !action;
      if (action) open.textContent = action.label;
    }
    /* Clé Groq manquante : bouton qui ouvre les réglages (message au background) */
    function settingsAction() {
      if (!deps.openOptions) return null;
      return { label: t('voiceOpenSettings'), run: function () {
        try { Promise.resolve(deps.openOptions()).catch(function () { /* rien */ }); } catch (e) { /* rien */ }
      } };
    }

    /* ---------------- Doublage : voix de synthèse (locale ou du navigateur, gratuite) ----------------
     * D'abord la synthèse de l'extension (deps.tts : messages au background, qui utilise chrome.tts sous
     * Chrome / Edge / Brave, speechSynthesis de sa page de fond sous Firefox) : elle parle sans clic dans
     * la page. Repli : speechSynthesis de la page (Chrome exige alors un clic dans la page). */
    function synth() { return win.speechSynthesis || null; }
    function pageSynthOk() { return !!synth() && !!win.SpeechSynthesisUtterance; }
    function targetLang() { return DDT.resolveTarget(settings.target); }
    /* Liste des voix de la page : souvent vide au premier appel, remplie à l'événement « voiceschanged » */
    function loadVoices() {
      if (voicesPromise) return voicesPromise;
      var s = synth();
      voicesPromise = new Promise(function (resolve) {
        var list = [];
        try { list = s.getVoices() || []; } catch (e) { list = []; }
        if (list.length) { resolve(list); return; }
        var done = false;
        var finish = function () {
          if (done) return;
          done = true;
          try { if (s.removeEventListener) s.removeEventListener('voiceschanged', finish); } catch (e) { /* rien */ }
          var l2 = [];
          try { l2 = s.getVoices() || []; } catch (e) { l2 = []; }
          if (!l2.length) voicesPromise = null;   // liste encore vide : nouvel essai au prochain doublage
          resolve(l2);
        };
        try {
          if (s.addEventListener) s.addEventListener('voiceschanged', finish);
          else s.onvoiceschanged = finish;
        } catch (e) { /* rien */ }
        win.setTimeout(finish, deps.voicesWaitMs || VOICES_WAIT_MS);
      });
      return voicesPromise;
    }
    /* Voix choisie : celle de l'extension si elle en a une pour la langue cible, sinon celle de la page ;
       jamais une voix d'une autre langue (sous-titres seuls, avec un message). Voix de l'extension
       robotique (eSpeak) et meilleure voix dans la page : celle de la page. null : aucune voix. */
    function linux() { return DDT.isLinuxUA(deps.userAgent || (win.navigator && win.navigator.userAgent) || ''); }
    function voiceOpts() { return { name: settings.voiceName || '', linux: linux() }; }
    function ensureVoice() {
      if (choicePromise) return choicePromise;
      var target = targetLang();
      var opts = voiceOpts();
      var ext = deps.tts && !extBroken
        ? Promise.resolve().then(function () { return deps.tts.voices(); }).catch(function () { return null; })
        : Promise.resolve(null);
      var p = ext.then(function (r) {
        var list = r && r.ok && Array.isArray(r.voices) ? r.voices : null;
        voiceInfo.ext = list ? list.length : null;
        voiceInfo.engine = r && r.engine || null;
        var v = list ? pickTtsVoice(list, target, opts) : null;
        var c = v ? { kind: 'ext', voice: v, engine: r.engine || 'tts', tier: DDT.voiceTier(v, opts) } : null;
        if (c && (c.tier > 1 || !pageSynthOk() || c.engine === 'synth')) return c;
        if (!pageSynthOk()) return c;
        return loadVoices().then(function (pl) {
          voiceInfo.page = pl.length;
          var pv = pickTtsVoice(pl, target, opts);
          var pc = pv ? { kind: 'page', voice: pv, engine: 'page', tier: DDT.voiceTier(pv, opts) } : null;
          return pc && (!c || pc.tier > c.tier) ? pc : c;
        });
      });
      choicePromise = p.then(function (c) {
        note('voice', c ? c.engine + ' ' + c.voice.name + ' (' + c.voice.lang + ', tier ' + c.tier + ')'
          : 'none for ' + target + ' (ext ' + voiceInfo.ext + ', page ' + voiceInfo.page + ')');
        if (!c) choicePromise = null;           // nouvel essai plus tard (voix installée, liste chargée)
        return c;
      });
      return choicePromise;
    }
    /* Sans voix : sous Linux avec Chrome et aucune voix du tout, l'aide pour en avoir une */
    function noVoiceMessage() {
      var name = DDT.languageName(targetLang());
      var ua = deps.userAgent || (win.navigator && win.navigator.userAgent) || '';
      if (linux() && /chrome|chromium/i.test(ua) && !/firefox/i.test(ua) && !voiceInfo.ext && !voiceInfo.page) {
        return t('voiceNoTtsLinux', [name]);
      }
      return t('voiceNoTts', [name]);
    }
    /* Avertissement gardé dans la barre (jamais effacé par les messages suivants) : pas de voix, ou voix robotique */
    function setWarn(kind, text) {
      warnKind = kind || null;
      noVoice = kind === 'novoice' ? text : '';
      warnText = text || '';
      renderWarn();
    }
    function renderWarn() {
      if (!box) return;
      var w = box.querySelector('.warn');
      w.hidden = !warnText;
      w.textContent = warnText ? t(warnKind === 'robotic' ? 'voiceRoboticShort' : 'voiceNoVoiceShort') : '';
      w.title = warnText;
      w.setAttribute('aria-label', warnText);
    }

    /* Volume de la vidéo. Avec mozCaptureStream, c'est le gain du son renvoyé aux haut-parleurs qui
       compte (video.volume n'agit plus) : il est recopié tout de suite, sans attendre « volumechange ». */
    function setVolume(v, x) {
      try { v.volume = x; } catch (e) { /* rien */ }
      if (volumeHook) volumeHook();
    }
    /* Son d'origine : baissé en douceur pendant que la voix parle, remonté entre les phrases */
    function ramp(to, done) {
      if (rampTimer) { win.clearInterval(rampTimer); rampTimer = null; }
      var v = video;
      if (!v) { if (done) done(); return; }
      to = Math.max(0, Math.min(1, to));
      var from = v.volume;
      var steps = Math.max(1, Math.round(rampMs / 40));
      if (!rampMs || Math.abs(from - to) < 0.005) {
        setVolume(v, to);
        if (done) done();
        return;
      }
      var k = 0;
      rampTimer = win.setInterval(function () {
        k++;
        setVolume(v, Math.max(0, Math.min(1, from + (to - from) * Math.min(1, k / steps))));
        if (k >= steps) { win.clearInterval(rampTimer); rampTimer = null; if (done) done(); }
      }, 40);
    }
    function duck() {
      if (!video) return;
      if (unduckTimer) { win.clearTimeout(unduckTimer); unduckTimer = null; }
      if (ducked) return;
      if (baseVolume === null) baseVolume = video.volume;   // volume choisi par l'utilisateur, relu à chaque reprise
      ducked = true;
      ramp(baseVolume * DUCK);
    }
    function scheduleUnduck() {
      if (unduckTimer) win.clearTimeout(unduckTimer);
      unduckTimer = win.setTimeout(function () {
        unduckTimer = null;
        if (queued || !ducked) return;
        ducked = false;
        var base = baseVolume;
        if (base === null) return;
        ramp(base, function () { if (!ducked) baseVolume = null; });
      }, unduckMs);
    }
    /* Volume d'origine rendu tout de suite (arrêt, changement de vidéo) */
    function restoreVolume() {
      if (unduckTimer) { win.clearTimeout(unduckTimer); unduckTimer = null; }
      if (rampTimer) { win.clearInterval(rampTimer); rampTimer = null; }
      if (baseVolume !== null && video) setVolume(video, baseVolume);
      baseVolume = null;
      ducked = false;
    }
    function cancelSpeech() {
      var had = queued;
      speakGen++;
      queued = 0;
      speakEnd = 0;
      lastSaid = '';
      live = [];
      var s = synth();
      if (s) { try { s.cancel(); } catch (e) { /* rien */ } }
      if (had && extUsed && deps.tts) {
        try { Promise.resolve(deps.tts.stop()).catch(function () { /* rien */ }); } catch (e) { /* rien */ }
      }
      if (ducked) scheduleUnduck();
    }
    /* Chrome, repli sur la synthèse de la page : la page n'a reçu aucun clic. Message clair, et la
       phrase affichée est redite au premier clic dans la page. */
    function needClick() {
      setMessage(t('voiceDubClick'));
      if (clickArmed) return;
      clickArmed = true;
      var onClick = function () {
        doc.removeEventListener('pointerdown', onClick, true);
        doc.removeEventListener('keydown', onClick, true);
        clickArmed = false;
        if (!active || !speaking || !lastShown) return;
        if (message === t('voiceDubClick')) setMessage('');
        lastSaid = '';
        win.setTimeout(function () { say(lastShown, null); }, 0);
      };
      doc.addEventListener('pointerdown', onClick, true);
      doc.addEventListener('keydown', onClick, true);
      cleanups.push(function () {
        doc.removeEventListener('pointerdown', onClick, true);
        doc.removeEventListener('keydown', onClick, true);
        clickArmed = false;
      });
    }
    /* Synthèse de la page : une phrase, réponse à sa fin (comme le message « speak » du background) */
    function pageSpeak(text, voice, lang, rate) {
      var s = synth();
      return new Promise(function (resolve) {
        var u = new win.SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = lang;
        u.rate = rate;
        var done = function (ev) {
          live = live.filter(function (x) { return x !== u; });
          resolve(ev && ev.error ? { ok: false, type: 'error', error: ev.error } : { ok: true, type: 'end' });
        };
        u.onend = done;
        u.onerror = done;
        live.push(u);                 // gardée en mémoire : Chrome perd sinon ses événements
        try { s.speak(u); } catch (e) { done({ error: 'error' }); }
      });
    }
    /* Vitesse d'une phrase : calage sur la durée du sous-titre (0,9 à 1,3), multiplié par la vitesse
       choisie par l'utilisateur, puis borné entre 0,5 et 1,5. Voix robotique (eSpeak, basique) : aucun
       calage, seulement la vitesse de l'utilisateur, bornée à 1,15 (au-delà, plus un mot compréhensible). */
    function finalRate(text, availSec, lagSec, lang, robotic) {
      var r = robotic ? Math.min(ROBOTIC_RATE_MAX, userRate) : dubRate(text, availSec, lagSec, lang) * userRate;
      return Math.round(Math.min(FINAL_RATE_MAX, Math.max(FINAL_RATE_MIN, r)) * 100) / 100;
    }
    /* Une phrase traduite à dire. timing.end : fin du sous-titre (temps de la vidéo), pour caler la vitesse. */
    function say(text, timing) {
      if (!text) return;
      ensureVoice().then(function (choice) {
        if (!speaking || !active || !choice) return;
        if (video && video.paused) return;            // reprise à la lecture (resumeHook)
        if (text === lastSaid && queued) return;       // déjà en cours (sous-titre redit après un saut)
        var availSec = null;
        if (timing && timing.end != null && video) {
          availSec = (timing.end - (video.currentTime || 0)) / (video.playbackRate || 1);
          if (availSec < 0.25) return;                 // sous-titre presque fini : trop tard
        }
        var now = Date.now();
        var lagMs = queued ? Math.max(0, speakEnd - now) : 0;
        // retard trop grand : la phrase en cours est coupée plutôt que d'accélérer
        if (lagMs > MAX_LAG_MS) { cancelSpeech(); lagMs = 0; }
        var lang = choice.voice.lang || targetLang();
        var robotic = choice.tier === 1;
        var rate = finalRate(text, availSec, lagMs / 1000, lang, robotic);
        // phrase qui ne tiendrait même pas à moitié dans le temps du sous-titre : sautée (pas accélérée)
        if (availSec != null && availSec < 2 && speechSeconds(text, lang) / rate > availSec * 2.5) {
          note('skip', 'too long for ' + availSec.toFixed(1) + ' s');
          return;
        }
        var spoken = text.length > TTS_MAX_CHARS ? text.slice(0, TTS_MAX_CHARS) : text;
        var gen = speakGen;
        var finished = false;
        var guard = null;
        var end = function (res) {
          if (finished) return;
          finished = true;
          if (guard) win.clearTimeout(guard);
          if (gen !== speakGen) return;
          queued = Math.max(0, queued - 1);
          var err = res && res.ok === false ? res.error || res.type : '';
          // Chrome refuse de parler tant que la page n'a reçu aucun clic : on le dit
          if (err === 'not-allowed') needClick();
          // l'extension ne sait pas parler : repli sur la page. Message perdu (service worker relancé) :
          // la voix de l'extension est redemandée à la phrase suivante, sans repli définitif sur la page
          // (que Chrome bloquerait sans clic).
          if (choice.kind === 'ext' && err === 'no_tts') { extBroken = true; choicePromise = null; }
          else if (choice.kind === 'ext' && err === 'disconnected') choicePromise = null;
          if (!queued) { speakEnd = 0; scheduleUnduck(); }
        };
        queued++;
        speakEnd = Math.max(now, speakEnd) + speechSeconds(text, lang) / rate * 1000;
        lastSaid = text;
        lastRate = rate;
        duck();
        // garde-fou : une fin de phrase perdue ne laisse jamais le son d'origine baissé
        guard = win.setTimeout(function () { end({ ok: false, type: 'timeout' }); },
          speechSeconds(text, lang) / rate * 2000 + 6000);
        var p;
        if (choice.kind === 'ext') {
          extUsed = true;
          p = Promise.resolve().then(function () {
            return deps.tts.speak({ text: spoken, lang: lang, rate: rate, voiceName: choice.voice.name });
          });
        } else {
          p = pageSpeak(spoken, choice.voice, lang, rate);
        }
        p.then(function (res) { end(res || { ok: false, error: 'disconnected' }); },
          function () { end({ ok: false, error: 'disconnected' }); });
      });
    }
    function renderSpeak() {
      if (!box) return;
      var b = box.querySelector('.speak');
      b.setAttribute('aria-pressed', speaking ? 'true' : 'false');
      var label = t(speaking ? 'voiceSpeakOff' : 'voiceSpeak') + (speaking && ttsVoice ? ' (' + ttsVoice.name + ')' : '');
      b.title = label;
      b.setAttribute('aria-label', label);
      box.querySelector('.tr').setAttribute('aria-live', speaking ? 'off' : 'polite');
      var hide = linesHidden();
      box.querySelector('.orig').hidden = hide;
      box.querySelector('.tr').hidden = hide;
      box.classList.toggle('voiceonly', hide);
      box.querySelector('.rates').hidden = !speaking || frameMode;
      renderRate();
      if (fsSync) fsSync();
    }
    function renderRate() {
      if (!box) return;
      var label = DDT.formatVoiceRate(userRate);
      var v = box.querySelector('.rate');
      v.textContent = label;
      v.title = t('voiceRateValue', [label]);
      box.querySelector('.slower').disabled = userRate <= DDT.VOICE_RATE_MIN;
      box.querySelector('.faster').disabled = userRate >= DDT.VOICE_RATE_MAX;
    }
    /* Vitesse choisie (0,5 à 2, pas de 0,1) : prise en compte dès la phrase suivante.
       save : enregistrée dans les réglages (boutons de la bande) ; sinon venue des réglages. */
    function setRate(x, save) {
      var r = DDT.clampVoiceRate(Math.round(Number(x) * 10) / 10);
      var changed = r !== userRate;
      userRate = r;
      settings.voiceRate = r;
      renderRate();
      if (changed && save && deps.saveRate) {
        try { Promise.resolve(deps.saveRate(r)).catch(function () { /* rien */ }); } catch (e) { /* rien */ }
      }
      return status();
    }
    /* Doublage marche/arrêt. Sans voix pour la langue cible : message clair, sous-titres seuls. */
    function setSpeaking(on) {
      var want = !!on && (!!deps.tts || pageSynthOk());
      if (!want) {
        speaking = false;
        renderSpeak();
        cancelSpeech();
        restoreVolume();
        if (on) { setWarn('novoice', noVoiceMessage()); setMessage(noVoice); }
        return Promise.resolve(false);
      }
      speaking = true;
      renderSpeak();
      return ensureVoice().then(function (choice) {
        if (!speaking) return false;
        if (!choice) {
          speaking = false;
          renderSpeak();
          if (active) { setWarn('novoice', noVoiceMessage()); setMessage(noVoice); }
          return false;
        }
        ttsVoice = choice.voice;
        ttsKind = choice.engine;
        ttsTier = choice.tier;
        if (choice.tier === 1) {
          // seule voix : eSpeak ou basique (Firefox ou Chromium sous Linux) : avertissement gardé dans la barre
          setWarn('robotic', t('voiceRobotic', [choice.voice.name]));
          if (active) setMessage(warnText);
        } else setWarn(null, '');
        renderSpeak();
        if (lastShown && active) say(lastShown, null);
        return true;
      });
    }
    /* Mode choisi dans le popup : 'subs' (sous-titres), 'dub' (sous-titres + voix), 'voice' (voix seule) */
    function setMode(m) {
      voiceMode = DDT.VOICE_MODES.indexOf(m) !== -1 ? m : 'subs';
      settings.voiceMode = voiceMode;
      if (!active) return Promise.resolve(status());
      var want = voiceMode !== 'subs';
      var p = want === speaking ? Promise.resolve(speaking) : setSpeaking(want);
      renderSpeak();
      return p.then(function () { return status(); });
    }
    /* Pause de la vidéo : la voix se tait ; lecture : elle reprend au sous-titre affiché ;
       saut dans la vidéo : la voix repart au sous-titre du nouvel endroit. */
    function bindMedia(v) {
      if (mediaOff) mediaOff();
      mediaOff = null;
      if (!v || !v.addEventListener) return;
      var onPause = function () { if (speaking) cancelSpeech(); };
      var onPlay = function () { if (speaking && resumeHook) resumeHook(); };
      var onSeeking = function () { if (speaking) cancelSpeech(); };
      var onSeeked = function () { if (speaking && resumeHook && !v.paused) resumeHook(true); };
      v.addEventListener('pause', onPause);
      v.addEventListener('play', onPlay);
      v.addEventListener('seeking', onSeeking);
      v.addEventListener('seeked', onSeeked);
      mediaOff = function () {
        v.removeEventListener('pause', onPause);
        v.removeEventListener('play', onPlay);
        v.removeEventListener('seeking', onSeeking);
        v.removeEventListener('seeked', onSeeked);
      };
    }
    /* Reprise par défaut (YouTube, son transcrit) : la traduction affichée, pas après un saut */
    function defaultResume(seek) {
      if (seek || !lastShown) return;
      var l = lastShown;
      lastSaid = '';
      say(l, null);
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
        translateMany(order).then(syncFullscreen);
      }

      /* Plein écran natif de la vidéo : la bande ne peut pas s'afficher dans une <video>. Les traductions
         passent alors par une piste texte ajoutée à la vidéo et dessinée par le navigateur, « showing »
         seulement pendant ce plein écran, avec les temps des sous-titres d'origine. */
      var fsTrack = null;
      var fsAdded = {};              // index des sous-titres d'origine déjà copiés
      var fsLang = DDT.resolveTarget(settings.target);
      function nativeFullscreen() {
        var fs = doc.fullscreenElement || doc.webkitFullscreenElement;
        return (!!fs && fs === video) || !!video.webkitDisplayingFullscreen;
      }
      function emptyTrack(tt) {
        try { if (tt.mode === 'disabled') tt.mode = 'hidden'; } catch (e) { /* rien */ }   // piste désactivée : cues === null
        var list = Array.prototype.slice.call(tt.cues || []);
        list.forEach(function (c) { try { tt.removeCue(c); } catch (e) { /* rien */ } });
      }
      function ownTrack() {
        if (fsTrack) return fsTrack;
        // une piste laissée par un démarrage précédent est reprise (addTextTrack ne se retire pas)
        var tl = video.textTracks || [];
        for (var i = 0; i < tl.length; i++) {
          if (tl[i].label === OWN_LABEL) { fsTrack = tl[i]; emptyTrack(fsTrack); return fsTrack; }
        }
        if (typeof video.addTextTrack !== 'function' || !win.VTTCue) return null;
        try { fsTrack = video.addTextTrack('subtitles', OWN_LABEL, fsLang); } catch (e) { fsTrack = null; }
        return fsTrack;
      }
      function syncFullscreen() {
        if (!active) return;
        if (!nativeFullscreen() || linesHidden()) {   // voix seule : aucun texte, même en plein écran
          if (fsTrack && fsTrack.mode !== 'disabled') fsTrack.mode = 'disabled';
          return;
        }
        var own = ownTrack();
        if (!own) return;
        var cues = track.cues || [];
        for (var i = 0; i < cues.length; i++) {
          if (fsAdded[i]) continue;
          var s = cueText(cues[i].text);
          var tr = memo[s];
          if (!tr) continue;
          var text = settings.mode === 'bilingual' ? s + '\n' + tr : tr;
          try { own.addCue(new win.VTTCue(cues[i].startTime, cues[i].endTime, text)); fsAdded[i] = true; } catch (e) { /* rien */ }
        }
        if (own.mode !== 'showing') own.mode = 'showing';
      }
      function dropFullscreenTrack() {
        if (!fsTrack) return;
        emptyTrack(fsTrack);
        try { fsTrack.mode = 'disabled'; } catch (e) { /* rien */ }
        fsTrack = null;
        fsAdded = {};
      }
      fsSync = syncFullscreen;
      doc.addEventListener('fullscreenchange', syncFullscreen);
      doc.addEventListener('webkitfullscreenchange', syncFullscreen);
      video.addEventListener('webkitbeginfullscreen', syncFullscreen);   // Safari iOS
      video.addEventListener('webkitendfullscreen', syncFullscreen);
      var fsVideo = video;

      function onCue() {
        prepare();
        syncFullscreen();
        var list = track.activeCues || [];
        var parts = [];
        var end = null;          // fin du sous-titre : le doublage cale sa vitesse dessus
        for (var i = 0; i < list.length; i++) {
          parts.push(cueText(list[i].text));
          if (typeof list[i].endTime === 'number' && isFinite(list[i].endTime)) end = Math.max(end == null ? 0 : end, list[i].endTime);
        }
        var timing = end == null ? null : { end: end };
        var s = parts.join('\n').trim();
        if (!s) { clearLines(); return; }
        if (s in memo) { show(s, memo[s], timing); return; }
        show(s, '');
        translateOne(s).then(function (tr) {
          var cur = [];
          var l2 = track.activeCues || [];
          for (var j = 0; j < l2.length; j++) cur.push(cueText(l2[j].text));
          if (active && cur.join('\n').trim() === s) show(s, tr || '', timing);
          syncFullscreen();
        });
      }
      track.addEventListener('cuechange', onCue);
      // pause puis lecture, ou saut : le sous-titre actif est redit depuis le début
      resumeHook = function () { lastShown = ''; onCue(); };
      var poll = win.setInterval(prepare, 500);
      win.setTimeout(function () { win.clearInterval(poll); }, 15000);
      prepare();
      onCue();
      srcCleanups.push(function () {
        resumeHook = defaultResume;
        if (fsSync === syncFullscreen) fsSync = null;
        track.removeEventListener('cuechange', onCue);
        win.clearInterval(poll);
        doc.removeEventListener('fullscreenchange', syncFullscreen);
        doc.removeEventListener('webkitfullscreenchange', syncFullscreen);
        fsVideo.removeEventListener('webkitbeginfullscreen', syncFullscreen);
        fsVideo.removeEventListener('webkitendfullscreen', syncFullscreen);
        dropFullscreenTrack();
        try { track.mode = before; } catch (e) { /* rien */ }
      });
    }

    /* ---------------- 2. YouTube : transcription entière, programmée sur video.currentTime ----------------
     * 1. un petit script lancé dans le monde de la page par le background (deps.ytPlayer) lit
     *    movie_player.getPlayerResponse() (pistes, langues de traduction de YouTube, langue du son) et pose
     *    une fois des crochets sur XMLHttpRequest / fetch qui gardent adresse ET corps des réponses
     *    /api/timedtext reçues par le lecteur (le vrai YouTube ne crée aucune entrée de performance pour elles) ;
     * 2. l'extension arrive après le chargement : une nouvelle demande du lecteur est provoquée (CC coupé puis
     *    remis s'il était actif, sinon activé masqué ; piste choisie par setOption, puis avec tlang), tout est
     *    remis comme avant ; corps capturé lu, sinon adresse du lecteur rejouée, sinon adresse nue, sinon la
     *    transcription de YouTube (get_transcript) ; chaque essai est noté dans status().diag ;
     * 3. le fichier (json3 ou XML) est relu en entier, fusionné en phrases, traduit d'avance : par YouTube (tlang,
     *    gratuit) si la langue cible est proposée, sinon par le fournisseur choisi (translateMany, mémoire) ;
     * 4. chaque phrase est affichée et dite à son heure (video.currentTime), vitesse calée sur sa durée.
     * Replis, dans l'ordre : lecture du texte affiché par YouTube (startYouTubeScreen), puis le son. */
    function later(ms) { return new Promise(function (r) { win.setTimeout(r, ms); }); }
    function ytCall(req) {
      return Promise.resolve().then(function () { return deps.ytPlayer(req); })
        .then(function (r) { return r && typeof r === 'object' ? r : null; }, function () { return null; });
    }
    function str(x, n) { return typeof x === 'string' ? x.slice(0, n || 200) : ''; }
    function ccButton() { return doc.querySelector('.ytp-subtitles-button'); }
    function hideYtCaptions() {
      var style = doc.createElement('style');
      style.setAttribute('data-tr-ui', 'voice-style');
      style.textContent = '.ytp-caption-window-container{opacity:0!important}';
      (doc.head || doc.documentElement).appendChild(style);
      return function () { if (style.parentNode) style.parentNode.removeChild(style); };
    }
    /* Lecteur de la vidéo en cours (après une navigation interne, l'ancien répond encore un moment) */
    function ytInfo(id, isOff) {
      var until = Date.now() + ytInfoWaitMs;
      function once() {
        return ytCall({ op: 'info' }).then(function (r) {
          if (isOff() || !r || r.ok === false) return null;
          var vid = str(r.videoId, 64);
          // lecteur absent, pas encore prêt (aucune réponse) ou encore sur l'ancienne vidéo : on attend,
          // puis repli (jamais « pas de sous-titres » sans avoir lu la réponse de la bonne vidéo)
          if (r.player !== false && vid && (!id || vid === id)) return r;
          if (Date.now() >= until) return null;
          return later(ytPollMs).then(once);
        });
      }
      return once();
    }
    function cleanTracks(list) {
      return (Array.isArray(list) ? list : []).slice(0, 100).map(function (k) {
        return k && { url: str(k.url, 4096), lang: str(k.lang, 20), kind: str(k.kind, 10), translatable: k.translatable === true };
      }).filter(function (k) { return k && k.url && k.lang; });
    }
    function paramOf(u, k) { try { return new URL(u, win.location.href).searchParams.get(k) || ''; } catch (e) { return ''; } }
    /* Corps /api/timedtext reçus par le lecteur (crochets XHR / fetch posés dans la page par ytMain) */
    function captured(id) {
      return ytCall({ op: 'captured', arg: id || '' }).then(function (r) {
        var list = r && r.ok !== false && Array.isArray(r.items) ? r.items : [];
        return list.filter(function (x) { return x && typeof x.url === 'string' && typeof x.text === 'string'; }).slice(0, 40);
      });
    }
    function itemKey(x) { return x.url + '#' + x.at; }
    /* Corps capturés lus (json3 ou XML srv1/srv3) : original de la langue de la piste d'abord ; traduction
       de YouTube (tlang) à part ; url : adresse du lecteur (jeton compris) à rejouer si le corps est vide. */
    function readCaptured(items, track, tl) {
      var out = { orig: null, other: null, tr: null, url: '', bodies: items.length, empty: 0 };
      var trUrl = '';
      items.forEach(function (it) {
        var tlang = paramOf(it.url, 'tlang');
        var cues = parseTimedText(it.text, win.DOMParser);
        if (!cues.length) out.empty++;
        if (tlang) {
          if (!trUrl) trUrl = it.url;
          if (tl && !out.tr && cues.length && sameLanguage(tlang, tl)) out.tr = { cues: cues, url: it.url };
          return;
        }
        if (!out.url) out.url = it.url;
        if (!cues.length) return;
        var lang = paramOf(it.url, 'lang') || track.lang;
        var got = { cues: cues, url: it.url, lang: lang };
        if (sameLanguage(lang, track.lang)) { if (!out.orig) out.orig = got; } else if (!out.other) out.other = got;
      });
      if (!out.url) out.url = trUrl;
      return out;
    }
    function describeCaptured(c) {
      if (!c.bodies) return 'none';
      return c.bodies + ' body(s), ' + c.empty + ' empty' + (c.orig ? ', ' + c.orig.cues.length + ' cues (' + c.orig.lang + ')' : '') +
        (c.other ? ', other ' + c.other.lang : '') + (c.tr ? ', translated' : '');
    }
    /* Le script arrive après le chargement : la demande du lecteur est déjà passée. On en provoque une :
       sous-titres coupés puis remis s'ils étaient actifs, sinon activés (masqués) ; puis la piste choisie
       par l'API du lecteur (setOption), puis la même avec traduction (tlang, demande jamais en cache).
       Tout est remis comme avant ensuite (setUndo). */
    function forceRequest(info, track, tl, tlangs, id, isOff, setUndo, before) {
      var btn = ccButton();
      var hasApi = info.api === true;
      if (!btn && !hasApi) { note('cc', 'no button, no player API'); return Promise.resolve(before); }
      var wasOn = !!btn && btn.getAttribute('aria-pressed') === 'true';
      var show = hideYtCaptions();
      var prevTrack = null;
      var trackSet = false;
      setUndo(function () {
        var restoreCc = function () {
          if (btn && (btn.getAttribute('aria-pressed') === 'true') !== wasOn) btn.click();
          show();
        };
        // piste d'avant rendue seulement si les sous-titres étaient actifs (sinon setOption les rallumerait)
        if (trackSet && wasOn && prevTrack && prevTrack.lang) ytCall({ op: 'track', arg: prevTrack }).then(restoreCc, restoreCc);
        else restoreCc();
      });
      var seen = {};
      before.forEach(function (x) { seen[itemKey(x)] = true; });
      var phaseSeen = seen;
      var start = Date.now();
      var until = start + ytPotWaitMs;
      var phase = 0;
      function setTrack(a, label) {
        return ytCall({ op: 'track', arg: a }).then(function (r) {
          note('track', label + ': ' + (r && r.ok ? 'ok' : (r && r.error) || 'no answer'));
          if (r && r.ok) {
            if (!trackSet) prevTrack = r.prev && typeof r.prev === 'object' ? r.prev : null;
            trackSet = true;
          }
        });
      }
      function poll() {
        return later(ytPollMs).then(function () {
          if (isOff()) return [];
          return captured(id).then(function (items) {
            var fresh = items.filter(function (x) { return !phaseSeen[itemKey(x)]; });
            if (fresh.length) {
              var c = readCaptured(fresh, track, tl);
              if (c.orig || phase >= 1) return items;
            }
            var elapsed = Date.now() - start;
            if (elapsed >= ytPotWaitMs || isOff()) return items;
            var mark = function () { phaseSeen = {}; items.forEach(function (x) { phaseSeen[itemKey(x)] = true; }); };
            if (hasApi && phase === 0 && elapsed >= ytPotWaitMs / 3) {
              phase = 1;
              mark();
              return setTrack({ lang: track.lang, kind: track.kind === 'asr' ? 'asr' : '' }, track.lang).then(poll);
            }
            if (hasApi && phase === 1 && elapsed >= ytPotWaitMs * 2 / 3) {
              phase = 2;
              var alt = tl || tlangs.filter(function (c2) { return c2 && !sameLanguage(c2, track.lang); })[0] || '';
              if (alt) {
                mark();
                return setTrack({ lang: track.lang, kind: track.kind === 'asr' ? 'asr' : '', tlang: alt }, track.lang + '>' + alt).then(poll);
              }
            }
            return poll();
          });
        });
      }
      if (!btn) { note('cc', 'no button'); return poll(); }
      if (wasOn) {
        btn.click();
        note('cc', 'was on: off then on');
        return later(ytPollMs).then(function () {
          if (!isOff() && btn.getAttribute('aria-pressed') !== 'true') btn.click();
          return poll();
        });
      }
      btn.click();
      note('cc', 'turned on (hidden)');
      return poll().then(function (items) { if (Date.now() > until) note('cc', 'waited ' + (Date.now() - start) + ' ms'); return items; });
    }
    function fetchCues(url) {
      return ytCall({ op: 'fetch', url: url }).then(function (r) {
        if (!r || r.ok === false || typeof r.text !== 'string') return { cues: [], why: r ? (r.status || r.error || 'error') : 'no answer' };
        var cues = parseTimedText(r.text, win.DOMParser);
        return { cues: cues, why: cues.length ? '' : (r.text ? 'unreadable' : 'empty') };
      });
    }
    function firstCues(urls, isOff) {
      var i = 0;
      function next() {
        if (i >= urls.length || isOff()) return Promise.resolve(null);
        var url = urls[i++];
        var kind = /[?&]pot=/.test(url) ? 'replay (pot)' : 'replay (bare)';
        return fetchCues(url).then(function (r) {
          note(kind, r.cues.length ? r.cues.length + ' cues' : r.why);
          return r.cues.length ? { cues: r.cues, url: url } : next();
        });
      }
      return next();
    }
    function urlLang(u, fallback) {
      try { return new URL(u).searchParams.get('lang') || fallback; } catch (e) { return fallback; }
    }
    /* Sous-titres de la piste : corps capturé, sinon demande provoquée puis corps capturé, sinon adresse du
       lecteur rejouée (json3), sinon baseUrl nue. { cues, url, lang, tr } ou null. */
    function readTrack(info, track, tl, tlangs, id, isOff, setUndo) {
      var base = win.location.href;
      return captured(id).then(function (items) {
        var c = readCaptured(items, track, tl);
        note('captured', describeCaptured(c));
        if (c.orig || isOff()) return c;
        return forceRequest(info, track, tl, tlangs, id, isOff, setUndo, items).then(function (items2) {
          if (isOff()) return null;
          var c2 = readCaptured(items2, track, tl);
          note('captured', describeCaptured(c2));
          if (c2.url || c2.orig || c2.other) return c2;
          // aucune capture : adresses vues autrement (entrées de performance, bonus)
          return ytCall({ op: 'info' }).then(function (r) {
            c2.timed = r && r.ok !== false ? r.timed : null;
            return c2;
          });
        });
      }).then(function (c) {
        if (!c || isOff()) return null;
        if (c.orig) return { cues: c.orig.cues, url: c.orig.url, lang: c.orig.lang, tr: c.tr };
        var seen = observedUrls(c.timed || info.timed, id, base);
        if (seen.length) note('performance', seen.length + ' url(s)');
        var obs = c.url || seen[0] || '';
        return firstCues(captionUrls(track, obs, base), isOff).then(function (got) {
          if (got) return { cues: got.cues, url: got.url, lang: urlLang(got.url, track.lang), tr: c.tr };
          // autre langue reçue par le lecteur : mieux que rien
          if (c.other) return { cues: c.other.cues, url: c.other.url, lang: c.other.lang, tr: null };
          return null;
        });
      });
    }
    /* Transcription de YouTube (get_transcript, depuis la page) : segments -> morceaux */
    function readInnertube(id, lang, isOff) {
      if (!id || isOff()) return Promise.resolve(null);
      return ytCall({ op: 'transcript', arg: id }).then(function (r) {
        var segs = r && r.ok && Array.isArray(r.segments) ? r.segments.slice(0, 20000) : [];
        var cues = [];
        segs.forEach(function (s) {
          var st = Number(s && s.start);
          var en = Number(s && s.end);
          var tx = cueText(str(s && s.text, 2000));
          if (isFinite(st) && st >= 0 && tx) cues.push({ start: st, end: isFinite(en) && en >= st ? en : st, text: tx, first: true, word: false });
        });
        cues.sort(function (a, b) { return a.start - b.start; });
        note('get_transcript', cues.length ? cues.length + ' segments'
          : (r ? ((Array.isArray(r.tried) && r.tried.length ? r.tried.join(' ') : '') || r.error || 'empty') : 'no answer'));
        return cues.length ? { cues: cues, url: '', lang: lang, tr: null, source: 'innertube' } : null;
      });
    }
    /* Transcription : { sentences, lang, byYouTube, same, source } ; { noCaptions } ; { unreadable } (des
       pistes existent mais aucune n'a pu être lue) ; null (lecteur muet : repli) */
    function loadTranscript(id, isOff, setUndo) {
      var target = targetLang();
      return ytInfo(id, isOff).then(function (info) {
        if (!info) { note('player', 'no answer'); return null; }
        var tracks = cleanTracks(info.tracks);
        var tlangs = (Array.isArray(info.tlangs) ? info.tlangs : []).map(function (c) { return str(c, 20); });
        note('player', tracks.length + ' track(s) ' + tracks.map(function (k) { return k.lang + (k.kind === 'asr' ? '(auto)' : ''); }).join(',') +
          ', ' + tlangs.length + ' tlang(s), hooks ' + (Array.isArray(info.hooks) ? info.hooks.join('+') : '?'));
        if (!tracks.length) return { noCaptions: true };
        var track = pickCaptionTrack(tracks, str(info.audioLang, 20), target);
        note('track', 'chosen ' + track.lang + (track.kind === 'asr' ? ' (auto)' : ''));
        var tl = track.translatable && deps.ytTranslate !== false && !sameLanguage(track.lang, target) ? ytLanguage(tlangs, target) : '';
        return readTrack(info, track, tl, tlangs, id, isOff, setUndo).then(function (got) {
          if (isOff()) return null;
          if (got) return got;
          return readInnertube(id, str(info.audioLang, 20) || track.lang, isOff);
        }).then(function (got) {
          if (isOff()) return null;
          if (!got) return { unreadable: true };
          var lang = got.lang || track.lang;
          var sentences = mergeSentences(got.cues);
          var res = { sentences: sentences, lang: lang, byYouTube: false, same: sameLanguage(lang, target), source: got.source || 'timedtext' };
          if (res.same || !sentences.length || !tl || got.source === 'innertube') return res;
          var useTr = function (trCues) {
            var trs = mergeSentences(trCues);
            if (!trs.length) return false;
            // traduction de YouTube : ses phrases et ses temps à elle ; texte d'origine pris dans la même fenêtre
            var orig = originalsFor(trs, got.cues);
            res.sentences = trs.map(function (s, i) { return { start: s.start, end: s.end, text: orig[i] || s.text, tr: s.text }; });
            res.byYouTube = true;
            return true;
          };
          if (got.tr && useTr(got.tr.cues)) { note('tlang', 'captured body'); return res; }
          var tu;
          try { tu = new URL(got.url); } catch (e) { return res; }
          tu.searchParams.set('tlang', tl);
          return fetchCues(tu.href).then(function (r) {
            note('tlang', r.cues.length ? r.cues.length + ' cues' : r.why);
            if (!isOff()) useTr(r.cues);
            return res;
          });
        });
      });
    }
    function startYouTube() {
      if (!deps.ytPlayer) { startYouTubeScreen(); return; }
      mode = 'youtube';
      var off = false;
      var undo = null;
      var isOff = function () { return off || !active; };
      var undoCc = function () { var u = undo; undo = null; if (u) u(); };
      srcCleanups.push(function () { off = true; undoCc(); });
      setMessage(t('voiceYtLoading'));
      loadTranscript(ytCurrent, isOff, function (u) { undo = u; }).then(function (res) {
        if (isOff()) return;
        undoCc();
        if (res && res.sentences && res.sentences.length) {
          note('source', res.source + ' ' + res.sentences.length + ' sentences, ' + (res.byYouTube ? 'translated by YouTube' : res.lang));
          runTranscript(res, function () { return off; });
          return;
        }
        if (res && res.noCaptions) { noCaptions = true; note('source', 'no captions: audio'); startAudio(); return; }
        // des pistes existent (ou le lecteur n'a pas répondu) : jamais « vidéo sans sous-titres »
        ytUnreadable = true;
        note('source', 'screen text');
        startYouTubeScreen(t('voiceYtScreen'));
      }, function (e) {
        if (isOff()) return;
        undoCc();
        ytUnreadable = true;
        note('source', 'error ' + String(e && e.message || e).slice(0, 80) + ': screen text');
        startYouTubeScreen(t('voiceYtScreen'));
      });
    }
    /* Phrases connues d'avance : la bonne est relue sur video.currentTime (timeupdate + minuteur), dite à
       son début ; pause, saut, vitesse de la vidéo et publicités suivis. */
    function runTranscript(res, isOff) {
      mode = 'transcript';
      var sents = res.sentences;
      sentCount = sents.length;
      var store = memo;
      var given = 0;
      sents.forEach(function (s) {
        var tr = res.same ? s.text : s.tr;
        if (tr && !(s.text in store)) { store[s.text] = tr; given++; }
      });
      if (res.byYouTube) stats.translated += given;
      var unhide = hideYtCaptions();     // sous-titres de YouTube éventuellement affichés : la bande les remplace
      setMessage(res.byYouTube ? t('voiceYtByYouTube') : t('voiceYtTranscript', [DDT.languageName(res.lang)]));
      var cur = -1;
      var aheadFrom = -1;
      function at(tm) {
        var lo = 0;
        var hi = sents.length - 1;
        var ans = -1;
        while (lo <= hi) {
          var mid = (lo + hi) >> 1;
          if (sents[mid].start <= tm + 0.05) { ans = mid; lo = mid + 1; } else hi = mid - 1;
        }
        return ans >= 0 && tm < sents[ans].end ? ans : -1;
      }
      /* Traduction d'avance par le fournisseur : la phrase en cours et celles des 2 min 30 suivantes */
      function ahead(tm) {
        var todo = [];
        for (var i = 0; i < sents.length; i++) {
          if (sents[i].end < tm - 1) continue;
          if (sents[i].start > tm + AHEAD_SEC) break;
          if (!(sents[i].text in store)) todo.push(sents[i].text);
        }
        if (todo.length) translateMany(todo);
      }
      function adShowing() {
        var p = doc.getElementById('movie_player');
        return !!p && !!p.classList && p.classList.contains('ad-showing');
      }
      function tick() {
        if (!active || isOff() || !video) return;
        if (adShowing()) {                         // publicité : son temps n'est pas celui de la vidéo
          if (cur !== -1) { cur = -1; clearLines(); cancelSpeech(); lastShown = ''; }
          return;
        }
        var tm = Number(video.currentTime) || 0;
        var i = at(tm);
        if (i === cur) return;
        cur = i;
        var block = Math.floor(tm / 30);
        if (block !== aheadFrom) { aheadFrom = block; ahead(tm); }
        if (i < 0) { clearLines(); return; }
        var s = sents[i];
        var timing = { end: s.end };
        if (s.text in store) { show(s.text, store[s.text], timing); return; }
        show(s.text, '');
        translateOne(s.text).then(function (tr) { if (active && !isOff() && cur === i) show(s.text, tr || '', timing); });
      }
      var timer = win.setInterval(tick, TICK_MS);
      var v = video;
      v.addEventListener('timeupdate', tick);
      // pause puis lecture, ou saut : la phrase du nouvel endroit est redite (le reste de son temps)
      resumeHook = function () { cur = -2; aheadFrom = -1; lastShown = ''; tick(); };
      ahead(Number(v.currentTime) || 0);
      tick();
      srcCleanups.push(function () {
        win.clearInterval(timer);
        v.removeEventListener('timeupdate', tick);
        resumeHook = defaultResume;
        unhide();
      });
    }

    /* ---------------- 2 bis. Repli YouTube : texte des sous-titres affiché à l'écran ---------------- */
    function ytText() {
      var segs = doc.querySelectorAll('.ytp-caption-window-container .ytp-caption-segment');
      var parts = [];
      for (var i = 0; i < segs.length; i++) parts.push(segs[i].textContent);
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    function startYouTubeScreen(msg) {
      mode = 'youtube';
      var btn = ccButton();
      var turnedOn = false;
      if (btn && btn.getAttribute('aria-pressed') === 'false') { btn.click(); turnedOn = true; }
      var unhide = hideYtCaptions();
      setMessage(msg || t('voiceSourceTrack'));
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
      var fallback = null;
      // vidéo en pause : on invite à la lancer et on revient voir chaque seconde, sinon le son
      // n'était jamais capté après « lecture » (vidéo sans sous-titres)
      function arm(ms) {
        fallback = win.setTimeout(function () {
          if (seen || !active || mode !== 'youtube') return;
          if (video && video.paused) { setMessage(t('voicePlay')); arm(1000); return; }
          stopSource();
          startAudio();
        }, ms);
      }
      arm(ytWaitMs);
      function stopYouTube() {
        win.clearInterval(tick);
        win.clearTimeout(fallback);
        unhide();
        if (turnedOn && btn && btn.getAttribute('aria-pressed') === 'true') btn.click();
        turnedOn = false;
      }
      srcCleanups.push(stopYouTube);
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
    /* Son de la vidéo lisible par la page ? Même origine, blob: (MediaSource, YouTube), data:,
       ou vidéo chargée avec CORS (attribut crossorigin). */
    function mediaReadable(v) {
      if (v.crossOrigin != null || (v.hasAttribute && v.hasAttribute('crossorigin'))) return true;
      var src = v.currentSrc || v.src || '';
      if (!src && v.querySelector) { var so = v.querySelector('source[src]'); src = so ? so.src : ''; }
      if (!src) return true;                    // rien de chargé, ou srcObject (flux de la page)
      if (/^(blob|data):/i.test(src)) return true;
      try { return new URL(src, doc.baseURI).origin === win.location.origin; } catch (e) { return false; }
    }
    function captureAudio(v) {
      var stream = null;
      var moz = false;
      try {
        if (typeof v.captureStream === 'function') stream = v.captureStream();
        else if (typeof v.mozCaptureStream === 'function') {
          // Firefox : mozCaptureStream retire le son de l'élément. Vidéo d'une autre origine sans CORS :
          // la capture ne rend que du silence et MediaRecorder échoue, la vidéo resterait muette.
          if (!mediaReadable(v)) return null;
          stream = v.mozCaptureStream();
          moz = true;
        }
      } catch (e) { stream = null; }
      return stream ? { stream: stream, moz: moz } : null;
    }
    /* Arrêter les pistes capturées : avec mozCaptureStream, c'est ce qui rend le son à la vidéo. */
    function releaseCapture(cap) {
      if (!cap || !cap.stream) return;
      try {
        var list = cap.stream.getTracks ? cap.stream.getTracks() : (cap.stream.getAudioTracks ? cap.stream.getAudioTracks() : []);
        Array.prototype.slice.call(list).forEach(function (tr) { try { tr.stop(); } catch (e) { /* rien */ } });
      } catch (e) { /* rien */ }
    }
    function sameTracks(a, b) {
      if (!a || a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i] && !(a[i].id && a[i].id === b[i].id)) return false;
      }
      return true;
    }
    function startAudio() {
      mode = 'audio';
      var MR = deps.MediaRecorder || win.MediaRecorder;
      var AC = deps.AudioContext || win.AudioContext || win.webkitAudioContext;
      // vidéo protégée (DRM, Netflix...) : le son capturé ne serait que du silence
      var cap = video.mediaKeys ? null : captureAudio(video);
      if (!MR || !cap) { releaseCapture(cap); setMessage(t('voiceNoAudio')); return; }
      var mime = pickMime(MR);
      setMessage(t('voiceListening'));
      var ctx = null;
      var analyser = null;
      var source = null;
      var graphTracks = null;      // pistes branchées sur l'analyseur
      var buf = null;
      var stopped = false;
      var recorder = null;
      var chain = Promise.resolve();
      var level = 0;
      var meter = null;
      var gain = null;             // Firefox : son renvoyé, au volume de la vidéo (réglage et doublage)
      var gainVideo = null;
      function syncGain() {
        if (!gain || !gainVideo) return;
        var g = gainVideo.muted ? 0 : Number(gainVideo.volume);
        if (!isFinite(g)) g = 1;
        try { gain.gain.value = Math.max(0, Math.min(1, g)); } catch (e) { /* rien */ }
      }

      function audioTracks() {
        var list = cap.stream.getAudioTracks ? cap.stream.getAudioTracks() : [];
        return Array.prototype.filter.call(list, function (tr) { return tr.readyState !== 'ended'; });
      }
      // Le contexte audio d'une page démarre souvent « suspendu » (pas de clic sur la page) : il ne
      // mesure alors que des zéros. On tente de le relancer ; sinon, pas de détection de silence.
      function wake() {
        if (!ctx || ctx.state === 'running' || !ctx.resume) return;
        try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* rien */ }
      }
      function closeGraph() {
        if (meter) win.clearInterval(meter);
        meter = null;
        if (gainVideo) { try { gainVideo.removeEventListener('volumechange', syncGain); } catch (e) { /* rien */ } }
        if (volumeHook === syncGain) volumeHook = null;
        try { if (gain) gain.disconnect(); } catch (e) { /* rien */ }
        gain = null;
        gainVideo = null;
        try { if (source) source.disconnect(); } catch (e) { /* rien */ }
        try { if (ctx) { var p = ctx.close(); if (p && p.catch) p.catch(function () {}); } } catch (e) { /* rien */ }
        ctx = null;
        analyser = null;
        source = null;
        graphTracks = null;
      }
      function setupGraph(tracks) {
        if (!AC) {
          // Firefox sans Web Audio : le son capturé ne pourrait pas revenir aux haut-parleurs
          if (cap.moz) fail();
          return;
        }
        try {
          if (!ctx) {
            ctx = new AC();
            analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            // Tampon créé côté page : dans Firefox, un tableau du script d'extension passé à une méthode
            // de la page n'est pas rempli (frontière Xray) et tout semblait silencieux.
            buf = new (win.Float32Array || Float32Array)(analyser.fftSize);
            meter = win.setInterval(function () {
              if (!ctx || !analyser) return;
              if (ctx.state !== 'running') { level = 1; return; }
              analyser.getFloatTimeDomainData(buf);
              var sum = 0;
              for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
              level = Math.max(level, Math.sqrt(sum / buf.length));
            }, 100);
          }
          if (source && sameTracks(graphTracks, tracks)) return;
          // Pistes changées (vidéo suivante, publicité) : captureStream a terminé les anciennes et en a
          // créé d'autres. La source est reconstruite, sinon l'analyseur écoute des pistes mortes (tout
          // semble silencieux) et, avec mozCaptureStream, le son des nouvelles pistes n'est plus entendu.
          if (source) { try { source.disconnect(); } catch (e) { /* rien */ } source = null; }
          source = ctx.createMediaStreamSource(new win.MediaStream(tracks));
          source.connect(analyser);
          // Firefox : mozCaptureStream retire le son de la vidéo ; on le renvoie vers les haut-parleurs,
          // par un gain qui suit video.volume / video.muted : sinon ni le réglage de l'utilisateur ni la
          // baisse du doublage n'auraient d'effet (le son capturé ignore le volume de l'élément).
          if (cap.moz && !ctx.createGain) source.connect(ctx.destination);
          else if (cap.moz) {
            if (!gain) {
              gain = ctx.createGain();
              gain.connect(ctx.destination);
              gainVideo = video;
              gainVideo.addEventListener('volumechange', syncGain);
              volumeHook = syncGain;
              syncGain();
            }
            source.connect(gain);
          }
          graphTracks = tracks.slice();
        } catch (e) {
          closeGraph();
          if (cap.moz) fail();                  // sans graphe, la vidéo resterait muette
        }
      }
      function recordOne() {
        if (stopped || !active) return;
        if (video.isConnected === false) { checkVideo(); return; }   // vidéo retirée : on suit la nouvelle
        var tracks = audioTracks();
        if (!tracks.length) {                      // pas encore de son (vidéo en pause ou pas chargée)
          if (video.paused) setMessage(t('voicePlay'));
          win.setTimeout(recordOne, 800);
          return;
        }
        setupGraph(tracks);
        if (stopped) return;
        wake();
        // contexte suspendu : l'analyseur ne lit que des zéros, le silence n'est pas détectable
        level = (analyser && ctx.state === 'running') ? 0 : 1;
        var chunks = [];
        var startedPlaying = !video.paused;
        var rec;
        try {
          rec = new MR(new win.MediaStream(tracks), mime ? { mimeType: mime } : undefined);
        } catch (e) { fail(); return; }
        recorder = rec;
        rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
        rec.onerror = function () { fail(); };
        rec.onstop = function () {
          var silent = level < SILENCE_RMS;
          var wasPlaying = startedPlaying || !video.paused;
          var blob = chunks.length ? new win.Blob(chunks, { type: (mime || 'audio/webm').split(';')[0] }) : null;
          if (!stopped) recordOne();               // le morceau suivant démarre tout de suite
          if (!blob || silent || !wasPlaying) return;
          // traitement dans l'ordre d'arrivée : les sous-titres ne se doublent jamais
          chain = chain.then(function () { return handleChunk(blob, mime); }).catch(function () { /* rien */ });
        };
        try { rec.start(); } catch (e) { fail(); return; }
        // « rec » et non « recorder » : si cet enregistreur s'arrête tout seul (pistes terminées), ce
        // minuteur ne doit pas couper le morceau suivant
        win.setTimeout(function () { try { if (rec.state !== 'inactive') rec.stop(); } catch (e) { /* rien */ } }, chunkMs);
      }
      function release() {
        if (stopped) return;
        stopped = true;
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (e) { /* rien */ }
        releaseCapture(cap);                       // d'abord : le son revient à la vidéo (Firefox)
        closeGraph();
      }
      function fail() {
        if (stopped) return;
        release();
        if (active) setMessage(t('voiceNoAudio'));
      }
      recordOne();
      srcCleanups.push(release);
    }
    function handleChunk(blob, mime) {
      if (!active) return Promise.resolve();
      return blobToBase64(blob).then(function (b64) {
        return transcribe(b64, mime);
      }).then(function (r) {
        if (!active) return;
        // réussite seulement si le background a vraiment rendu un texte (jamais une réponse vide prise pour un succès)
        if (!r || r.ok !== true || typeof r.text !== 'string') {
          note('groq', (r && r.error) || 'no answer');
          if (r && r.error === 'no_groq') {
            setMessage(t(noCaptions ? 'voiceNoCaptionsGroq' : (ytUnreadable ? 'voiceYtUnreadableGroq' : 'voiceNeedGroq')), settingsAction());
          } else if (r && r.error === 'rate_limited') setMessage(t('voiceRate'));
          else if (r && r.error === 'empty') return;
          else setMessage((r && r.message) || t('badgeError', [(r && r.error) || '?']));
          return;
        }
        stats.transcribed++;
        note('groq', 'ok via ' + str(r.via, 60) + ' (' + r.text.length + ' chars)');
        setMessage(t('voiceSourceAudio'));
        if (!r.text) return;
        show(r.text, '');
        return translateOne(r.text).then(function (tr) { if (active && tr) show(r.text, tr); });
      });
    }

    /* ---------------- Choix de la source, suivi de la vidéo ---------------- */
    function startSource() {
      noCaptions = false;
      ytUnreadable = false;
      sentCount = 0;
      var tracks = textTracks(video);
      if (tracks.length) startTrack(tracks);
      else if (isYouTube()) startYouTube();
      else startAudio();
    }
    function stopSource() {
      var list = srcCleanups;
      srcCleanups = [];
      list.reverse().forEach(function (fn) { try { fn(); } catch (e) { /* rien */ } });
      mode = null;
    }
    function useVideo(next) {
      if (next === video) return;
      // doublage : phrase en cours coupée et volume rendu à l'ancienne vidéo
      cancelSpeech();
      restoreVolume();
      video = next;
      bindMedia(video);
    }
    /* Vidéo retirée ou remplacée (application d'une seule page, YouTube) : la référence est périmée.
       On suit la nouvelle vidéo avec la source adaptée, sinon on arrête proprement. */
    function checkVideo() {
      if (!active || !video || video.isConnected !== false) return;
      stopSource();
      var next = pickVideo();
      if (!next) { stop(); return; }
      useVideo(next);
      lastShown = '';
      clearLines();
      startSource();
    }
    /* YouTube : vidéo suivante (navigation interne « yt-navigate-finish » ou autre « v= » dans l'adresse).
       Mémoire des sous-titres et détection (sous-titres présents ou non) remises à zéro. */
    function ytVideoId() {
      var loc = win.location;
      var m = /[?&]v=([^&#]+)/.exec(loc.search || '') || /^\/(?:shorts|live|embed)\/([^/?#]+)/.exec(loc.pathname || '');
      return m ? m[1] : '';
    }
    function checkYouTubeVideo() {
      if (!active || ytCurrent === null) return;
      var id = ytVideoId();
      if (id === ytCurrent) return;
      ytCurrent = id;
      note('video', id);
      memo = {};
      pending = {};
      lastShown = '';
      clearLines();
      stopSource();
      var next = pickVideo();
      if (next) useVideo(next);
      if (!video || video.isConnected === false) { stop(); return; }
      startSource();
    }
    function watch() {
      var check = function () { checkVideo(); checkYouTubeVideo(); };
      var timer = win.setInterval(check, watchMs);
      doc.addEventListener('yt-navigate-finish', check);
      cleanups.push(function () {
        win.clearInterval(timer);
        doc.removeEventListener('yt-navigate-finish', check);
      });
    }

    /* ---------------- Commandes ---------------- */
    function start(opts) {
      opts = opts || {};
      if (opts.settings) {
        settings = Object.assign({}, DDT.DEFAULT_SETTINGS, opts.settings);
        voiceMode = DDT.voiceModeOf(opts.settings);
        userRate = DDT.clampVoiceRate(opts.settings.voiceRate);
      }
      settings.voiceMode = voiceMode;
      settings.voiceRate = userRate;
      keyId = opts.keyId || null;
      if (active) return status();
      choicePromise = null;         // langue cible peut-être changée : voix choisie à nouveau
      setWarn(null, '');
      var found = scan();
      video = pickVideo();
      if (!video) {
        // lecteur intégré d'un autre site : la traduction marchera dans son propre onglet
        var frame = pickPlayerFrame(found.frames);
        var url = frame ? playerUrl(frame.src || frame.getAttribute('src') || frame.getAttribute('data-src')) : '';
        if (url) {
          frameAnchor = frame;
          var hostName = '';
          try { hostName = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* rien */ }
          message = t('voiceInFrame', [hostName]);
          frameMode = true;
          ensureBox();
          var m = box.querySelector('.msg');
          m.textContent = message;
          m.title = message;
          m.classList.add('long');
          setAction({ label: t('voiceOpenTab'), run: function () {
            try { win.open(url, '_blank', 'noopener'); } catch (e) { /* rien */ }
            stop();
          } });
          box.querySelector('.open').setAttribute('data-url', url);
          box.querySelector('.speak').hidden = true;
          box.querySelector('.rates').hidden = true;
          box.classList.add('on');
          position();
          return status({ ok: false, error: 'iframe_player', url: url });
        }
        message = t('voiceNoVideo');
        return status({ ok: false, error: 'no_video' });
      }
      if (host) stop();             // message d'un lecteur intégré encore affiché
      frameMode = false;
      active = true;
      diag = [];
      diagT0 = Date.now();
      memo = {};
      pending = {};
      lastShown = '';
      resumeHook = defaultResume;
      ytCurrent = isYouTube() ? ytVideoId() : null;
      ensureBox();
      bindMedia(video);
      watch();
      startSource();
      if (voiceMode !== 'subs') setSpeaking(true);
      return status();
    }
    function stop() {
      if (!active && !host) return status();
      active = false;
      setSpeaking(false);
      if (mediaOff) mediaOff();
      mediaOff = null;
      resumeHook = null;
      frameAnchor = null;
      frameMode = false;
      openAction = null;
      stopSource();
      var list = cleanups;
      cleanups = [];
      list.reverse().forEach(function (fn) { try { fn(); } catch (e) { /* rien */ } });
      mode = null;
      message = '';
      ytCurrent = null;
      return status();
    }
    function toggle(opts) { return active ? stop() : start(opts); }
    function status(extra) {
      return Object.assign({ ok: true, active: active, mode: mode, message: message, speaking: speaking,
        dubVoice: speaking && ttsVoice ? ttsVoice.name : null, ttsEngine: speaking ? ttsKind : null,
        voiceTier: speaking ? ttsTier : null, voiceWarn: warnText || null, voices: Object.assign({}, voiceInfo),
        voiceMode: voiceMode, voiceRate: userRate, lastRate: lastRate,
        media: video ? video.tagName.toLowerCase() : null,
        translated: stats.translated, transcribed: stats.transcribed, noVoice: noVoice || null,
        sentences: sentCount, diag: diag.slice() }, extra || {});
    }

    return {
      start: start, stop: stop, toggle: toggle, status: status, setSpeaking: setSpeaking,
      setMode: setMode, setRate: function (x) { return setRate(x, false); },
      // voix choisie dans les réglages : prise dès la phrase suivante
      setVoiceName: function (name) {
        settings.voiceName = typeof name === 'string' ? name : '';
        choicePromise = null;
        if (!active || !speaking) return Promise.resolve(status());
        return setSpeaking(true).then(function () { return status(); });
      },
      // ancien message « dub » (1.2) : marche = doublage, arrêt = sous-titres
      setDub: function (on) { return setMode(on ? 'dub' : 'subs'); },
      _memo: function () { return memo; }, _video: function () { return video; }
    };
  }

  root.DDT_createVoice = createVoice;
  root.DDT_cueText = cueText;
  root.DDT_pickTtsVoice = pickTtsVoice;
  root.DDT_dubRate = dubRate;
  root.DDT_VOICE_LIMITS = { min: FINAL_RATE_MIN, max: FINAL_RATE_MAX, chars: TTS_MAX_CHARS };
  root.DDT_ytTools = { parseTimedText: parseTimedText, mergeSentences: mergeSentences, originalsFor: originalsFor,
    pickCaptionTrack: pickCaptionTrack, ytLanguage: ytLanguage, captionUrls: captionUrls, observedUrls: observedUrls };

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

  /* Voix traduite : produite par le background (chrome.tts, ou speechSynthesis de la page de fond
     sous Firefox), qui n'a pas besoin d'un clic dans la page. La réponse à « speak » arrive en fin de phrase. */
  var tts = {
    voices: function () { return api.runtime.sendMessage({ type: 'ttsVoices' }); },
    speak: function (o) {
      return api.runtime.sendMessage({ type: 'speak', text: o.text, lang: o.lang, rate: o.rate, voiceName: o.voiceName });
    },
    stop: function () { return api.runtime.sendMessage({ type: 'stopSpeaking' }); }
  };
  /* Vitesse changée avec − / + sur la vidéo : enregistrée (relue avant d'écrire : autre réglage modifié ailleurs) */
  function saveRate(rate) {
    return api.storage.local.get('settings').then(function (r) {
      var s = Object.assign({}, (r && r.settings) || {}, { voiceRate: rate });
      return api.storage.local.set({ settings: s });
    });
  }

  /* YouTube : lecture du lecteur et des sous-titres dans le monde de la page, faite par le background
     (scripting.executeScript, world MAIN, fonction fixe) ; la réponse est relue ici comme du texte non sûr. */
  function ytPlayer(req) {
    return api.runtime.sendMessage({ type: 'ytPlayer', op: req.op, url: req.url || '', arg: req.arg == null ? '' : req.arg })
      .catch(function () { return null; });
  }
  function openOptions() { return api.runtime.sendMessage({ type: 'openOptions' }); }

  var voice = createVoice(document, window, { transport: transport, transcribe: transcribe, tts: tts, saveRate: saveRate,
    ytPlayer: ytPlayer, openOptions: openOptions });
  root.__DDT_VOICE = voice;

  // vitesse changée dans les réglages (ou dans un autre onglet) : appliquée tout de suite
  if (api.storage.onChanged) {
    api.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes.settings || !changes.settings.newValue) return;
      var nv = changes.settings.newValue;
      if (nv.voiceRate != null && DDT.clampVoiceRate(nv.voiceRate) !== voice.status().voiceRate) voice.setRate(nv.voiceRate);
      var ov = changes.settings.oldValue || {};
      if ((nv.voiceName || '') !== (ov.voiceName || '')) voice.setVoiceName(nv.voiceName || '');
    });
  }

  api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.to !== 'voice') return;
    if (msg.cmd === 'status') { sendResponse(voice.status()); return; }
    if (msg.cmd === 'stop') { sendResponse(voice.stop()); return; }
    if (msg.cmd === 'dub') {
      // choix du popup appliqué tout de suite à la voix déjà lancée
      var m = DDT.VOICE_MODES.indexOf(msg.mode) !== -1 ? msg.mode : (msg.on ? 'dub' : 'subs');
      voice.setMode(m).then(sendResponse, function (e) { sendResponse({ ok: false, error: String(e) }); });
      return true;
    }
    api.storage.local.get('settings').then(function (r) {
      var raw = (r && r.settings) || {};
      var s = Object.assign({}, DDT.DEFAULT_SETTINGS, raw, { voiceMode: DDT.voiceModeOf(raw) });
      var opts = { settings: s, keyId: msg.keyId };
      sendResponse(msg.cmd === 'toggle' ? voice.toggle(opts) : voice.start(opts));
    }).catch(function (e) { sendResponse({ ok: false, error: String(e) }); });
    return true;
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
