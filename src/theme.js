/* DevDocTrad - applique le thème avant l'affichage (évite le flash clair/sombre). Licence MIT. */
(function () {
  var t = 'system';
  try { t = localStorage.getItem('ddt-theme') || 'system'; } catch (e) { /* stockage bloqué */ }
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
})();
