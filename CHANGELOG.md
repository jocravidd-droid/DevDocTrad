# Journal des versions / Changelog

Une mise à jour avec correctifs et améliorations est préparée tous les 15 jours (le 1er et le 16 de chaque mois).
An update with fixes and improvements is prepared every 15 days (on the 1st and 16th of each month).

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).

## [1.4.1] - 2026-11-27

### Corrigé / Fixed
- **YouTube : la transcription de la 1.4.0 échouait sur le vrai YouTube** (« Récupération des sous-titres » → « Transcription indisponible » → « Écoute de la vidéo » → « Vidéo sans sous-titres », aucune voix, sur une vidéo qui a pourtant 3 pistes). Cause, vue en vrai (Chromium 156) : la 1.4.0 cherchait l'adresse `/api/timedtext` du lecteur (avec son jeton `pot`) dans les entrées de performance, or **le vrai YouTube n'en crée aucune** pour ces requêtes ; le faux YouTube des tests en créait une et masquait le bug. Et si les sous-titres étaient déjà actifs au chargement, rien n'était cliqué : seule l'adresse nue (vide sans jeton) était essayée.
  - Désormais, dans le monde de la page, `XMLHttpRequest.prototype.open/send` et `window.fetch` sont enveloppés **une seule fois** (idempotent, réponse du lecteur intacte, seules les adresses `/api/timedtext` du même site sont regardées) pour garder l'adresse **et le corps** de la réponse que reçoit le lecteur ; l'extension arrivant après le chargement, une nouvelle demande est provoquée : sous-titres coupés puis remis s'ils étaient actifs, sinon activés (masqués) puis remis comme avant ; puis la piste choisie via l'API du lecteur (`setOption('captions', 'track', …)`), puis la même avec traduction (`tlang`, jamais en cache). Ordre de lecture : corps capturé (json3 ou XML srv1/srv3), sinon adresse du lecteur rejouée (json3), sinon adresse nue ; entrées de performance gardées en simple bonus.
  - Source de plus : la **transcription de YouTube** (`POST /youtubei/v1/get_transcript` depuis la page, même site, cookies de l'onglet, avec `?key=INNERTUBE_API_KEY&prettyPrint=false`, les en-têtes `X-Youtube-Client-Name` / `X-Youtube-Client-Version` et le contexte de `ytcfg`, les `params` de `getTranscriptEndpoint` de la page ; essai anonyme si 401/403) ; segments `transcriptSegmentRenderer` lus de façon défensive.
  - The 1.4.0 YouTube transcript failed on real YouTube: real YouTube creates no performance entries for `/api/timedtext`. The page world now wraps XHR/fetch once to capture the player's own subtitle response (URL and body), forces a fresh request (CC off/on, `setOption` track, `tlang`), replays the player's URL, then falls back to YouTube's `get_transcript` (proper key and client headers).
- **Message faux « Vidéo sans sous-titres »** quand la vidéo a des pistes qui n'ont pas pu être lues : nouveau message « Sous-titres YouTube illisibles pour l'instant : ajoute une clé Groq gratuite pour écouter le son à la place ». / No more "video without subtitles" when tracks exist but could not be read.
- **Voix incompréhensible** (« il parle pas vraiment ») sous Linux : seule voix système eSpeak NG (speech-dispatcher), vitesse montée jusqu'à 3, voix d'une autre langue possible.
  - Voix classées par qualité : « Google <langue> » d'abord, puis voix réseau ou naturelles (Microsoft … Online (Natural), Neural, Premium, Enhanced), puis voix locales correctes (Apple, Microsoft, Piper, RHVoice), **eSpeak / mbrola / pico / speech-dispatcher en dernier** ; **jamais une voix d'une autre langue** (Chrome officiel prend « Google Deutsch » comme voix par défaut : refusée pour du français) : sous-titres seuls avec un message.
  - Vitesse : calage plafonné à 1,3, vitesse finale à 1,5 (au lieu de 1,7 et 3) ; voix robotique : aucun calage, vitesse de l'utilisateur bornée à 1,15 ; une phrase qui ne tiendrait pas même à moitié dans son sous-titre est sautée plutôt qu'accélérée.
  - Voix robotique seule : avertissement **gardé dans la barre** (« Voix robotique (…) : pour une voix claire et gratuite, utilise Google Chrome ou Microsoft Edge (voix Google/Microsoft naturelles), ou installe une voix Piper ») ; aucune voix : indicateur « Pas de voix » gardé lui aussi (en doublage, le message n'est plus écrasé par les suivants) ; sous Linux avec Chrome et 0 voix : « lance Chrome avec --enable-speech-dispatcher (et installe speech-dispatcher + espeak-ng) ».
  - Unintelligible voice on Linux (eSpeak only, speed up to 3, possible wrong-language voice): voices ranked by quality (Google first, eSpeak last), never another language, final speed capped at 1.5 (1.15 and no auto-fit for robotic voices), persistent warnings in the bar.
- Réponse de transcription sans texte jamais comptée comme une réussite (`ok: true` exigé avec un texte). / A transcription answer without text is never counted as a success.

### Ajouté / Added
- **Réglages > voix traduite** : nom de la voix utilisée, bouton **Tester la voix** (phrase dans la langue cible, via le background) et choix manuel de la voix parmi celles de la langue cible (`chrome.tts.getVoices` ou `speechSynthesis` sous Firefox), réglage `voiceName`, « Automatique » par défaut. Aucune API de voix en ligne non officielle : seulement les voix du navigateur et du système, 0 €. / Settings: voice used, "Test the voice", manual voice choice (`voiceName`, Automatic by default).
- **Diagnostic** dans le statut de la voix (`diag` : sources essayées et leur résultat, `sentences`, `voiceTier`, `voiceWarn`, `noVoice`) et **`tools/yt_probe.js`** (Playwright, jamais en CI) : charge `dist/chrome` dans un Chromium visible (`FLAGS=--enable-speech-dispatcher`, `PROFILE=…`, `CHANNEL=chrome`), ouvre une vidéo YouTube, lance la voix et affiche toutes les 2 s mode, message, sources, phrases et appels `chrome.tts`. / Voice status diagnostics and a manual real-YouTube probe script.
- 11 nouveaux textes d'interface dans les 36 langues ; tests : crochets XHR/fetch, corps json3 et XML, CC déjà actif, piste en cache (`setOption` + `tlang`), `get_transcript` (en-têtes, clé, params, 401 → anonyme), messages distincts, classement des voix, plafonds de vitesse, refus d'une autre langue, avertissement eSpeak, aide Linux, choix manuel et bouton Tester ; `tools/e2e_voice.js` : faux YouTube **réaliste** (requêtes du lecteur en XHR, aucune entrée de performance, CC déjà actif, adresse nue vide, `setOption`, vidéo où seule `get_transcript` répond).

### Confidentialité / Privacy
- `PRIVACY.md` : sur YouTube, l'extension relit la réponse que le lecteur reçoit déjà et peut demander à YouTube la transcription de la vidéo (`get_transcript`, depuis l'onglet). Aucune nouvelle permission, aucune donnée ailleurs. / The extension reads the subtitle response YouTube's player already receives and may ask YouTube for the transcript; no new permission.

## [1.4.0] - 2026-11-27

### Corrigé / Fixed
- **YouTube : la voix traduite « ne marchait pas »** (fragments coupés, retard, voix hachée, ou rien du tout). Cause : la 1.3 lisait le texte des sous-titres affiché à l'écran toutes les 200 ms ; les sous-titres automatiques défilent mot à mot, chaque morceau était traduit et dit séparément, en retard, et si YouTube changeait ses classes ou n'affichait rien, il ne se passait rien. / YouTube voice translation was choppy, late or silent: 1.3 read the on-screen captions, which scroll word by word.

### Ajouté / Added
- **YouTube : transcription entière, traduite d'avance, calée sur la vidéo.** Quand la voix des vidéos est lancée sur YouTube :
  - le background lance une petite fonction fixe du paquet dans la page (`scripting.executeScript`, `world: 'MAIN'`, aucune nouvelle permission : celle donnée pour lancer la voix suffit) qui lit `movie_player.getPlayerResponse()` : pistes de sous-titres (langue, automatique ou non, traduisible), langues de traduction de YouTube, langue du son ;
  - YouTube exige désormais un jeton `pot` sur `/api/timedtext` : l'adresse demandée par le lecteur lui-même est relue dans les entrées de performance (`performance.getEntriesByType('resource')` + `PerformanceObserver`) ; si le lecteur n'a encore rien demandé, les sous-titres sont activés (masqués) le temps qu'il le fasse, puis remis comme avant ; essais dans l'ordre : piste choisie + jeton, adresse du lecteur, adresse nue ; aucune `webRequest` ;
  - piste choisie : écrite à la main dans la langue cible (traduction humaine), sinon écrite à la main dans la langue parlée, sinon automatique ; fichier `json3` (ou XML) relu en entier, mots horodatés regroupés en phrases (ponctuation, silences, 12 s au plus) ;
  - traduction d'avance : **par YouTube lui-même** (`tlang`, gratuit) quand il propose la langue cible, sinon par le fournisseur choisi, par lots, 2 min 30 devant la lecture, avec la mémoire habituelle ;
  - chaque phrase est affichée et dite à son heure (`video.currentTime`, `timeupdate` + minuteur), vitesse calée sur le temps qui reste (calage × vitesse choisie, vitesse de lecture de la vidéo comprise) ; pause, saut, vitesse, publicités (`ad-showing`) et vidéo suivante (navigation interne) suivis ; son d'origine baissé pendant la voix comme avant.
  - Replis, dans l'ordre : lecture du texte affiché à l'écran (ancien mode, message « Transcription YouTube indisponible ») ; vidéo sans aucun sous-titre : écoute du son (Groq Whisper) ; sans clé Groq : « Pas de sous-titres sur cette vidéo : il faut une clé Groq gratuite pour écouter le son » avec un bouton **Ouvrir les réglages**.
  - Idées reprises de l'extension AutoDub (API publiques de YouTube), réimplémentées sans aucun code copié ; tout reste gratuit (voix du navigateur, traduction par YouTube ou par ta clé gratuite).
  - YouTube: the whole subtitle track is read from the player (`getPlayerResponse`, `pot` token taken from the player's own request seen in performance entries), merged into sentences, translated ahead (by YouTube's free `tlang` when your language is offered, otherwise by your provider), then shown and spoken at each sentence's time on `video.currentTime` (pause, seek, speed, ads, next video). Fallbacks: on-screen captions, then audio via Groq Whisper (with an "Open settings" button when the Groq key is missing). Ideas from AutoDub, reimplemented, no code copied.
- 6 nouveaux textes d'interface dans les 36 langues ; nouveaux messages `ytPlayer` et `openOptions` acceptés depuis le script de la voix (`isTrustedSender`), `ytPlayer` limité aux onglets YouTube et à `/api/timedtext` du même site ; 18 nouveaux tests (`tests/voice-youtube.test.js` : faux lecteur, fausses entrées de performance, json3, phrases, programmation, saut, pause, vitesse, `tlang` contre fournisseur, publicités, vidéo suivante, replis) ; `tools/e2e_voice.js` : faux YouTube servi localement dans un vrai Chromium (vraie injection dans le monde de la page, jeton `pot`, voix via `chrome.tts` espionné).

### Confidentialité / Privacy
- `PRIVACY.md` : sur YouTube, les sous-titres (et leur traduction par YouTube) sont demandés à YouTube depuis l'onglet de la vidéo, comme le fait son lecteur ; aucune donnée nouvelle ne part ailleurs. Aucune nouvelle permission. / YouTube subtitles are requested from YouTube itself; no new permission, no new data flow.

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
