# Journal des versions / Changelog

Une mise à jour avec correctifs et améliorations est préparée tous les 15 jours (le 1er et le 16 de chaque mois).
An update with fixes and improvements is prepared every 15 days (on the 1st and 16th of each month).

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).

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
