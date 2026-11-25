/* DevDocTrad - site : propose la page dans la langue du navigateur (sans redirection forcée). Licence MIT. */
(function () {
  'use strict';
  var L = {"fr": {"p": "/", "h": "fr", "n": "Français", "d": "ltr", "s": "Voir ce site en français", "x": "Fermer"}, "en": {"p": "/en/", "h": "en", "n": "English", "d": "ltr", "s": "View this site in English", "x": "Close"}, "es": {"p": "/es/", "h": "es", "n": "Español", "d": "ltr", "s": "Ver este sitio en español", "x": "Cerrar"}, "de": {"p": "/de/", "h": "de", "n": "Deutsch", "d": "ltr", "s": "Diese Website auf Deutsch ansehen", "x": "Schließen"}, "it": {"p": "/it/", "h": "it", "n": "Italiano", "d": "ltr", "s": "Vedi questo sito in italiano", "x": "Chiudi"}, "pt": {"p": "/pt/", "h": "pt-PT", "n": "Português (Portugal)", "d": "ltr", "s": "Ver este site em português (Portugal)", "x": "Fechar"}, "pt-BR": {"p": "/pt-br/", "h": "pt-BR", "n": "Português (Brasil)", "d": "ltr", "s": "Ver este site em português do Brasil", "x": "Fechar"}, "nl": {"p": "/nl/", "h": "nl", "n": "Nederlands", "d": "ltr", "s": "Bekijk deze site in het Nederlands", "x": "Sluiten"}, "pl": {"p": "/pl/", "h": "pl", "n": "Polski", "d": "ltr", "s": "Zobacz tę stronę po polsku", "x": "Zamknij"}, "ru": {"p": "/ru/", "h": "ru", "n": "Русский", "d": "ltr", "s": "Открыть сайт на русском", "x": "Закрыть"}, "uk": {"p": "/uk/", "h": "uk", "n": "Українська", "d": "ltr", "s": "Відкрити сайт українською", "x": "Закрити"}, "cs": {"p": "/cs/", "h": "cs", "n": "Čeština", "d": "ltr", "s": "Zobrazit tento web česky", "x": "Zavřít"}, "sk": {"p": "/sk/", "h": "sk", "n": "Slovenčina", "d": "ltr", "s": "Zobraziť tento web po slovensky", "x": "Zavrieť"}, "ro": {"p": "/ro/", "h": "ro", "n": "Română", "d": "ltr", "s": "Vezi acest site în română", "x": "Închide"}, "hu": {"p": "/hu/", "h": "hu", "n": "Magyar", "d": "ltr", "s": "Az oldal megtekintése magyarul", "x": "Bezárás"}, "bg": {"p": "/bg/", "h": "bg", "n": "Български", "d": "ltr", "s": "Виж сайта на български", "x": "Затвори"}, "el": {"p": "/el/", "h": "el", "n": "Ελληνικά", "d": "ltr", "s": "Δες τον ιστότοπο στα ελληνικά", "x": "Κλείσιμο"}, "sv": {"p": "/sv/", "h": "sv", "n": "Svenska", "d": "ltr", "s": "Visa webbplatsen på svenska", "x": "Stäng"}, "da": {"p": "/da/", "h": "da", "n": "Dansk", "d": "ltr", "s": "Se siden på dansk", "x": "Luk"}, "no": {"p": "/no/", "h": "no", "n": "Norsk", "d": "ltr", "s": "Se nettstedet på norsk", "x": "Lukk"}, "fi": {"p": "/fi/", "h": "fi", "n": "Suomi", "d": "ltr", "s": "Näytä sivusto suomeksi", "x": "Sulje"}, "tr": {"p": "/tr/", "h": "tr", "n": "Türkçe", "d": "ltr", "s": "Bu siteyi Türkçe gör", "x": "Kapat"}, "ar": {"p": "/ar/", "h": "ar", "n": "العربية", "d": "rtl", "s": "اعرض هذا الموقع بالعربية", "x": "إغلاق"}, "he": {"p": "/he/", "h": "he", "n": "עברית", "d": "rtl", "s": "הצגת האתר בעברית", "x": "סגירה"}, "fa": {"p": "/fa/", "h": "fa", "n": "فارسی", "d": "rtl", "s": "دیدن این سایت به فارسی", "x": "بستن"}, "hi": {"p": "/hi/", "h": "hi", "n": "हिन्दी", "d": "ltr", "s": "यह साइट हिन्दी में देखें", "x": "बंद करें"}, "bn": {"p": "/bn/", "h": "bn", "n": "বাংলা", "d": "ltr", "s": "এই সাইটটি বাংলায় দেখুন", "x": "বন্ধ করুন"}, "ur": {"p": "/ur/", "h": "ur", "n": "اردو", "d": "rtl", "s": "یہ سائٹ اردو میں دیکھیں", "x": "بند کریں"}, "id": {"p": "/id/", "h": "id", "n": "Bahasa Indonesia", "d": "ltr", "s": "Lihat situs ini dalam bahasa Indonesia", "x": "Tutup"}, "ms": {"p": "/ms/", "h": "ms", "n": "Bahasa Melayu", "d": "ltr", "s": "Lihat laman ini dalam bahasa Melayu", "x": "Tutup"}, "vi": {"p": "/vi/", "h": "vi", "n": "Tiếng Việt", "d": "ltr", "s": "Xem trang này bằng tiếng Việt", "x": "Đóng"}, "th": {"p": "/th/", "h": "th", "n": "ไทย", "d": "ltr", "s": "ดูเว็บไซต์นี้เป็นภาษาไทย", "x": "ปิด"}, "zh": {"p": "/zh/", "h": "zh-CN", "n": "简体中文", "d": "ltr", "s": "查看简体中文版网站", "x": "关闭"}, "zh-TW": {"p": "/zh-tw/", "h": "zh-TW", "n": "繁體中文", "d": "ltr", "s": "查看繁體中文版網站", "x": "關閉"}, "ja": {"p": "/ja/", "h": "ja", "n": "日本語", "d": "ltr", "s": "このサイトを日本語で見る", "x": "閉じる"}, "ko": {"p": "/ko/", "h": "ko", "n": "한국어", "d": "ltr", "s": "이 사이트를 한국어로 보기", "x": "닫기"}, "sw": {"p": "/sw/", "h": "sw", "n": "Kiswahili", "d": "ltr", "s": "Tazama tovuti hii kwa Kiswahili", "x": "Funga"}};
  var KEY = 'ddt-site-lang-dismissed';
  function match(pref) {
    var p = String(pref || '').toLowerCase();
    if (/^zh-(tw|hk|mo|hant)/.test(p)) return 'zh-TW';
    if (/^zh/.test(p)) return 'zh';
    if (/^pt-br/.test(p)) return 'pt-BR';
    if (/^pt/.test(p)) return 'pt';
    if (/^(nb|nn|no)\b/.test(p)) return 'no';
    var two = p.slice(0, 2);
    return L[two] ? two : null;
  }
  var cur = null;
  var lang = (document.documentElement.lang || '').toLowerCase();
  Object.keys(L).forEach(function (c) { if (L[c].h.toLowerCase() === lang) cur = c; });
  var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
  var want = null;
  for (var i = 0; i < prefs.length && !want; i++) want = match(prefs[i]);
  if (!want || want === cur) return;
  try { if (localStorage.getItem(KEY) === want) return; } catch (e) { /* stockage bloqué */ }
  var w = L[want];
  var bar = document.createElement('div');
  bar.className = 'langbar glass';
  bar.setAttribute('role', 'region');
  bar.lang = w.h;
  bar.dir = w.d;
  var a = document.createElement('a');
  a.href = w.p;
  a.hreflang = w.h;
  a.textContent = w.s;
  var x = document.createElement('button');
  x.type = 'button';
  x.setAttribute('aria-label', w.x);
  x.title = w.x;
  x.textContent = '\u00d7';
  x.addEventListener('click', function () {
    try { localStorage.setItem(KEY, want); } catch (e) { /* rien */ }
    bar.remove();
  });
  bar.appendChild(a);
  bar.appendChild(x);
  document.body.appendChild(bar);
})();
