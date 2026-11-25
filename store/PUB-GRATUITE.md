# Faire connaître DevDocTrad à 0 €

Tout ce qui suit est gratuit. Rien n'est publié automatiquement : les comptes sont les tiens, et une publication faite en ton nom doit venir de toi. Ce document te dit **où**, **quoi** et **dans quel ordre** ; les textes sont prêts à copier.

Textes prêts à publier :
- [`annonces.md`](annonces.md) : textes longs en français et en anglais (Reddit, developpez.com, dev.to, Hacker News, AlternativeTo, liste « awesome ») ;
- [`annonces-langues.md`](annonces-langues.md) : messages courts dans 14 langues pour les communautés de chaque pays ;
- [`edge-addons.md`](edge-addons.md) : publication **gratuite** sur la boutique Microsoft Edge.

Images prêtes : `store/social-preview-1280x640.png` (aperçu GitHub et réseaux), `docs/assets/og-image.png` (aperçu du site, déjà branché), `store/promo-1400x560.png`, `store/promo-440x280.png`, `store/screenshots/` (dont `screenshot-5-voix.png`, la voix des vidéos).

---

## Étape 1 (jour 1, 20 minutes) : rendre le dépôt GitHub trouvable

1. Ouvre https://github.com/jocravidd-droid/DevDocTrad, clique sur la roue dentée à côté de **About** (à droite).
2. **Description** (copie-colle) :
   ```text
   Free browser extension that faithfully translates developer docs and video voice into 37 languages, without ever touching the code. Chrome, Edge, Brave, Firefox.
   ```
3. **Website** : `https://devdoctrad.vercel.app/`
4. **Topics** (un par un) : `browser-extension`, `chrome-extension`, `firefox-addon`, `translation`, `translator`, `documentation`, `developer-tools`, `i18n`, `llm`, `gemini`, `groq`, `ollama`, `whisper`, `subtitles`, `open-source`
5. Coche **Releases** et décoche **Packages** si tu ne t'en sers pas. Enregistre.
6. **Settings** > **General** > **Social preview** > **Edit** > envoie `store/social-preview-1280x640.png`. C'est l'image qui s'affiche quand quelqu'un partage le lien du dépôt.
7. Dans l'onglet **Releases**, une version GitHub est créée automatiquement à chaque étiquette `v1.x.y` (voir « Mises à jour » plus bas). Les personnes qui « watch » le dépôt sont prévenues.

## Étape 2 (jour 1, 15 minutes) : moteurs de recherche

Le site existe maintenant en 37 langues, avec `hreflang` : chaque langue peut sortir dans les résultats de son pays.

1. **Google Search Console** (gratuit) : https://search.google.com/search-console > Ajouter une propriété > **Préfixe de l'URL** > `https://devdoctrad.vercel.app/`. Vérifie avec la balise HTML proposée (envoie-la moi, je l'ajoute au site), puis menu **Sitemaps** > `sitemap.xml` > Envoyer.
2. **Bing Webmaster Tools** (gratuit, alimente aussi DuckDuckGo, Yahoo, Ecosia et ChatGPT Search) : https://www.bing.com/webmasters > **Importer depuis Google Search Console** (le plus rapide).
3. **IndexNow** est inclus dans Bing : rien d'autre à faire.

## Étape 3 (semaine 1) : boutiques d'extensions gratuites

| Boutique | Prix | Guide |
|---|---|---|
| Firefox (addons.mozilla.org) | gratuit | [`addons-mozilla-org.md`](addons-mozilla-org.md) |
| Microsoft Edge Add-ons | **gratuit** | [`edge-addons.md`](edge-addons.md) |
| Chrome Web Store | 5 $ une fois (pas 0 €) | [`chrome-web-store.md`](chrome-web-store.md), à faire seulement si tu le décides |

Une fiche en boutique est la meilleure publicité gratuite : les gens y cherchent « translate documentation », « traduction développeur », etc. La boutique Edge ne sert qu'aux utilisateurs d'Edge, mais ils sont des centaines de millions, et Firefox ajoute sa propre communauté : deux boutiques gratuites, c'est déjà beaucoup. Chrome et Brave continuent d'installer le zip à la main en attendant.

## Étape 4 (semaines 1 à 4) : communautés, une par jour

Règle d'or : **un message par communauté, jamais deux**, toujours dire que tu es l'auteur, lire les règles avant (certaines interdisent l'autopromotion sauf un jour par semaine), et répondre aux commentaires dans les heures qui suivent.

### Semaine 1 — francophone (ta langue, le plus facile)
| Jour | Où | Texte |
|---|---|---|
| Lundi | Reddit r/programmation | `annonces.md` §1 |
| Mardi | Forum developpez.com, rubrique « Vos contributions » | `annonces.md` §3 |
| Mercredi | LinuxFr.org, « Journal » (accepte les projets libres) | `annonces.md` §3 raccourci |
| Jeudi | Journal du hacker (journalduhacker.net), lien vers le site | titre de `annonces.md` §1 |
| Vendredi | Reddit r/france (mardi « Tech » seulement, lire les règles) ou r/developpeurs | `annonces.md` §1 |

### Semaine 2 — anglophone (le plus gros public)
| Jour | Où | Texte |
|---|---|---|
| Lundi | dev.to (article) | `annonces.md` §4 |
| Mardi (14 h à 16 h, heure de Paris) | Hacker News, « Show HN » | `annonces.md` §5 |
| Mercredi | Reddit r/chrome_extensions, r/firefox (lire les règles) | `annonces.md` §2 adapté |
| Jeudi | AlternativeTo (fiche, alternative à Google Translate, DeepL, Immersive Translate) | `annonces.md` §6 |
| Vendredi | Product Hunt (gratuit ; publier un mardi ou mercredi à 9 h heure de Paris donne plus de visibilité) | description de `annonces.md` §6 |

### Semaine 3 — les autres langues (le gros avantage de DevDocTrad)
Les développeurs qui ne lisent pas bien l'anglais sont exactement ceux qui en ont besoin. Un message par pays avec `annonces-langues.md` :

| Langue | Où (gratuit) |
|---|---|
| Espagnol | Reddit r/programacion, r/devsarg ; foro de Platzi |
| Portugais (Brésil) | TabNews (tabnews.com.br), Reddit r/brdev |
| Allemand | Reddit r/de_EDV, r/programmieren |
| Italien | Reddit r/ItalyInformatica |
| Russe | Habr (article court dans le hub « Я пиарюсь »), Telegram : canaux de développeurs qui acceptent les annonces |
| Ukrainien | DOU.ua (forum) |
| Polonais | Reddit r/programowanie, 4programmers.net |
| Japonais | Zenn ou Qiita (article court), X avec #個人開発 |
| Chinois | V2EX (节点 « 分享创造 »), 掘金 Juejin |
| Coréen | OKKY (okky.kr), GeekNews (news.hada.io) |
| Turc | Reddit r/CodingTR |
| Vietnamien | Viblo (viblo.asia) |
| Indonésien | Reddit r/indonesia (flair Tech), Dev.to tag #indonesia |
| Arabe | Reddit r/arabs (Tech), Hsoub I/O (io.hsoub.com) |

### Semaine 4 — réseaux et listes
| Où | Quoi |
|---|---|
| Mastodon (fosstodon.org) et Bluesky | message court + `screenshot-5-voix.png` + #opensource #webdev #i18n |
| LinkedIn | message court en français + capture |
| Listes « awesome » sur GitHub | une pull request par liste, texte `annonces.md` §7 ; exemples : `awesome-browser-extensions-for-github`, `awesome-i18n`, `awesome-firefox`, `awesome-chrome-extensions`. Lire le `CONTRIBUTING.md` de chaque liste avant. |
| YouTube Shorts / TikTok | 30 s d'écran : une doc anglaise → clic → la même page en français, le code intact ; puis une vidéo YouTube sous-titrée en direct. L'outil d'enregistrement gratuit : OBS Studio. |

## Étape 5 (tout le temps) : ce qui fait revenir les gens

- **Répondre à chaque issue GitHub** sous 48 h, même pour dire « bien reçu ».
- **Une mise à jour tous les 15 jours** (déjà programmée) : chaque version GitHub et chaque mise à jour en boutique fait remonter l'extension. Quand une version ajoute quelque chose de visible, refais un message court sur Mastodon/Bluesky/LinkedIn (pas sur Reddit ni Hacker News).
- **Demander un avis** : dans le README et sur le site, une phrase « si l'extension t'aide, une étoile sur GitHub ou un avis sur la boutique aide les autres à la trouver ». Ne jamais acheter d'étoiles ni d'avis, ne jamais en demander en échange de quelque chose.

## Ce qu'il ne faut pas faire (ça coûte la réputation, et parfois un bannissement)
- poster le même message dans 10 communautés le même jour ;
- créer de faux comptes, demander des votes, acheter des étoiles ;
- envoyer des messages privés non sollicités ;
- promettre une fonction qui n'existe pas encore.
