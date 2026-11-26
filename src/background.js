/*
 * DevDocTrad - background.js
 * Fournisseurs, clés, cache, garde-fous de coût, bascule 429, scripts automatiques, raccourci.
 * Service worker sous Chromium, background script sous Firefox.
 * Licence MIT.
 */
/* global importScripts */
(function (root) {
  'use strict';
  if (typeof root.DDT === 'undefined' && typeof importScripts === 'function') importScripts('shared.js');
  var DDT = root.DDT;

  var PAUSE_DEFAULT_MS = 65000;
  var PAUSE_DAILY_MS = 30 * 60000;
  var CACHE_MAX_ENTRIES = 6000;
  var CACHE_MAX_BYTES = 20 * 1024 * 1024;
  var MAX_ATTEMPTS_PER_CHUNK = 6;

  /* Verrou simple : les fonctions passées s'exécutent l'une après l'autre (chaîne de promesses).
   * Sert aux lectures-modifications-écritures du stockage partagées par plusieurs onglets. */
  function makeLock() {
    var tail = Promise.resolve();
    return function (fn) {
      var p = tail.then(fn);
      tail = p.catch(function () { /* l'erreur reste à l'appelant, la chaîne continue */ });
      return p;
    };
  }
  function undoneList(n) { var a = []; for (var i = 0; i < n; i++) a.push(undefined); return a; }

  function ProviderError(kind, message, extra) {
    this.kind = kind;
    this.message = message || kind;
    if (extra) for (var k in extra) this[k] = extra[k];
  }

  function createBackground(deps) {
    var api = deps.api;
    var fetchFn = deps.fetch;
    var now = deps.now || function () { return Date.now(); };
    var sleep = deps.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var log = deps.log || function () { /* silence par défaut */ };

    var memSession = {};
    var cacheTimer = null;
    var lastReq = {};          // en mémoire + recopié dans storage.session
    var usageLock = makeLock();     // dépense et compteurs du jour
    var sessionLock = makeLock();   // pauses, clés désactivées, dernière requête
    var cacheLock = makeLock();     // index du cache et écritures
    var intervalQueue = {};         // file par clé pour l'écart minimal entre deux requêtes

    /* ---------------- Stockage ---------------- */
    function local() { return api.storage.local; }
    function session() { return api.storage.session || null; }

    function getLocal(keys) { return local().get(keys); }
    function setLocal(obj) { return local().set(obj); }

    function getSessionState() {
      var s = session();
      if (!s) {
        return Promise.resolve({
          pauses: Object.assign({}, memSession.pauses), disabled: Object.assign({}, memSession.disabled),
          lastReq: Object.assign({}, memSession.lastReq)
        });
      }
      return s.get(['pauses', 'disabled', 'lastReq']).then(function (r) {
        return { pauses: r.pauses || {}, disabled: r.disabled || {}, lastReq: r.lastReq || {} };
      });
    }
    function setSessionState(patch) {
      var s = session();
      Object.assign(memSession, patch);
      if (!s) return Promise.resolve();
      return s.set(patch);
    }
    /* Modification de l'état de session sous verrou : l'état est relu juste avant d'être modifié,
     * pour ne jamais réécrire un instantané ancien (qui réactiverait une clé désactivée ailleurs). */
    function updateSession(fn) {
      return sessionLock(function () {
        return getSessionState().then(function (st) {
          var patch = fn(st);
          return patch ? setSessionState(patch).then(function () { return patch; }) : null;
        });
      });
    }

    function loadAll() {
      return getLocal(['settings', 'keys', 'glossary', 'usage']).then(function (r) {
        var settings = Object.assign({}, DDT.DEFAULT_SETTINGS, r.settings || {});
        settings.targetChoice = settings.target;
        settings.target = DDT.resolveTarget(settings.target);
        return {
          settings: settings,
          keys: (r.keys || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }),
          glossary: r.glossary || [],
          usage: normalizeUsage(r.usage)
        };
      });
    }

    function normalizeUsage(u) {
      var day = DDT.todayKey(new Date(now()));
      if (!u || u.day !== day) return { day: day, perKey: {} };
      return u;
    }
    function roundCost(c) { return Math.max(0, Math.round(c * 1e9) / 1e9); }
    /* Compteurs du jour modifiés sous verrou (plusieurs onglets traduisent en même temps). */
    function changeUsage(keyId, fn, env) {
      return usageLock(function () {
        return getLocal('usage').then(function (r) {
          var u = normalizeUsage(r.usage);
          var k = u.perKey[keyId] || { requests: 0, cost: 0 };
          fn(k);
          k.cost = roundCost(k.cost);
          u.perKey[keyId] = k;
          return setLocal({ usage: u }).then(function () { if (env) env.usage = u; return u; });
        });
      });
    }
    function bumpUsage(keyId, requests, cost, env) {
      return changeUsage(keyId, function (k) { k.requests += requests || 0; k.cost += cost || 0; }, env);
    }
    /* Réservation du coût AVANT l'appel, sous verrou : refus si la dépense du jour plus ce que
     * cet appel peut coûter dépasse le plafond. La dépense en mémoire (env.usage) est mise à jour. */
    function reserveCall(key, cost, env) {
      return changeUsage(key.id, function (k) {
        if (tierOf(key) === 'paid') {
          var cap = parseFloat(key.dailyCap);
          if (!(cap > 0) || k.cost + cost > cap) {
            throw new ProviderError('paid_cap', DDT.t('errPaidCap', [k.cost.toFixed(4), cap]));
          }
        }
        k.requests += 1;
        k.cost += cost || 0;
      }, env);
    }

    /* ---------------- Cache ----------------
     * Une entrée par clé de stockage (« c:<hash> ») et un petit index { hash: [date, octets] }
     * pour l'éviction : on ne lit que les entrées demandées et on n'écrit que les nouvelles.
     * L'ancien format (tout le cache sous la clé « cache ») est converti au premier chargement. */
    var CACHE_PREFIX = 'c:';
    var cacheIndex = null;      // en mémoire une fois chargé
    var cachePending = {};      // nouvelles entrées pas encore écrites
    var cacheDrop = [];         // clés de stockage à retirer à la prochaine écriture
    function entryBytes(h, e) { return (CACHE_PREFIX.length + h.length + JSON.stringify(e).length) * 2; }

    function loadIndex() {
      if (cacheIndex) return Promise.resolve(cacheIndex);
      return cacheLock(function () {
        if (cacheIndex) return cacheIndex;
        return getLocal(['cacheIndex', 'cache']).then(function (r) {
          var idx = r.cacheIndex && typeof r.cacheIndex === 'object' ? r.cacheIndex : {};
          var old = r.cache && typeof r.cache === 'object' ? r.cache : null;
          if (!old) { cacheIndex = idx; return cacheIndex; }
          // Migration : chaque entrée de l'ancien cache devient sa propre clé de stockage.
          var put = {};
          Object.keys(old).forEach(function (h) {
            var e = old[h];
            if (!e || typeof e.t !== 'string') return;
            put[CACHE_PREFIX + h] = e;
            idx[h] = [e.ts || 0, entryBytes(h, e)];
          });
          put.cacheIndex = idx;
          return setLocal(put).then(function () { return local().remove('cache'); }).then(function () {
            cacheIndex = idx;
            return cacheIndex;
          });
        });
      });
    }
    /* Lecture ciblée : seulement les entrées connues de l'index parmi celles demandées. */
    function cacheGet(hashes) {
      return loadIndex().then(function (idx) {
        var out = {};
        var want = [];
        hashes.forEach(function (h) {
          if (cachePending[h]) out[h] = cachePending[h];
          else if (idx[h] && want.indexOf(CACHE_PREFIX + h) === -1) want.push(CACHE_PREFIX + h);
        });
        if (!want.length) return out;
        return getLocal(want).then(function (r) {
          want.forEach(function (k) { if (r[k]) out[k.slice(CACHE_PREFIX.length)] = r[k]; });
          return out;
        });
      });
    }
    function cachePut(h, entry) {
      if (!cacheIndex) return;
      cachePending[h] = entry;
      cacheIndex[h] = [entry.ts, entryBytes(h, entry)];
      scheduleCacheWrite();
    }
    function scheduleCacheWrite() {
      if (cacheTimer) return;
      cacheTimer = setTimeout(function () {
        cacheTimer = null;
        flushCache().catch(function (e) { log('cache', String(e && e.message)); });
      }, 3000);
    }
    function flushCache() {
      return cacheLock(function () {
        if (!cacheIndex) return null;
        var idx = cacheIndex;
        var hs = Object.keys(idx);
        var size = 0;
        hs.forEach(function (h) { size += idx[h][1] || 0; });
        if (hs.length > CACHE_MAX_ENTRIES || size > CACHE_MAX_BYTES) {
          hs.sort(function (a, b) { return idx[a][0] - idx[b][0]; });
          var target = Math.floor(Math.min(hs.length, CACHE_MAX_ENTRIES) * 0.9);
          var drop = hs.length - target;
          for (var i = 0; i < drop; i++) {
            delete idx[hs[i]];
            if (cachePending[hs[i]]) delete cachePending[hs[i]];
            else cacheDrop.push(CACHE_PREFIX + hs[i]);
          }
        }
        var pend = Object.keys(cachePending);
        var dropNow = cacheDrop;
        if (!pend.length && !dropNow.length) return null;
        var put = { cacheIndex: idx };
        pend.forEach(function (h) { put[CACHE_PREFIX + h] = cachePending[h]; });
        cachePending = {};
        cacheDrop = [];
        return setLocal(put).then(function () {
          return dropNow.length ? local().remove(dropNow) : null;
        });
      });
    }
    function cacheKey(settings, glossaryHash, src) {
      return DDT.sha256hex([DDT.PROMPT_VERSION, settings.target, settings.explainTerms ? 1 : 0, glossaryHash, src].join('\u0001'));
    }

    /* ---------------- Choix des clés ---------------- */
    function providerDefaults(key) { return DDT.PROVIDERS[key.provider] || {}; }
    function keyMaxChars(key) { return Number(key.maxChars) || providerDefaults(key).maxChars || 4000; }
    function keyInterval(key) {
      return key.minIntervalMs !== undefined && key.minIntervalMs !== '' ? Number(key.minIntervalMs) : (providerDefaults(key).minIntervalMs || 0);
    }
    function keyMaxPerDay(key) {
      if (key.maxRequestsPerDay !== undefined && key.maxRequestsPerDay !== '' && key.maxRequestsPerDay !== null) return Number(key.maxRequestsPerDay) || 0;
      return providerDefaults(key).maxRequestsPerDay || 0;
    }
    function isLocal(key) { return key.provider === 'ollama' || key.tier === 'local'; }
    function tierOf(key) { return isLocal(key) ? 'local' : (key.tier === 'paid' ? 'paid' : 'free'); }

    function buildChain(keys, opts) {
      var usable = keys.filter(function (k) { return k.enabled !== false && (k.key || isLocal(k)) && k.modelEasy; });
      if (opts && opts.keyId) {
        return usable.filter(function (k) { return k.id === opts.keyId; });
      }
      var chain = usable.filter(function (k) { var tr = tierOf(k); return tr === 'free' || tr === 'local'; });
      if (opts && opts.sensitive) {
        chain = chain.filter(isLocal).concat(chain.filter(function (k) { return !isLocal(k); }));
      }
      return chain;
    }

    function keyAvailability(key, st, usage) {
      var t = now();
      if (st.disabled[key.id]) return { ok: false, reason: st.disabled[key.id] };
      var until = Math.max(st.pauses[key.id] || 0, softPause[key.id] || 0);
      if (until > t) return { ok: false, until: until, reason: 'paused' };
      var max = keyMaxPerDay(key);
      var used = (usage.perKey[key.id] || {}).requests || 0;
      if (max && used >= max) {
        var d = new Date(t);
        var midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
        return { ok: false, until: midnight, reason: 'daily_limit' };
      }
      return { ok: true };
    }

    /* ---------------- Appels fournisseurs ---------------- */
    /* Firefox arrête la page d'arrière-plan après 30 s sans appel d'API d'extension, même si une
     * requête est en cours (vu en vrai : Ollama qui charge un modèle 7B met plus de 30 s, la requête
     * était coupée et le modèle jamais chargé). Un appel d'API léger toutes les 20 s la garde en vie. */
    function keepAlive() {
      if (!api || !api.runtime || typeof api.runtime.getPlatformInfo !== 'function') return null;
      return setInterval(function () {
        try { var p = api.runtime.getPlatformInfo(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* rien */ }
      }, 20000);
    }

    /* Requête + lecture complète du corps : le délai maximal et le maintien en vie couvrent aussi
     * la lecture du corps (un serveur peut envoyer les en-têtes puis rester bloqué). Résout { res, body }. */
    function fetchRead(url, init, timeoutMs) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = null;
      var alive = keepAlive();
      var timedOut = false;
      if (ctrl) {
        init.signal = ctrl.signal;
        timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, timeoutMs);
      }
      function stop() { if (timer) clearTimeout(timer); if (alive) clearInterval(alive); timer = null; alive = null; }
      function mark(e) {
        if (timedOut || (ctrl && ctrl.signal.aborted)) {
          if (!e || typeof e !== 'object') e = new Error('timeout');
          try { e.timedOut = true; } catch (x) { /* rien */ }
        }
        return e;
      }
      return fetchFn(url, init).then(function (res) {
        return Promise.resolve().then(function () { return res.text(); }).then(function (txt) {
          stop();
          var json = null;
          try { json = JSON.parse(txt); } catch (e) { /* texte brut */ }
          return { res: res, body: { text: txt, json: json } };
        }, function (e) {
          stop();
          if (timedOut || (ctrl && ctrl.signal.aborted)) throw mark(e);
          return { res: res, body: { text: '', json: null } };
        });
      }, function (e) {
        stop();
        throw mark(e);
      });
    }

    function classify(key, res, body) {
      var st = res.status;
      var msg = DDT.sanitize(body.text, [key.key]);
      var lower = msg.toLowerCase();
      var daily = /per.?day|daily|quotidien|requests per day|rpd|free-models-per-day/.test(lower);
      if (st === 429 || (st === 403 && /quota|rate.?limit|resource.?exhausted/.test(lower))) {
        var ra = res.headers && res.headers.get ? res.headers.get('retry-after') : null;
        var raMs = ra && !isNaN(+ra) ? (+ra) * 1000 : null;
        return new ProviderError('rate', msg, { retryAfterMs: raMs, daily: daily, status: st });
      }
      if (key.provider === 'ollama' && st === 403) return new ProviderError('ollama_origin', msg, { status: st });
      if (st === 401 || st === 403) return new ProviderError('auth', msg, { status: st });
      if (st === 400 && /api key not valid|api_key_invalid|invalid api key/.test(lower)) return new ProviderError('auth', msg, { status: st });
      if (st === 402) return new ProviderError('payment', msg, { status: st });
      if (st >= 500) return new ProviderError('server', msg, { status: st });
      return new ProviderError('bad_request', msg, { status: st });
    }

    function baseOf(key) {
      if (key.provider === 'ollama') return String(key.baseUrl || DDT.PROVIDERS.ollama.base).replace(/\/+$/, '');
      return DDT.PROVIDERS[key.provider].base;
    }

    function cleanModel(m) { return String(m || '').replace(/^models\//, ''); }

    /* Ollama : sortie structurée imposée (schéma JSON), même nombre de textes en sortie qu'en entrée.
     * Les petits modèles locaux cassent sinon souvent la structure de la réponse. */
    function ollamaSchema(user) {
      var n = 0;
      var withGloss = false;
      try { var u = JSON.parse(user); n = (u.texts || []).length; withGloss = Array.isArray(u.already_glossed); } catch (e) { /* format libre */ }
      if (!n) return 'json';
      var props = { translations: { type: 'array', items: { type: 'string' }, minItems: n, maxItems: n } };
      if (withGloss) {
        props.terms = { type: 'array', items: { type: 'object', properties: { en: { type: 'string' }, tr: { type: 'string' } }, required: ['en', 'tr'] } };
      }
      return { type: 'object', properties: props, required: ['translations'] };
    }

    /* Plafond de longueur de réponse : un petit modèle peut boucler sans fin (vu avec qwen2.5:7b
     * en ourdou : plus de 2 000 jetons pour quelques phrases). Large marge pour les écritures non latines. */
    var ollamaSchemaSlow = {};
    var OLLAMA_SCHEMA_TIMEOUT_MS = 90000;

    function ollamaMaxTokens(user) {
      var chars = 0;
      try { (JSON.parse(user).texts || []).forEach(function (t) { chars += String(t).length; }); } catch (e) { chars = String(user).length; }
      return Math.min(8192, Math.max(512, Math.ceil(chars * 1.5) + 256));
    }

    /* Jetons réellement comptés par le fournisseur (compatibles OpenAI ou Gemini), sinon null. */
    function usageFrom(j) {
      if (!j || typeof j !== 'object') return null;
      if (j.usage && (j.usage.prompt_tokens !== undefined || j.usage.completion_tokens !== undefined)) {
        return { in: Number(j.usage.prompt_tokens) || 0, out: Number(j.usage.completion_tokens) || 0 };
      }
      var m = j.usageMetadata;
      if (m && (m.promptTokenCount !== undefined || m.candidatesTokenCount !== undefined)) {
        // les jetons de réflexion (thoughtsTokenCount) sont facturés comme la sortie
        return { in: Number(m.promptTokenCount) || 0, out: (Number(m.candidatesTokenCount) || 0) + (Number(m.thoughtsTokenCount) || 0) };
      }
      return null;
    }

    /* hooks (facultatif) : maxTokens (plafond de sortie, clé payante), beforeResend() appelé avant
     * tout second envoi (repli sans response_format, Ollama sans schéma), usage rempli à la réponse. */
    function callProvider(key, model, system, user, hooks) {
      hooks = hooks || {};
      var resend = function () { return hooks.beforeResend ? Promise.resolve(hooks.beforeResend()) : Promise.resolve(); };
      var p = key.provider;
      var timeout = Number(key.timeoutMs) || providerDefaults(key).timeoutMs || 60000;
      var url;
      var init;
      if (p === 'gemini') {
        url = baseOf(key) + '/models/' + encodeURIComponent(cleanModel(model)) + ':generateContent';
        var gen = { temperature: 0, responseMimeType: 'application/json' };
        if (hooks.maxTokens) gen.maxOutputTokens = hooks.maxTokens;
        init = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: gen
          })
        };
        return send(url, init, timeout, function (j) {
          var c = j && j.candidates && j.candidates[0];
          if (!c || !c.content || !c.content.parts) return '';
          return c.content.parts.map(function (x) { return x.text || ''; }).join('');
        });
      }
      if (p === 'ollama') {
        url = baseOf(key) + '/api/chat';
        var schema = ollamaSchema(user);
        var askOllama = function (format, to) {
          return send(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model, stream: false, format: format, options: { temperature: 0, num_predict: ollamaMaxTokens(user) },
              messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
            })
          }, to, function (j) { return j && j.message ? j.message.content : ''; });
        };
        // Le schéma JSON tient les petits modèles dans la bonne structure, mais avec certaines écritures
        // (thaï vu en vrai) la génération sous schéma devient extrêmement lente : au bout de 90 s sans
        // réponse, on relance en JSON libre et on garde ce choix pour ce modèle.
        if (typeof schema === 'object' && !ollamaSchemaSlow[model]) {
          return askOllama(schema, Math.min(timeout, OLLAMA_SCHEMA_TIMEOUT_MS)).catch(function (err) {
            if (!err || !err.timedOut) throw err;
            ollamaSchemaSlow[model] = true;
            log('ollama: schéma trop lent, JSON libre pour', model);
            return resend().then(function () { return askOllama('json', timeout); });
          });
        }
        return askOllama(typeof schema === 'object' ? 'json' : schema, timeout);
      }
      // compatibles OpenAI : groq, mistral, openrouter
      url = baseOf(key) + '/chat/completions';
      var body = {
        model: model, temperature: 0,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        response_format: { type: 'json_object' }
      };
      // Modèles qui « réfléchissent » (gpt-oss chez Groq) : réflexion courte, beaucoup moins de jetons
      if (p === 'groq' && /gpt-oss/i.test(model)) body.reasoning_effort = 'low';
      if (hooks.maxTokens) body.max_tokens = hooks.maxTokens;
      var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key.key };
      if (p === 'openrouter') headers['X-Title'] = 'DevDocTrad';
      var pick = function (j) {
        var c = j && j.choices && j.choices[0];
        return c && c.message ? c.message.content : '';
      };
      return send(url, { method: 'POST', headers: headers, body: JSON.stringify(body) }, timeout, pick)
        .catch(function (e) {
          if (e.kind === 'bad_request' && /response_format|json_object|json mode|json/i.test(e.message)) {
            delete body.response_format;
            // second envoi : compté (requête, coût réservé) comme le premier
            return resend().then(function () {
              return send(url, { method: 'POST', headers: headers, body: JSON.stringify(body) }, timeout, pick);
            });
          }
          throw e;
        });

      function send(u, i, to, picker) {
        return fetchRead(u, i, to).then(function (r) {
          var res = r.res;
          var b = r.body;
          if (!res.ok) throw classify(key, res, b);
          noteRateHeaders(key, res.headers);
          hooks.usage = usageFrom(b.json);
          return picker(b.json);
        }, function (err) {
          if (err instanceof ProviderError) throw err;
          var kind = key.provider === 'ollama' ? 'ollama_down' : 'network';
          var pe = new ProviderError(kind, DDT.sanitize(err && err.message, [key.key]));
          if (err && err.timedOut) pe.timedOut = true;
          throw pe;
        });
      }
    }

    /*
     * Limites par minute annoncées dans les en-têtes (Groq, fournisseurs compatibles OpenAI) :
     * si le reste de jetons est trop bas pour une requête de plus, courte pause jusqu'à la
     * remise à zéro, au lieu d'attendre une erreur 429.
     */
    function parseDuration(v) {
      if (!v) return 0;
      if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 1000);
      var m = String(v).match(/^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:(\d+)ms)?$/);
      if (!m) return 0;
      return ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (parseFloat(m[3]) || 0)) * 1000 + (+m[4] || 0);
    }
    var LOW_TOKENS = 3500;
    function noteRateHeaders(key, headers) {
      if (!headers || !headers.get) return;
      var rem = headers.get('x-ratelimit-remaining-tokens');
      var reset = parseDuration(headers.get('x-ratelimit-reset-tokens'));
      if (rem === null || rem === undefined || rem === '' || isNaN(+rem) || +rem >= LOW_TOKENS || !reset) return;
      var wait = Math.min(reset + 500, 90000);
      softPause[key.id] = now() + wait;
      updateSession(function (st) {
        st.pauses[key.id] = Math.max(st.pauses[key.id] || 0, now() + wait);
        return { pauses: st.pauses };
      }).catch(function (e) { log('pause douce', String(e && e.message)); });
    }
    var softPause = {};

    function chunkLimit(ctx) { return MAX_ATTEMPTS_PER_CHUNK + (ctx.extraBudget || 0); }

    /* Une requête, avec un seul nouvel essai après 2 s pour 5xx / réseau.
     * call = { cost: coût maximal réservé avant l'envoi, maxTokens } ; env.usage est tenu à jour. */
    function callOnce(key, model, system, user, ctx, env, call) {
      call = call || {};
      var reserved = 0;
      var paid = tierOf(key) === 'paid';
      var reserve = function () {
        ctx.attempts++;
        return reserveCall(key, call.cost || 0, env).then(function () { reserved += call.cost || 0; });
      };
      var hooks = { maxTokens: call.maxTokens || 0, beforeResend: reserve, usage: null };
      return waitInterval(key).then(reserve).then(function () {
        return callProvider(key, model, system, user, hooks);
      }).then(function (text) {
        // Dépense corrigée avec les jetons réellement comptés (prix de la clé)
        if (!paid || !hooks.usage) return text;
        var actual = DDT.tokensCost(hooks.usage.in, hooks.usage.out, key.priceIn, key.priceOut);
        return changeUsage(key.id, function (k) { k.cost += actual - reserved; }, env).then(function () { return text; });
      }, function (e) {
        // Réponse d'erreur du fournisseur (aucun jeton généré) : la réservation est rendue.
        var refund = paid && reserved > 0 && e && e.status && e.kind !== 'paid_cap'
          ? changeUsage(key.id, function (k) { k.cost -= reserved; }, env).catch(function () { /* rien */ })
          : Promise.resolve();
        return refund.then(function () {
          if ((e.kind === 'server' || e.kind === 'network') && !ctx.retried && ctx.attempts < chunkLimit(ctx)) {
            ctx.retried = true;
            return sleep(2000).then(function () { return callOnce(key, model, system, user, ctx, env, call); });
          }
          throw e;
        });
      });
    }

    /* Écart minimal entre deux requêtes d'une même clé : file par clé, pour que deux onglets
     * ne partent pas au même instant. Seule l'attente est sérialisée, pas la requête. */
    function waitInterval(key) {
      var id = key.id;
      var prev = intervalQueue[id] || Promise.resolve();
      var mine = prev.then(function () {
        return getSessionState().then(function (st) {
          var last = Math.max(lastReq[id] || 0, st.lastReq[id] || 0);
          var wait = last + keyInterval(key) - now();
          return wait > 0 ? sleep(wait) : null;
        }, function () { return null; }).then(function () {
          lastReq[id] = now();
          var stamp = lastReq[id];
          updateSession(function (st2) {
            st2.lastReq[id] = Math.max(st2.lastReq[id] || 0, stamp);
            return { lastReq: st2.lastReq };
          }).catch(function (e) { log('lastReq', String(e && e.message)); });
        });
      });
      intervalQueue[id] = mine.catch(function () { /* rien */ });
      return mine;
    }

    /* ---------------- Garde-fous avant appel ---------------- */
    /* Prix et plafond d'une clé payante : nombres finis, prix positifs ou nuls, plafond > 0. */
    function priceOk(v) {
      if (v === '' || v === null || v === undefined || typeof v === 'boolean') return false;
      if (typeof v === 'string' && !/^\s*[+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?\s*$/.test(v)) return false;
      var n = Number(v);
      return isFinite(n) && n >= 0;
    }
    function paidConfigOk(key) {
      var cap = Number(key.dailyCap);
      return priceOk(key.dailyCap) && cap > 0 && priceOk(key.priceIn) && priceOk(key.priceOut);
    }
    function checkGuards(key, chars, usage) {
      var tier = tierOf(key);
      if (key.provider === 'openrouter' && tier === 'free' && !/:free$/.test(cleanModel(key.modelEasy) + '') ) {
        return new ProviderError('config', DDT.t('errOpenRouterFree'));
      }
      if (key.provider === 'openrouter' && tier === 'free' && key.modelHard && !/:free$/.test(key.modelHard)) {
        return new ProviderError('config', DDT.t('errOpenRouterFree'));
      }
      if (tier === 'paid') {
        if (!paidConfigOk(key)) return new ProviderError('paid_unset', DDT.t('errPaidUnset'));
        var cap = parseFloat(key.dailyCap);
        var est = DDT.estimateCost(chars, parseFloat(key.priceIn), parseFloat(key.priceOut));
        var spent = (usage.perKey[key.id] || {}).cost || 0;
        // contrôle rapide ; le vrai refus se fait à la réservation, sous verrou, juste avant l'envoi
        if (spent + est > cap) return new ProviderError('paid_cap', DDT.t('errPaidCap', [spent.toFixed(4), cap]));
        return { cost: est };
      }
      return { cost: 0 };
    }

    /* ---------------- Traduction d'un morceau, avec validation et découpage ---------------- */
    /* Erreur au milieu d'un découpage : les textes déjà traduits sont gardés dans err.partial
     * (undefined = pas encore fait, à remettre en file ; null = laissé en original). */
    function withPartial(err, partial) {
      if (err && typeof err === 'object') err.partial = partial;
      return err;
    }

    function translateChunk(key, srcs, env, ctx) {
      // Nombre total d'appels borné par morceau : au-delà, les textes restent en original.
      if (ctx.attempts >= chunkLimit(ctx)) return Promise.resolve(srcs.map(function () { return null; }));
      var hard = DDT.isHardBatch(srcs);
      var model = hard && key.modelHard ? key.modelHard : key.modelEasy;
      return requestTranslations(key, model, srcs, env, ctx).then(function (resp) {
        if (!resp || !Array.isArray(resp.translations) || resp.translations.length !== srcs.length) {
          if (srcs.length === 1) return retrySingle(key, srcs[0], env, ctx).then(function (v) { return [v]; });
          var mid = Math.ceil(srcs.length / 2);
          var first = srcs.slice(0, mid);
          var second = srcs.slice(mid);
          return translateChunk(key, first, env, ctx).then(function (a) {
            return translateChunk(key, second, env, ctx).then(function (b) { return a.concat(b); }, function (e) {
              throw withPartial(e, a.concat(e && e.partial && e.partial.length === second.length ? e.partial : undoneList(second.length)));
            });
          }, function (e) {
            var pa = e && e.partial && e.partial.length === first.length ? e.partial : undoneList(first.length);
            throw withPartial(e, pa.concat(undoneList(second.length)));
          });
        }
        if (Array.isArray(resp.glossed)) resp.glossed.forEach(function (g) { if (typeof g === 'string') env.glossed.add(g); });
        var out = [];
        var bad = [];
        srcs.forEach(function (s, i) {
          var v = DDT.validateTranslation(s, resp.translations[i], { explainTerms: env.settings.explainTerms, target: env.settings.target });
          if (v.ok) out[i] = v.value; else { out[i] = null; bad.push(i); }
        });
        if (env.settings.explainTerms) out = DDT.addTermGlosses(out, resp.terms, env.glossed);
        var seq = Promise.resolve();
        var left = bad.slice();
        bad.forEach(function (i) {
          seq = seq.then(function () {
            return retrySingle(key, srcs[i], env, ctx).then(function (v) { out[i] = v; left.shift(); });
          });
        });
        return seq.then(function () { return out; }, function (e) {
          throw withPartial(e, out.map(function (v, i) { return left.indexOf(i) !== -1 ? undefined : v; }));
        });
      });
    }

    function retrySingle(key, src, env, ctx) {
      if (ctx.attempts >= chunkLimit(ctx)) return Promise.resolve(null);
      var model = key.modelHard || key.modelEasy;
      return requestTranslations(key, model, [src], env, ctx).then(function (resp) {
        if (!resp || !Array.isArray(resp.translations) || resp.translations.length !== 1) return null;
        var v = DDT.validateTranslation(src, resp.translations[0], { explainTerms: env.settings.explainTerms, target: env.settings.target });
        if (v.ok && Array.isArray(resp.glossed)) resp.glossed.forEach(function (g) { env.glossed.add(g); });
        if (!v.ok) return null;
        return env.settings.explainTerms ? DDT.addTermGlosses([v.value], resp.terms, env.glossed)[0] : v.value;
      });
    }

    function requestTranslations(key, model, srcs, env, ctx) {
      var chars = srcs.reduce(function (a, s) { return a + s.length; }, 0);
      var guard = checkGuards(key, chars, env.usage);
      if (guard instanceof ProviderError) return Promise.reject(guard);
      var system = DDT.buildSystemPrompt(env.settings.target, env.settings.explainTerms);
      var gl = DDT.glossaryForTexts(env.glossary, srcs);
      var user = DDT.buildUserMessage(env.settings.target, srcs, gl, Array.from(env.glossed), env.settings.explainTerms);
      var call = { cost: 0, maxTokens: 0 };
      if (tierOf(key) === 'paid') {
        // Clé payante : sortie plafonnée, et coût maximal de l'appel réservé avant l'envoi
        call.maxTokens = DDT.maxOutputTokens(chars, env.settings.target) + reasoningMargin(key, model);
        var tin = (system.length + user.length) / 3.5;
        call.cost = Math.max(guard.cost, DDT.tokensCost(tin, call.maxTokens, key.priceIn, key.priceOut));
      }
      return callOnce(key, model, system, user, ctx, env, call).then(function (text) {
        return DDT.extractJson(text);
      });
    }

    /* Modèles qui « réfléchissent » : leurs jetons de réflexion comptent dans le plafond de sortie. */
    function reasoningMargin(key, model) {
      var m = String(model || '');
      if (key.provider === 'groq' && /gpt-oss/i.test(m)) return 1024;   // réflexion courte demandée
      if (/gemini-(2\.5|[3-9])|thinking|magistral|deepseek-r1|qwq|gpt-oss|(^|\/)o[1-9](-|$)|reason/i.test(m)) return 2048;
      return 0;
    }

    /* ---------------- Point d'entrée : traduire une liste de textes ---------------- */
    function translateTexts(texts, opts) {
      opts = opts || {};
      return loadAll().then(function (all) {
        var settings = all.settings;
        var env = {
          settings: settings,
          glossary: all.glossary,
          usage: all.usage,
          glossed: new Set(opts.alreadyGlossed || [])
        };
        var results = new Array(texts.length);
        var glossedOut = [];
        return DDT.sha256hex(JSON.stringify(all.glossary)).then(function (gh) {
          return Promise.all(texts.map(function (s) { return cacheKey(settings, gh, s); }));
        }).then(function (hashes) {
          return cacheGet(hashes).then(function (cache) {
            var misses = [];
            texts.forEach(function (s, i) {
              var hit = cache[hashes[i]];
              if (hit && typeof hit.t === 'string') {
                results[i] = hit.t;
                if (hit.g) hit.g.forEach(function (g) { glossedOut.push(g); });
              } else misses.push(i);
            });
            if (!misses.length) return { translations: results, glossed: glossedOut, fromCache: true };
            var chain = buildChain(all.keys, opts);
            if (!chain.length) return { translations: results, glossed: glossedOut, error: 'no_key' };
            return processMisses(misses, texts, hashes, chain, env, results, glossedOut, opts);
          });
        });
      });
    }

    function processMisses(queue, texts, hashes, chain, env, results, glossedOut, opts) {
      var skip = {};
      var notice = '';
      var via = null;
      var guardStop = 0;

      function step() {
        if (!queue.length) return Promise.resolve(done());
        if (++guardStop > 200) return Promise.resolve(done());
        return getSessionState().then(function (st) {
          return getLocal('usage').then(function (r) {
            env.usage = normalizeUsage(r.usage);
            var key = null;
            var minUntil = Infinity;
            for (var i = 0; i < chain.length; i++) {
              var k = chain[i];
              if (skip[k.id]) continue;
              var av = keyAvailability(k, st, env.usage);
              if (av.ok) { key = k; break; }
              if (av.until) minUntil = Math.min(minUntil, av.until);
            }
            if (!key) {
              if (isFinite(minUntil)) return done({ error: 'rate_limited', waitMs: Math.max(1000, minUntil - now()) });
              if (notice) return done({ error: 'error', message: notice });
              return done({ error: 'no_key' });
            }
            // morceau à la taille de la clé
            var max = keyMaxChars(key);
            var chunk = [];
            var size = 0;
            while (queue.length && (chunk.length === 0 || size + texts[queue[0]].length <= max)) {
              var idx = queue.shift();
              chunk.push(idx);
              size += texts[idx].length;
            }
            var ctx = { attempts: 0, retried: false, extraBudget: Math.min(chunk.length, 8) };
            var srcs = chunk.map(function (i2) { return texts[i2]; });
            return translateChunk(key, srcs, env, ctx).then(function (vals) {
              via = { label: key.label || DDT.PROVIDERS[key.provider].label, local: isLocal(key), provider: key.provider };
              keep(chunk, vals);
              return step();
            }, function (err) {
              // Erreur au milieu d'un découpage : les moitiés déjà traduites sont gardées.
              var pending = chunk;
              if (err && Array.isArray(err.partial) && err.partial.length === chunk.length) {
                pending = chunk.filter(function (i4, j) { return err.partial[j] === undefined; });
                if (pending.length < chunk.length) {
                  via = { label: key.label || DDT.PROVIDERS[key.provider].label, local: isLocal(key), provider: key.provider };
                  keep(chunk.filter(function (i4, j) { return err.partial[j] !== undefined; }),
                    err.partial.filter(function (v) { return v !== undefined; }));
                }
              }
              queue = pending.concat(queue);
              return handleKeyError(key, err).then(function (msg) {
                if (msg) notice = msg;
                if (err.kind === 'paid_cap' || err.kind === 'paid_unset') {
                  return done({ error: 'error', message: err.message });
                }
                skip[key.id] = skip[key.id] || (err.kind !== 'rate');
                return step();
              });
            });
          });
        });
      }

      function keep(idxs, vals) {
        var g = Array.from(env.glossed);
        idxs.forEach(function (i3, j) {
          results[i3] = vals[j];
          // Pages sensibles : jamais de traduction écrite dans le cache.
          if (typeof vals[j] === 'string' && !opts.sensitive) {
            cachePut(hashes[i3], { t: vals[j], g: termsIn(vals[j], g), ts: now() });
          }
        });
        g.forEach(function (x) { glossedOut.push(x); });
      }

      function termsIn(text, terms) {
        if (!env.settings.explainTerms) return undefined;
        var low = text.toLowerCase();
        var found = terms.filter(function (x) {
          var k = String(x).toLowerCase();
          return low.indexOf('(' + k + ')') !== -1 || low.indexOf(k + ' (') !== -1;
        });
        return found.length ? found : undefined;
      }

      function done(extra) {
        var r = { translations: results, glossed: glossedOut, via: via };
        if (notice) r.notice = notice;
        return Object.assign(r, extra || {});
      }

      return step();
    }

    /* opts.pauseId : identifiant des pauses (« id:whisper » pour la transcription) ; les clés
     * refusées (auth, paiement) restent désactivées sous leur propre identifiant. */
    function handleKeyError(key, err, opts) {
      var label = key.label || (DDT.PROVIDERS[key.provider] || {}).label || key.provider;
      var pauseId = (opts && opts.pauseId) || key.id;
      var pauses = {};
      var disabled = {};
      var msg = '';
      log('key error', key.provider, err.kind);
      if (err.kind === 'rate') {
        var ms = err.retryAfterMs || (err.daily ? PAUSE_DAILY_MS : PAUSE_DEFAULT_MS);
        pauses[pauseId] = now() + ms;
      } else if (err.kind === 'ollama_down') {
        pauses[pauseId] = now() + PAUSE_DEFAULT_MS;
        msg = DDT.t('errOllamaDown');
      } else if (err.kind === 'ollama_origin') {
        disabled[key.id] = 'ollama_origin';
        msg = DDT.t('errOllamaOrigin');
      } else if (err.kind === 'auth') {
        disabled[key.id] = 'auth';
        msg = DDT.t('badgeKeyProblem', [label, DDT.t('errAuth')]);
      } else if (err.kind === 'payment') {
        disabled[key.id] = 'payment';
        var prepay = key.provider === 'gemini' && /prepay|prepayment|credits are depleted|billing/i.test(err.message || '');
        msg = DDT.t('badgeKeyProblem', [label, DDT.t(prepay ? 'errGeminiPrepay' : 'errPayment')]);
      } else if (err.kind === 'config') {
        msg = DDT.t('badgeKeyProblem', [label, err.message]);
      } else if (err.kind === 'paid_cap' || err.kind === 'paid_unset') {
        msg = err.message;
      } else {
        msg = DDT.t('badgeKeyProblem', [label, DDT.sanitize(err.message, [key.key]).slice(0, 160)]);
      }
      if (!Object.keys(pauses).length && !Object.keys(disabled).length) return Promise.resolve(msg);
      // État relu sous verrou au moment d'écrire : seules les entrées de cette clé changent.
      return updateSession(function (st) {
        Object.keys(pauses).forEach(function (id) { st.pauses[id] = Math.max(st.pauses[id] || 0, pauses[id]); });
        Object.keys(disabled).forEach(function (id) { st.disabled[id] = disabled[id]; });
        return { pauses: st.pauses, disabled: st.disabled };
      }).then(function () { return msg; });
    }

    /* ---------------- Liste des modèles / test de clé ---------------- */
    function listModels(key) {
      var p = key.provider;
      var timeout = 20000;
      var url;
      var headers = {};
      if (p === 'gemini') {
        url = baseOf(key) + '/models?pageSize=1000';
        headers['x-goog-api-key'] = key.key;
      } else if (p === 'ollama') {
        url = baseOf(key) + '/api/tags';
      } else {
        url = baseOf(key) + '/models';
        headers.Authorization = 'Bearer ' + key.key;
      }
      var pages = 0;
      var geminiModels = [];
      function getPage(u) {
        return fetchRead(u, { method: 'GET', headers: headers }, timeout).then(function (r0) {
          var res = r0.res;
          var b = r0.body;
          if (!res.ok) throw classify(key, res, b);
          var j0 = b.json || {};
          if (p === 'gemini') {
            geminiModels = geminiModels.concat(j0.models || []);
            if (j0.nextPageToken && ++pages < 5) return getPage(url + '&pageToken=' + encodeURIComponent(j0.nextPageToken));
            return { res: res, b: { json: { models: geminiModels } } };
          }
          return { res: res, b: b };
        });
      }
      return getPage(url).then(function (r) {
        var res = r.res;
        return Promise.resolve(r.b).then(function (b) {
          if (!res.ok) throw classify(key, res, b);
          var j = b.json || {};
          var list = [];
          if (p === 'gemini') {
            (j.models || []).forEach(function (m) {
              if ((m.supportedGenerationMethods || []).indexOf('generateContent') !== -1) {
                list.push({ id: cleanModel(m.name), name: m.displayName || cleanModel(m.name) });
              }
            });
          } else if (p === 'ollama') {
            (j.models || []).forEach(function (m) { list.push({ id: m.name, name: m.name, free: true }); });
          } else {
            (j.data || []).forEach(function (m) {
              var free;
              if (p === 'openrouter') {
                var pr = m.pricing || {};
                free = /:free$/.test(m.id) || (Number(pr.prompt) === 0 && Number(pr.completion) === 0);
              }
              list.push({ id: m.id, name: m.name || m.id, free: free });
            });
          }
          // Seulement des modèles qui savent traduire : pas de voix (whisper, orpheus, tts),
          // pas de filtres de sécurité (guard), pas d'embeddings, d'images ni de modération.
          var NOT_TEXT = /whisper|orpheus|(^|[-_/])tts([-_]|$)|playai|guard|embed|moderation|imagen|veo|aqa|dall-e|vision-preview|rerank/i;
          list = list.filter(function (m) { return !NOT_TEXT.test(m.id); });
          list.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
          return list;
        });
      }, function (err) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(p === 'ollama' ? 'ollama_down' : 'network', DDT.sanitize(err && err.message, [key.key]));
      });
    }

    /* Ollama accepte les lectures (GET) d'une extension mais refuse ses envois (POST) tant que
     * OLLAMA_ORIGINS n'est pas réglé : le test fait donc aussi un petit POST /api/show. */
    function ollamaPostCheck(key, list) {
      var model = key.modelEasy || (list[0] && list[0].id) || 'x';
      return fetchRead(baseOf(key) + '/api/show', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model })
      }, 15000).then(function (r) {
        if (r.res.status === 403) throw classify(key, r.res, r.body);
        return list;
      }, function (err) {
        throw new ProviderError('ollama_down', DDT.sanitize(err && err.message));
      });
    }

    function testKey(key) {
      return listModels(key).then(function (list) {
        return key.provider === 'ollama' ? ollamaPostCheck(key, list) : list;
      }).then(function (list) {
        return { ok: true, count: list.length, models: list };
      }, function (e) {
        var msg = e.kind === 'ollama_origin' ? DDT.t('errOllamaOrigin')
          : e.kind === 'ollama_down' ? DDT.t('errOllamaDown')
            : e.kind === 'auth' ? DDT.t('errAuth')
              : e.kind === 'rate' ? DDT.t('errRate')
                : DDT.sanitize(e.message, [key.key]);
        return { ok: false, kind: e.kind, message: msg };
      });
    }

    /* ---------------- État pour le popup et les réglages (sans les clés) ---------------- */
    function publicState() {
      return Promise.all([loadAll(), getSessionState()]).then(function (r) {
        var all = r[0];
        var st = r[1];
        var keys = all.keys.map(function (k) {
          var av = keyAvailability(k, st, all.usage);
          var u = all.usage.perKey[k.id] || { requests: 0, cost: 0 };
          // même condition que buildChain : un modèle ET une clé d'API (sauf Ollama)
          var hasKey = !!k.key || isLocal(k);
          return {
            id: k.id, provider: k.provider, label: k.label || (DDT.PROVIDERS[k.provider] || {}).label,
            tier: tierOf(k), enabled: k.enabled !== false, masked: DDT.maskKey(k.key),
            available: av.ok && k.enabled !== false && hasKey, until: av.until || null,
            reason: av.reason || (hasKey ? null : 'no_key'),
            requests: u.requests, cost: u.cost, maxPerDay: keyMaxPerDay(k), configured: !!k.modelEasy && hasKey
          };
        });
        return { keys: keys, settings: all.settings };
      });
    }

    /* ---------------- Traduction automatique : scripts enregistrés ---------------- */
    function originsFor(host) { return ['*://' + host + '/*', '*://*.' + host + '/*']; }

    function syncAutoScripts() {
      if (!api.scripting || !api.scripting.registerContentScripts) return Promise.resolve();
      return loadAll().then(function (all) {
        var sites = all.settings.autoSites || [];
        return Promise.all(sites.map(function (h) {
          return api.permissions.contains({ origins: originsFor(h) }).then(function (ok) { return ok ? h : null; })
            .catch(function () { return null; });
        })).then(function (granted) {
          var matches = [];
          granted.forEach(function (h) { if (h) matches = matches.concat(originsFor(h)); });
          return api.scripting.getRegisteredContentScripts({ ids: ['auto'] }).catch(function () { return []; })
            .then(function (existing) {
              var has = existing && existing.length > 0;
              if (!matches.length) return has ? api.scripting.unregisterContentScripts({ ids: ['auto'] }) : null;
              var def = { id: 'auto', js: ['shared.js', 'content.js', 'auto.js'], matches: matches, runAt: 'document_idle', persistAcrossSessions: true };
              if (has) return api.scripting.updateContentScripts([{ id: 'auto', matches: matches }]);
              return api.scripting.registerContentScripts([def]).catch(function () {
                delete def.persistAcrossSessions;
                return api.scripting.registerContentScripts([def]);
              });
            });
        });
      }).catch(function (e) { log('sync auto', String(e && e.message)); });
    }

    function hostInList(host, list) {
      host = String(host || '').toLowerCase();
      return (list || []).some(function (h) { return host === h || host.slice(-(h.length + 1)) === '.' + h; });
    }

    function autoCheck(host) {
      return Promise.all([loadAll(), getSessionState()]).then(function (r) {
        var all = r[0];
        var enabled = hostInList(host, all.settings.autoSites);
        var chain = buildChain(all.keys, {});
        var available = chain.some(function (k) { return keyAvailability(k, r[1], all.usage).ok; });
        return { enabled: enabled, available: available, settings: all.settings };
      });
    }

    function addAutoSite(host) {
      host = String(host || '').toLowerCase().replace(/^www\./, '');
      return loadAll().then(function (all) {
        var s = all.settings;
        s.target = s.targetChoice;
        delete s.targetChoice;
        if (s.autoSites.indexOf(host) === -1) s.autoSites = s.autoSites.concat([host]);
        return setLocal({ settings: s });
      }).then(syncAutoScripts).then(function () { return runAutoInOpenTabs(host); });
    }
    /* Les scripts enregistrés ne s'appliquent qu'aux pages chargées ensuite : on lance tout de suite
       le déclencheur automatique dans les onglets déjà ouverts sur ce site (mêmes vérifications :
       page sensible, page déjà dans la langue cible, clé gratuite disponible). */
    function runAutoInOpenTabs(host) {
      if (!api.tabs || !api.tabs.query || !api.scripting || !api.scripting.executeScript) return Promise.resolve();
      return api.tabs.query({ url: originsFor(host) }).then(function (tabs) {
        return Promise.all((tabs || []).map(function (tb) {
          return api.scripting.executeScript({ target: { tabId: tb.id }, files: ['shared.js', 'content.js', 'auto.js'] })
            .catch(function () { /* onglet fermé ou page interdite */ });
        }));
      }).catch(function (e) { log('auto tabs', String(e && e.message)); });
    }
    function removeAutoSite(host) {
      return loadAll().then(function (all) {
        var s = all.settings;
        s.target = s.targetChoice;
        delete s.targetChoice;
        s.autoSites = s.autoSites.filter(function (h) { return h !== host; });
        return setLocal({ settings: s });
      }).then(function () {
        return api.permissions.remove({ origins: originsFor(host) }).catch(function () { return false; });
      }).then(syncAutoScripts);
    }
    function autoSitesStatus() {
      return loadAll().then(function (all) {
        return Promise.all(all.settings.autoSites.map(function (h) {
          return api.permissions.contains({ origins: originsFor(h) }).then(function (ok) { return { host: h, granted: ok }; })
            .catch(function () { return { host: h, granted: false }; });
        }));
      });
    }

    /* ---------------- Onglets : injection et commandes ---------------- */
    function tabCommand(tabId, cmd, keyId) {
      function send() { return api.tabs.sendMessage(tabId, { to: 'content', cmd: cmd, keyId: keyId || null }); }
      return send().catch(function () {
        return api.scripting.executeScript({ target: { tabId: tabId }, files: ['shared.js', 'content.js'] }).then(send);
      });
    }

    function cacheInfo() {
      return loadIndex().then(function (idx) {
        var hs = Object.keys(idx);
        var bytes = 0;
        hs.forEach(function (h) { bytes += idx[h][1] || 0; });
        return { entries: hs.length, bytes: bytes };
      });
    }
    function clearCache() {
      return loadIndex().then(function () {
        return cacheLock(function () {
          var keys = Object.keys(cacheIndex).map(function (h) { return CACHE_PREFIX + h; }).concat(cacheDrop);
          cacheIndex = {};
          cachePending = {};
          cacheDrop = [];
          // Entrées orphelines éventuelles (index perdu) : getKeys quand le navigateur le permet.
          var more = typeof local().getKeys === 'function'
            ? local().getKeys().then(function (all) {
              return (all || []).filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0; });
            }).catch(function () { return []; })
            : Promise.resolve([]);
          return more.then(function (extra) {
            var all = keys.concat(extra.filter(function (k) { return keys.indexOf(k) === -1; }));
            return setLocal({ cacheIndex: {} }).then(function () {
              return local().remove(all.concat(['cache']));
            });
          });
        });
      }).then(function () { return { ok: true }; });
    }
    function resetKeyState(keyId) {
      return updateSession(function (st) {
        delete st.pauses[keyId];
        delete st.disabled[keyId];
        delete st.pauses[keyId + ':whisper'];
        return { pauses: st.pauses, disabled: st.disabled };
      });
    }

    /* ---------------- Voix des vidéos : transcription (Groq Whisper, palier gratuit) ----------------
     * Seules les clés Groq gratuites servent : jamais de clé payante pour l'audio. Le son arrive
     * en base64 (morceaux de quelques secondes) ; seul le texte transcrit est renvoyé à la page. */
    function base64ToBytes(b64) {
      var bin = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    function voiceKeys(keys) {
      return keys.filter(function (k) {
        return k.provider === DDT.WHISPER.provider && k.enabled !== false && k.key && tierOf(k) === 'free';
      });
    }
    /* Whisper a ses propres limites chez Groq : pauses et compteur sous « id:whisper », séparés
     * de la traduction. Une clé refusée (auth, paiement) l'est pour les deux. */
    function whisperId(key) { return key.id + ':whisper'; }
    function whisperAvailability(key, st) {
      var wid = whisperId(key);
      if (st.disabled[key.id]) return { ok: false, reason: st.disabled[key.id] };
      if (st.disabled[wid]) return { ok: false, reason: st.disabled[wid] };
      var until = st.pauses[wid] || 0;
      if (until > now()) return { ok: false, until: until, reason: 'paused' };
      return { ok: true };
    }
    function transcribe(msg) {
      var audio = String((msg && msg.audio) || '');
      var mime = String((msg && msg.mime) || 'audio/webm').split(';')[0];
      if (!audio) return Promise.resolve({ ok: false, error: 'empty' });
      if (audio.length * 0.75 > DDT.WHISPER.maxBytes) return Promise.resolve({ ok: false, error: 'too_big' });
      return loadAll().then(function (all) {
        var keys = voiceKeys(all.keys);
        if (!keys.length) return { ok: false, error: 'no_groq' };
        return getSessionState().then(function (st) {
          var key = null;
          var minUntil = Infinity;
          keys.forEach(function (k) {
            if (key) return;
            var av = whisperAvailability(k, st);
            if (av.ok) key = k; else if (av.until) minUntil = Math.min(minUntil, av.until);
          });
          if (!key && !isFinite(minUntil)) return { ok: false, error: 'no_groq' };   // clés désactivées (refusées)
          if (!key) return { ok: false, error: 'rate_limited', waitMs: Math.max(1000, minUntil - now()) };
          var ext = /ogg/.test(mime) ? 'ogg' : (/mp4|m4a|aac/.test(mime) ? 'm4a' : (/wav/.test(mime) ? 'wav' : 'webm'));
          var form = new FormData();
          form.append('file', new Blob([base64ToBytes(audio)], { type: mime }), 'audio.' + ext);
          form.append('model', DDT.WHISPER.model);
          form.append('response_format', 'json');
          form.append('temperature', '0');
          var url = DDT.PROVIDERS.groq.base + DDT.WHISPER.path;
          var wid = whisperId(key);
          return fetchRead(url, { method: 'POST', headers: { Authorization: 'Bearer ' + key.key }, body: form }, 60000)
            .then(function (r) {
              var res = r.res;
              var b = r.body;
              if (!res.ok) throw classify(key, res, b);
              // compteur propre à Whisper : ne consomme pas le quota de requêtes du chat
              return bumpUsage(wid, 1, 0).then(function () {
                return { ok: true, text: DDT.cleanTranscript(b.json && b.json.text), via: key.label || 'Groq' };
              });
            }, function (e) {
              throw new ProviderError('network', DDT.sanitize(e && e.message, [key.key]));
            })
            .catch(function (err) {
              if (!(err instanceof ProviderError)) err = new ProviderError('network', DDT.sanitize(err && err.message, [key.key]));
              return handleKeyError(key, err, { pauseId: wid }).then(function (m) {
                if (err.kind === 'rate') return { ok: false, error: 'rate_limited', waitMs: err.retryAfterMs || PAUSE_DEFAULT_MS };
                return { ok: false, error: err.kind, message: m || DDT.sanitize(err.message, [key.key]).slice(0, 160) };
              });
            });
        });
      });
    }

    /* Commandes envoyées au script « voix » d'un onglet ; il est injecté à la première demande. */
    function voiceCommand(tabId, cmd, keyId, on) {
      function send() { return api.tabs.sendMessage(tabId, { to: 'voice', cmd: cmd, keyId: keyId || null, on: !!on }); }
      return send().then(function (r) {
        if (r === undefined && cmd !== 'status') throw new Error('no receiver');
        return r || { active: false };
      }).catch(function () {
        // « dub » (doublage marche/arrêt) ne sert qu'à une traduction de la voix déjà lancée
        if (cmd === 'status' || cmd === 'stop' || cmd === 'dub') return { active: false };
        return api.scripting.executeScript({ target: { tabId: tabId }, files: ['shared.js', 'voice.js'] }).then(send);
      });
    }

    function onMessage(msg) {
      if (!msg || !msg.type) return null;
      switch (msg.type) {
        case 'getState': return publicState();
        case 'listModels': return keyFromMsg(msg).then(listModels).then(function (l) { return { ok: true, models: l }; },
          function (e) { return { ok: false, kind: e.kind, message: e.kind === 'ollama_origin' ? DDT.t('errOllamaOrigin') : DDT.sanitize(e.message) }; });
        case 'testKey': return keyFromMsg(msg).then(testKey);
        case 'autoCheck': return autoCheck(msg.host);
        case 'addAutoSite': return addAutoSite(msg.host).then(function () { return { ok: true }; });
        case 'removeAutoSite': return removeAutoSite(msg.host).then(function () { return { ok: true }; });
        case 'autoSites': return autoSitesStatus();
        case 'tabCommand': return tabCommand(msg.tabId, msg.cmd, msg.keyId);
        case 'cacheInfo': return cacheInfo();
        case 'clearCache': return clearCache();
        case 'resetKey': return resetKeyState(msg.keyId).then(function () { return { ok: true }; });
        case 'syncAuto': return syncAutoScripts().then(function () { return { ok: true }; });
        case 'transcribe': return transcribe(msg);
        case 'voiceCommand': return voiceCommand(msg.tabId, msg.cmd, msg.keyId, msg.on);
        default: return null;   // message pour un autre destinataire : ne pas répondre à sa place
      }
    }
    // Les réglages envoient seulement l'identifiant ; la clé est relue dans le stockage ici.
    function keyFromMsg(msg) {
      if (msg.draft) return Promise.resolve(msg.draft);
      return getLocal('keys').then(function (r) {
        var k = (r.keys || []).filter(function (x) { return x.id === msg.keyId; })[0];
        if (!k) throw new ProviderError('config', 'unknown key');
        return k;
      });
    }

    return {
      translateTexts: translateTexts, listModels: listModels, testKey: testKey, onMessage: onMessage,
      syncAutoScripts: syncAutoScripts, autoCheck: autoCheck, tabCommand: tabCommand, flushCache: flushCache,
      buildChain: buildChain, publicState: publicState, clearCache: clearCache, cacheInfo: cacheInfo,
      addAutoSite: addAutoSite, removeAutoSite: removeAutoSite, transcribe: transcribe, voiceCommand: voiceCommand,
      _ProviderError: ProviderError
    };
  }

  root.DDT_createBackground = createBackground;

  /* Messages acceptés depuis un script de contenu (page web) : seulement ceux dont il a besoin.
   * Tout le reste (clés, réglages, cache, onglets) ne vient que des pages de l'extension
   * (popup, réglages), reconnues à leur adresse. */
  var CONTENT_SCRIPT_TYPES = { autoCheck: true, transcribe: true };
  function isTrustedSender(msg, sender, api) {
    if (!msg || !msg.type) return false;
    if (CONTENT_SCRIPT_TYPES[msg.type]) return true;
    var base = '';
    try { base = api && api.runtime && api.runtime.getURL ? api.runtime.getURL('') : ''; } catch (e) { base = ''; }
    var url = sender && typeof sender.url === 'string' ? sender.url : '';
    return !!base && !!url && url.indexOf(base) === 0;
  }
  root.DDT_isTrustedSender = isTrustedSender;

  /* ---------------- Branchement sur le navigateur ---------------- */
  var api = DDT.api;
  if (!api || !api.runtime || !api.runtime.onConnect || root.__DDT_TEST) return;

  var bg = createBackground({ api: api, fetch: root.fetch.bind(root) });
  root.__DDT_BG = bg;

  api.runtime.onConnect.addListener(function (port) {
    if (port.name !== 'ddt') return;
    port.onMessage.addListener(function (m) {
      if (!m || m.type !== 'translate') return;
      bg.translateTexts(m.texts || [], m.opts || {}).then(function (r) {
        try { port.postMessage(Object.assign({ id: m.id }, r)); } catch (e) { /* onglet fermé */ }
      }, function (e) {
        try { port.postMessage({ id: m.id, error: 'error', message: DDT.sanitize(e && e.message) }); } catch (e2) { /* rien */ }
      });
    });
  });

  api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type || msg.to === 'content') return;
    if (!isTrustedSender(msg, sender, api)) return;   // ne pas répondre : un autre destinataire peut le faire
    var p = bg.onMessage(msg);
    if (!p) return;
    p.then(sendResponse, function (e) { sendResponse({ ok: false, message: DDT.sanitize(e && e.message) }); });
    return true;
  });

  if (api.commands && api.commands.onCommand) {
    api.commands.onCommand.addListener(function (command) {
      if (command !== 'toggle-translation' && command !== 'toggle-voice') return;
      api.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
        if (!tabs || !tabs[0]) return;
        var tab = tabs[0];
        // Raccourci sur une page interdite : le navigateur ne dit rien, on l'affiche sur l'icône.
        function explain(text) {
          if (!api.action) return;
          try {
            api.action.setBadgeText({ tabId: tab.id, text: '!' });
            api.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#c81e45' });
            api.action.setTitle({ tabId: tab.id, title: 'DevDocTrad : ' + text });
          } catch (e) { /* rien */ }
        }
        var why = DDT.unsupportedReason(tab.url || '');
        if (why === 'restricted') return explain(DDT.t('popupRestricted'));
        if (why === 'pdf') return explain(DDT.t('popupPdf'));
        var p = command === 'toggle-voice' ? bg.voiceCommand(tab.id, 'toggle', null) : bg.tabCommand(tab.id, 'toggle', null);
        return p.catch(function (e) { explain(DDT.injectionHelp(e)); });
      }).catch(function () { /* onglet fermé */ });
    });
  }

  api.runtime.onInstalled.addListener(function () {
    api.storage.local.get('settings').then(function (r) {
      if (!r.settings) return api.storage.local.set({ settings: Object.assign({}, DDT.DEFAULT_SETTINGS, { termsStyle: 3 }) });
      // Mise à jour : les parenthèses (terme anglais) deviennent une option désactivée par défaut.
      if (r.settings.termsStyle !== 3) {
        return api.storage.local.set({ settings: Object.assign({}, r.settings, { explainTerms: false, termsStyle: 3 }) });
      }
    }).then(bg.syncAutoScripts);
  });
  if (api.runtime.onStartup) api.runtime.onStartup.addListener(bg.syncAutoScripts);

  // Sous Firefox, le popup peut se fermer pendant la demande de permission :
  // le site en attente est noté avant la demande et ajouté ici dès que la permission arrive.
  if (api.permissions && api.permissions.onAdded) {
    api.permissions.onAdded.addListener(function (perm) {
      api.storage.local.get('pendingAutoSite').then(function (r) {
        var h = r.pendingAutoSite;
        if (!h) return;
        var match = (perm.origins || []).some(function (o) { return o.indexOf('://' + h + '/') !== -1 || o.indexOf('.' + h + '/') !== -1; });
        if (!match) return;
        return api.storage.local.remove('pendingAutoSite').then(function () { return bg.addAutoSite(h); });
      }).catch(function () { /* rien */ });
    });
  }
})(typeof self !== 'undefined' ? self : globalThis);
