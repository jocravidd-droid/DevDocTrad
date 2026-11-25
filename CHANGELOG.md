# Journal des versions / Changelog

Une mise à jour avec correctifs et améliorations est préparée tous les 15 jours (le 1er et le 16 de chaque mois).
An update with fixes and improvements is prepared every 15 days (on the 1st and 16th of each month).

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).

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
