/*
 * DevDocTrad - auto.js
 * Déclencheur automatique, injecté seulement sur les sites choisis par l'utilisateur.
 * Ne lance rien sur une page sensible ni sur une page déjà dans la langue cible.
 * Licence MIT.
 */
(function (root) {
  'use strict';
  if (root.__DDT_AUTO_DONE) return;
  root.__DDT_AUTO_DONE = true;
  var DDT = root.DDT;
  var engine = root.__DDT_ENGINE;
  if (!DDT || !engine) return;
  var api = DDT.api;

  function shouldRun(settings) {
    var info = engine.pageInfo(settings.sensitiveExtra);
    if (info.sensitive) return Promise.resolve(false);
    var target = DDT.resolveTarget(settings.target);
    if (info.lang && info.lang.slice(0, 2) === target.slice(0, 2)) return Promise.resolve(false);
    return DDT.isTextInTarget(info.sample, target).then(function (already) { return !already; });
  }

  api.runtime.sendMessage({ type: 'autoCheck', host: location.hostname }).then(function (r) {
    if (!r || !r.enabled || !r.available) return;
    engine.setSettings(r.settings);
    engine.setOnUrlChange(function () {
      var info = engine.pageInfo(r.settings.sensitiveExtra);
      if (info.sensitive) { engine.stop(); engine.showOriginal(); }
    });
    return shouldRun(r.settings).then(function (ok) {
      if (ok) engine.start({ sensitive: false });
    });
  }).catch(function () { /* extension rechargée ou page fermée */ });
})(typeof window !== 'undefined' ? window : globalThis);
