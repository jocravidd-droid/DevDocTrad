# Journal des versions / Changelog

Une mise à jour avec correctifs et améliorations est préparée tous les 15 jours (le 1er et le 16 de chaque mois).
An update with fixes and improvements is prepared every 15 days (on the 1st and 16th of each month).

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).

## [1.3.0] - 2026-11-27

### Corrigé / Fixed
- **La voix traduite (doublage) restait muette** sous Chrome, Edge et Brave. Cause : la voix était produite par `speechSynthesis` dans la page, et Chrome refuse `speechSynthesis.speak()` (erreur `not-allowed`) tant que la page n'a reçu aucun clic ; le clic dans le popup ne compte pas pour la page. Reproduit dans un vrai Chromium (`tools/e2e_voice.js`, vérification « cause (1.2) »). Désormais **c'est l'extension qui parle** : message `speak` / `stopSpeaking` / `ttsVoices` de `voice.js` au background, qui utilise `chrome.tts` (permission `tts`, Chrome seulement, sans avertissement à l'installation ; voix choisie avec `chrome.tts.getVoices`, même ordre de préférence ; phrases mises en file d'attente ; fin de phrase renvoyée à la page pour remonter le son d'origine). Firefox (pas de `browser.tts`) : `speechSynthesis` de la page de fond, que Gecko ne bloque pas faute de clic. Repli sur la synthèse de la page si l'extension ne peut pas parler, avec le message « Clique une fois dans la page » et la phrase redite au premier clic. Garde-fous : texte ≤ 1000 caractères, vitesse bornée, langue vérifiée, une fin de phrase perdue ne laisse jamais le son baissé.
  - The dubbing voice was silent in Chrome/Edge/Brave: Chrome blocks `speechSynthesis.speak()` in a page that has not been clicked (`not-allowed`), and the popup click does not count. The extension now speaks itself (`chrome.tts` in the background; background-page `speechSynthesis` in Firefox), with a page fallback.
- Bande de la vidéo construite élément par élément (`createElement` / `createElementNS`) : plus d'`innerHTML` dans `voice.js` (signalé par le validateur Mozilla `addons-linter`, UNSAFE_VAR_ASSIGNMENT). / No more `innerHTML` in `voice.js`.

### Ajouté / Added
- **Voix traduite seule** : dans le popup, sous « Traduire la voix des vidéos », trois choix : **Sous-titres**, **Sous-titres + voix traduite**, **Voix traduite seule (sans sous-titres)**. En voix seule, la bande ne montre plus de texte, seulement sa barre (message, haut-parleur, vitesse, fermer) ; sans voix disponible (ou haut-parleur coupé), les sous-titres reviennent. Réglage `voiceMode` (`subs` | `dub` | `voice`), l'ancien booléen `voiceDub` est repris à la mise à jour. / "Translated voice only" mode.
- **Vitesse de la voix** : réglage `voiceRate` (0,5× à 2×, pas de 0,1, 1× par défaut), curseur dans Réglages > Traduction et boutons − / + (avec la valeur, ex. « 1,2× ») dans la barre de la bande, appliqués dès la phrase suivante (y compris un changement fait dans les réglages pendant la lecture). Le calage automatique sur la durée du sous-titre est multiplié par ce réglage puis borné entre 0,5 et 3. / Voice speed setting and −/+ buttons.
- 6 nouveaux textes d'interface dans les 36 langues ; 16 nouveaux tests unitaires (chrome.tts et page de fond Firefox simulés, voix seule, vitesse, repli, migration) ; `tools/e2e_voice.js` : espions à la place de `chrome.tts.speak` / `stop` / `getVoices` dans le service worker d'un vrai Chromium (texte, langue, voix, vitesse, son baissé puis remonté sur « end », voix seule, boutons − / +) ; `tools/e2e_firefox.js` : espion de la synthèse de la page de fond Firefox.

## [1.2.0] - 2026-11-26

### Ajouté / Added
- **Doublage des vidéos, gratuit** (comme AutoDub, mais sur n'importe quelle vidéo) : dans le popup, sous « Traduire la voix des vidéos », choix **Sous-titres** / **Sous-titres + voix traduite (doublage)** (réglage `voiceDub`, sous-titres par défaut ; le bouton haut-parleur de la bande bascule à tout moment). Voix de synthèse du navigateur uniquement (`speechSynthesis`), aucun service payant :
  - meilleure voix pour la langue cible (langue exacte, puis voix « Natural », « Neural », « Online », « Google », « Premium », « Enhanced », puis langue seule ; attente de `voiceschanged`) ;
  - voix calée sur la vidéo : dite au début de chaque sous-titre, vitesse adaptée (0,9 à 1,7) à la durée du sous-titre et à la longueur du texte ; phrase précédente pas finie : la suivante accélère, au-delà de 2 s de retard elle est coupée ;
  - pause de la vidéo = voix coupée, reprise au sous-titre affiché ; saut dans la vidéo = la voix repart au bon sous-titre ;
  - son d'origine baissé à environ 15 % pendant que la voix parle et remonté en douceur entre les phrases, volume d'origine rendu à l'arrêt ;
  - aucune voix pour la langue cible : message clair, sous-titres seuls ; voix refusée faute de clic sur la page : message pour débloquer.
  - Free video dubbing on any video with the browser's speech synthesis: best voice for the target language, timed to subtitles (rate 0.9–1.7), pause/seek aware, original sound ducked to ~15%.
- **Partout** : vidéos et sons cherchés aussi dans les shadow roots ouverts (lecteurs en composants web) ; éléments `<audio>` (podcasts) pris en charge, bande en bas de la fenêtre ; plusieurs vidéos : celle qui joue, sinon la plus grande visible.
  - Media found inside open shadow roots, `<audio>` support, smarter choice between several videos.
- **Lecteurs intégrés d'un autre site** (`<iframe>` YouTube, Vimeo, Dailymotion, Wistia, Loom, Twitch, Brightcove, etc.) : message clair et bouton **Ouvrir la vidéo dans un onglet** (YouTube : page de la vidéo, avec ses sous-titres).
  - Embedded players from other sites: clear message and an "Open the video in a tab" button.
- 7 nouveaux textes d'interface traduits dans les 36 langues ; 17 nouveaux tests (`tests/voice.test.js`, `tests/popup.test.js`) et 5 vérifications du doublage dans `tools/e2e_voice.js` (fausse synthèse vocale injectée, Chromium sans tête n'a aucune voix).

- **Fichiers texte et Markdown bruts** (README « raw » de GitHub, `.txt`, `.md`) : affichés lisiblement (titres, listes, liens) et traduits, le code reste intact ; avant : « rien à traduire ». / Raw text and Markdown files are now readable and translated.
- **Nom plus facile à trouver** dans les boutiques, avec les mots les plus cherchés, dans les 36 langues (« DevDocTrad : Traducteur de docs, code et vidéos »). / Keyword-rich extension name.
- **Site** : démos interactives (Original / Traduction / Bilingue, voix des vidéos), thème clair/sombre, vidéo de présentation, images d'exemple agrandies avec plein écran, bouton Firefox vers addons.mozilla.org. / Interactive website.
- Tests : test de bout en bout dans un vrai Firefox (`tools/e2e_firefox.js`, aussi sur GitHub Actions) ; tests du popup, des réglages, des frameworks, des pages difficiles.

### Corrigé / Fixed
- **Firefox** : la voix d'une vidéo sans sous-titres n'était jamais envoyée (blocage de sécurité de Firefox sur le son enregistré) ; silence détecté à tort quand le contexte audio de la page était suspendu.
- **Firefox et Chrome, pages « qui ne marchent pas »** : sites où le navigateur interdit toute extension (addons.mozilla.org, support.mozilla.org, boutiques) et PDF : message clair dans le popup et « ! » sur l'icône au lieu de ne rien faire.
- **Sites React, Vue, Next, Docusaurus…** : le texte est modifié sur place, plus aucun nœud de la page n'est retiré (pages qui pouvaient casser) ; « Arrêter » respecté ; contenu chargé plus tard traduit ; titre et mémoire corrects en navigation SPA ; grosses pages plus rapides.
- **Clés payantes** : le plafond de dépense pouvait être dépassé (jusqu'à 7,5 fois) ; coût réservé avant chaque appel, usage réel compté. Rafales de requêtes sur réponse mal formée bornées ; plusieurs onglets sérialisés ; cache par entrée (plus de relecture de 20 Mo) ; pages sensibles jamais mises en cache ; messages des pages web filtrés.
- **Interface** : faux coins (feuille du logo) supprimés dans le popup et les réglages ; popup toujours ≤ 600 px dans les 36 langues ; contraste du bouton principal et des étiquettes d'état ; réglages bornés (un prix négatif ne désactive plus le plafond) ; suppression de clé enregistrée tout de suite ; accessibilité.

### Modifié / Changed
- Lecture à voix haute : le son de la vidéo n'est plus baissé en continu (25 %) mais seulement pendant que la voix parle (15 %).
- Vidéo protégée par DRM (`mediaKeys`) : message `voiceNoAudio` tout de suite, sans tenter de capturer le son.

### Confidentialité / Privacy
- `PRIVACY.md` : la voix du doublage est générée par le navigateur ; DevDocTrad n'envoie rien à un service de voix. Aucune nouvelle permission.

## [1.1.0] - 2026-11-25

### Ajouté / Added
- **Traduction de la voix des vidéos** (popup : « Traduire la voix des vidéos », raccourci **Alt+Maj+V**), gratuite :
  - sous-titres de la vidéo (pistes `<track>` HTML5) traduits à l'avance et affichés sur l'image ;
  - sous-titres YouTube activés automatiquement, masqués et remplacés par leur traduction ;
  - vidéo sans sous-titres : le son est découpé en morceaux de 8 s et transcrit par **Groq Whisper** (`whisper-large-v3-turbo`, palier gratuit, clé Groq gratuite uniquement, jamais une clé payante), puis traduit ; les morceaux silencieux et les « hallucinations » connues de Whisper sont écartés ;
  - mode bilingue (original au-dessus de la traduction), plein écran, bouton **lecture à voix haute** (synthèse vocale du navigateur, le son de la vidéo est baissé pendant la lecture).
  - Video voice translation (popup switch, **Alt+Shift+V**), free: subtitles translated live on the video, YouTube captions, Groq Whisper transcription for videos without subtitles, optional read-aloud.
- **Site en 37 langues** (toutes les langues de traduction de l'extension), arabe, hébreu, persan et ourdou de droite à gauche, menu des langues, bandeau qui propose la langue du navigateur, `hreflang` et sitemap complets. Généré par `tools/build_site.py`.
  - Website in 37 languages with language menu, browser-language suggestion, full hreflang and sitemap.
- 13 nouveaux textes d'interface traduits dans les 36 langues de l'extension.
- Tests : `tests/voice.test.js` (27 tests), `tests/site.test.js` (81 tests), `tests/release.test.js`, test de bout en bout `tools/e2e_voice.js` (vrai Chromium, vidéo de démo).
- Intégration continue GitHub Actions (tests à chaque envoi) et publication automatique d'une version GitHub à chaque étiquette `v*`.

### Corrigé / Fixed
- Test de bout en bout : la vérification « clé masquée » suivait l'ancien champ `password` ; Chromium utilise maintenant un champ texte masqué par CSS (pour éviter les gestionnaires de mots de passe).

### Confidentialité / Privacy
- `PRIVACY.md` : explique ce qui part chez Groq quand la voix est traduite (courts morceaux de son, seulement pour une vidéo sans sous-titres). Aucune nouvelle permission demandée.

## [1.0.0] - 2026-11-25

Première version : traduction fidèle des pages techniques sans toucher au code, Chrome/Edge/Brave/Firefox, Gemini, Groq, Mistral, OpenRouter, Ollama, interface en 36 langues, mode bilingue, glossaire, traduction automatique par site.
First release.
