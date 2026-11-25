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
    var cacheMem = null;
    var cacheTimer = null;
    var lastReq = {};          // en mémoire + recopié dans storage.session

    /* ---------------- Stockage ---------------- */
    function local() { return api.storage.local; }
    function session() { return api.storage.session || null; }

    function getLocal(keys) { return local().get(keys); }
    function setLocal(obj) { return local().set(obj); }

    function getSessionState() {
      var s = session();
      if (!s) return Promise.resolve(Object.assign({ pauses: {}, disabled: {}, lastReq: {} }, memSession));
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
    function bumpUsage(keyId, requests, cost) {
      return getLocal('usage').then(function (r) {
        var u = normalizeUsage(r.usage);
        var k = u.perKey[keyId] || { requests: 0, cost: 0 };
        k.requests += requests || 0;
        k.cost = Math.round((k.cost + (cost || 0)) * 1e6) / 1e6;
        u.perKey[keyId] = k;
        return setLocal({ usage: u }).then(function () { return u; });
      });
    }

    /* ---------------- Cache ---------------- */
    function loadCache() {
      if (cacheMem) return Promise.resolve(cacheMem);
      return getLocal('cache').then(function (r) {
        cacheMem = r.cache || {};
        return cacheMem;
      });
    }
    function scheduleCacheWrite() {
      if (cacheTimer) return;
      cacheTimer = setTimeout(function () {
        cacheTimer = null;
        flushCache();
      }, 3000);
    }
    function flushCache() {
      if (!cacheMem) return Promise.resolve();
      var keys = Object.keys(cacheMem);
      var size = JSON.stringify(cacheMem).length * 2;
      if (keys.length > CACHE_MAX_ENTRIES || size > CACHE_MAX_BYTES) {
        keys.sort(function (a, b) { return cacheMem[a].ts - cacheMem[b].ts; });
        var target = Math.floor(Math.min(keys.length, CACHE_MAX_ENTRIES) * 0.9);
        var drop = keys.length - target;
        for (var i = 0; i < drop; i++) delete cacheMem[keys[i]];
      }
      return setLocal({ cache: cacheMem });
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

    function fetchWithTimeout(url, init, timeoutMs) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = null;
      var alive = keepAlive();
      if (ctrl) {
        init.signal = ctrl.signal;
        timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
      }
      return fetchFn(url, init).then(function (r) { if (timer) clearTimeout(timer); if (alive) clearInterval(alive); return r; }, function (e) {
        if (timer) clearTimeout(timer);
        if (alive) clearInterval(alive);
        if (ctrl && ctrl.signal.aborted && e && typeof e === 'object') { try { e.timedOut = true; } catch (x) { /* rien */ } }
        throw e;
      });
    }

    function readBody(res) {
      return res.text().then(function (txt) {
        var json = null;
        try { json = JSON.parse(txt); } catch (e) { /* texte brut */ }
        return { text: txt, json: json };
      }).catch(function () { return { text: '', json: null }; });
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

    function callProvider(key, model, system, user) {
      var p = key.provider;
      var timeout = Number(key.timeoutMs) || providerDefaults(key).timeoutMs || 60000;
      var url;
      var init;
      if (p === 'gemini') {
        url = baseOf(key) + '/models/' + encodeURIComponent(cleanModel(model)) + ':generateContent';
        init = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' }
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
            return askOllama('json', timeout);
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
            return send(url, { method: 'POST', headers: headers, body: JSON.stringify(body) }, timeout, pick);
          }
          throw e;
        });

      function send(u, i, to, picker) {
        return fetchWithTimeout(u, i, to).then(function (res) {
          return readBody(res).then(function (b) {
            if (!res.ok) throw classify(key, res, b);
            noteRateHeaders(key, res.headers);
            return picker(b.json);
          });
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
      getSessionState().then(function (st) {
        var pauses = Object.assign({}, st.pauses);
        pauses[key.id] = Math.max(pauses[key.id] || 0, now() + wait);
        return setSessionState({ pauses: pauses });
      });
      softPause[key.id] = now() + wait;
    }
    var softPause = {};

    /* Une requête, avec un seul nouvel essai après 2 s pour 5xx / réseau */
    function callOnce(key, model, system, user, ctx) {
      return waitInterval(key).then(function () {
        ctx.attempts++;
        return bumpUsage(key.id, 1, ctx.costPerCall || 0);
      }).then(function () {
        return callProvider(key, model, system, user);
      }).catch(function (e) {
        if ((e.kind === 'server' || e.kind === 'network') && !ctx.retried && ctx.attempts < MAX_ATTEMPTS_PER_CHUNK) {
          ctx.retried = true;
          return sleep(2000).then(function () { return callOnce(key, model, system, user, ctx); });
        }
        throw e;
      });
    }

    function waitInterval(key) {
      return getSessionState().then(function (st) {
        var last = Math.max(lastReq[key.id] || 0, st.lastReq[key.id] || 0);
        var wait = last + keyInterval(key) - now();
        var stamp = function () {
          lastReq[key.id] = now();
          var lr = Object.assign({}, st.lastReq);
          lr[key.id] = lastReq[key.id];
          return setSessionState({ lastReq: lr });
        };
        if (wait > 0) return sleep(wait).then(stamp);
        return stamp();
      });
    }

    /* ---------------- Garde-fous avant appel ---------------- */
    function checkGuards(key, chars, usage) {
      var tier = tierOf(key);
      if (key.provider === 'openrouter' && tier === 'free' && !/:free$/.test(cleanModel(key.modelEasy) + '') ) {
        return new ProviderError('config', DDT.t('errOpenRouterFree'));
      }
      if (key.provider === 'openrouter' && tier === 'free' && key.modelHard && !/:free$/.test(key.modelHard)) {
        return new ProviderError('config', DDT.t('errOpenRouterFree'));
      }
      if (tier === 'paid') {
        var cap = parseFloat(key.dailyCap);
        var pin = parseFloat(key.priceIn);
        var pout = parseFloat(key.priceOut);
        if (!(cap > 0) || isNaN(pin) || isNaN(pout) || key.priceIn === '' || key.priceOut === '') {
          return new ProviderError('paid_unset', DDT.t('errPaidUnset'));
        }
        var est = DDT.estimateCost(chars, pin, pout);
        var spent = (usage.perKey[key.id] || {}).cost || 0;
        if (spent + est > cap) return new ProviderError('paid_cap', DDT.t('errPaidCap', [spent.toFixed(4), cap]));
        return { cost: est };
      }
      return { cost: 0 };
    }

    /* ---------------- Traduction d'un morceau, avec validation et découpage ---------------- */
    function translateChunk(key, srcs, env, ctx) {
      var hard = DDT.isHardBatch(srcs);
      var model = hard && key.modelHard ? key.modelHard : key.modelEasy;
      return requestTranslations(key, model, srcs, env, ctx).then(function (resp) {
        if (!resp || !Array.isArray(resp.translations) || resp.translations.length !== srcs.length) {
          if (srcs.length === 1) return retrySingle(key, srcs[0], env, ctx).then(function (v) { return [v]; });
          var mid = Math.ceil(srcs.length / 2);
          return translateChunk(key, srcs.slice(0, mid), env, ctx).then(function (a) {
            return translateChunk(key, srcs.slice(mid), env, ctx).then(function (b) { return a.concat(b); });
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
        bad.forEach(function (i) {
          seq = seq.then(function () {
            return retrySingle(key, srcs[i], env, ctx).then(function (v) { out[i] = v; });
          });
        });
        return seq.then(function () { return out; });
      });
    }

    function retrySingle(key, src, env, ctx) {
      if (ctx.attempts >= MAX_ATTEMPTS_PER_CHUNK + ctx.extraBudget) return Promise.resolve(null);
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
      ctx.costPerCall = guard.cost;
      var system = DDT.buildSystemPrompt(env.settings.target, env.settings.explainTerms);
      var gl = DDT.glossaryForTexts(env.glossary, srcs);
      var user = DDT.buildUserMessage(env.settings.target, srcs, gl, Array.from(env.glossed), env.settings.explainTerms);
      return callOnce(key, model, system, user, ctx).then(function (text) {
        return DDT.extractJson(text);
      });
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
          return loadCache().then(function (cache) {
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
            var ctx = { attempts: 0, retried: false, extraBudget: chunk.length * 2 };
            var srcs = chunk.map(function (i2) { return texts[i2]; });
            return translateChunk(key, srcs, env, ctx).then(function (vals) {
              via = { label: key.label || DDT.PROVIDERS[key.provider].label, local: isLocal(key), provider: key.provider };
              var g = Array.from(env.glossed);
              chunk.forEach(function (i3, j) {
                results[i3] = vals[j];
                if (typeof vals[j] === 'string') {
                  cacheMem[hashes[i3]] = { t: vals[j], g: termsIn(vals[j], g), ts: now() };
                }
              });
              g.forEach(function (x) { glossedOut.push(x); });
              scheduleCacheWrite();
              return step();
            }, function (err) {
              queue = chunk.concat(queue);
              return handleKeyError(key, err, st).then(function (msg) {
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

    function handleKeyError(key, err, st) {
      var label = key.label || (DDT.PROVIDERS[key.provider] || {}).label || key.provider;
      var pauses = Object.assign({}, st.pauses);
      var disabled = Object.assign({}, st.disabled);
      var msg = '';
      log('key error', key.provider, err.kind);
      if (err.kind === 'rate') {
        var ms = err.retryAfterMs || (err.daily ? PAUSE_DAILY_MS : PAUSE_DEFAULT_MS);
        pauses[key.id] = now() + ms;
      } else if (err.kind === 'ollama_down') {
        pauses[key.id] = now() + PAUSE_DEFAULT_MS;
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
      return setSessionState({ pauses: pauses, disabled: disabled }).then(function () { return msg; });
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
        return fetchWithTimeout(u, { method: 'GET', headers: headers }, timeout).then(function (res) {
          return readBody(res).then(function (b) {
            if (!res.ok) throw classify(key, res, b);
            var j0 = b.json || {};
            if (p === 'gemini') {
              geminiModels = geminiModels.concat(j0.models || []);
              if (j0.nextPageToken && ++pages < 5) return getPage(url + '&pageToken=' + encodeURIComponent(j0.nextPageToken));
              return { res: res, b: { json: { models: geminiModels } } };
            }
            return { res: res, b: b };
          });
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
      return fetchWithTimeout(baseOf(key) + '/api/show', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model })
      }, 15000).then(function (res) {
        if (res.status === 403) return readBody(res).then(function (b) { throw classify(key, res, b); });
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
          return {
            id: k.id, provider: k.provider, label: k.label || (DDT.PROVIDERS[k.provider] || {}).label,
            tier: tierOf(k), enabled: k.enabled !== false, masked: DDT.maskKey(k.key),
            available: av.ok && k.enabled !== false, until: av.until || null, reason: av.reason || null,
            requests: u.requests, cost: u.cost, maxPerDay: keyMaxPerDay(k), configured: !!k.modelEasy
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
      return loadCache().then(function (c) {
        return { entries: Object.keys(c).length, bytes: JSON.stringify(c).length * 2 };
      });
    }
    function clearCache() {
      cacheMem = {};
      return setLocal({ cache: {} }).then(function () { return { ok: true }; });
    }
    function resetKeyState(keyId) {
      return getSessionState().then(function (st) {
        delete st.pauses[keyId];
        delete st.disabled[keyId];
        return setSessionState({ pauses: st.pauses, disabled: st.disabled });
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
            var av = keyAvailability(k, st, all.usage);
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
          return fetchWithTimeout(url, { method: 'POST', headers: { Authorization: 'Bearer ' + key.key }, body: form }, 60000)
            .then(function (res) {
              return readBody(res).then(function (b) {
                if (!res.ok) throw classify(key, res, b);
                return bumpUsage(key.id, 1, 0).then(function () {
                  return { ok: true, text: DDT.cleanTranscript(b.json && b.json.text), via: key.label || 'Groq' };
                });
              });
            }, function (e) {
              throw new ProviderError('network', DDT.sanitize(e && e.message, [key.key]));
            })
            .catch(function (err) {
              if (!(err instanceof ProviderError)) err = new ProviderError('network', DDT.sanitize(err && err.message, [key.key]));
              return handleKeyError(key, err, st).then(function (m) {
                if (err.kind === 'rate') return { ok: false, error: 'rate_limited', waitMs: err.retryAfterMs || PAUSE_DEFAULT_MS };
                return { ok: false, error: err.kind, message: m || DDT.sanitize(err.message, [key.key]).slice(0, 160) };
              });
            });
        });
      });
    }

    /* Commandes envoyées au script « voix » d'un onglet ; il est injecté à la première demande. */
    function voiceCommand(tabId, cmd, keyId) {
      function send() { return api.tabs.sendMessage(tabId, { to: 'voice', cmd: cmd, keyId: keyId || null }); }
      return send().then(function (r) {
        if (r === undefined && cmd !== 'status') throw new Error('no receiver');
        return r || { active: false };
      }).catch(function () {
        if (cmd === 'status' || cmd === 'stop') return { active: false };
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
        case 'voiceCommand': return voiceCommand(msg.tabId, msg.cmd, msg.keyId);
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
