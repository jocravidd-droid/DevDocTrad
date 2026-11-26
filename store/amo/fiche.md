# Fiche addons.mozilla.org : textes à copier-coller

Tous les champs de la fiche DevDocTrad sur AMO, en anglais (**en-US**, langue par défaut de la fiche) et en français (**fr**). Le guide clic par clic est dans [`README.md`](README.md).

Astuce : sur GitHub, chaque bloc gris a un bouton de copie en haut à droite. Copie le bloc entier et colle-le tel quel.

Sommaire :

1. Nom
2. Résumé (Summary)
3. Description
4. Légendes des captures
5. Catégories et tags
6. Liens, licence, options
7. Politique de confidentialité
8. Notes pour les relecteurs (Notes to Reviewer)
9. Notes de version 1.2.0 (Release notes)

---

## 1. Nom (Name) : 50 caractères maximum

Le même que `extName` dans `src/_locales/en/messages.json` et `src/_locales/fr/messages.json`.

**en-US** (46 caractères) :

```text
DevDocTrad: Translator for Docs, Code & Videos
```

**fr** (47 caractères) :

```text
DevDocTrad : Traducteur de docs, code et vidéos
```

## 2. Résumé (Summary) : 250 caractères maximum

**en-US** (234 caractères) :

```text
Faithfully translates developer docs and programming sites without ever touching the code, and turns video voices into translated subtitles. Free and open source: your own free keys (Gemini, Groq, Mistral, OpenRouter) or local Ollama.
```

**fr** (231 caractères) :

```text
Traduit fidèlement la doc technique et les sites pour programmeurs sans toucher au code, et la voix des vidéos en sous-titres. Gratuite et open source, avec tes clés gratuites (Gemini, Groq, Mistral, OpenRouter) ou Ollama en local.
```

## 3. Description

AMO accepte un Markdown limité : `**gras**`, listes avec `-` ou `1.`, liens. Colle le bloc tel quel ; vérifie l’aperçu après l’enregistrement.

### 3.1 Description en-US

```text
**Faithfully translates developer documentation and programming websites, without ever touching the code.** And now the voice of videos, as translated subtitles.

DevDocTrad is for anyone reading documentation in a language they are not comfortable with: official docs, GitHub READMEs and issues, Stack Overflow, forums, technical blogs, framework sites, video tutorials.

**What it does**

- Faithful translation, sentence by sentence, in the same order: no summary, no omission, no addition.
- Code is never translated: commands, function names, APIs, paths and URLs stay exactly as they are.
- Links, bold text and code elements stay in place.
- Target language: your browser language by default (37 languages available), changeable in the settings.
- Two display modes: replace the text, or bilingual mode with the translation under each sentence.
- One click, or Alt+Shift+T, brings back the exact original.
- Automatic translation on the sites you choose. Firefox asks for permission one site at a time.
- Personal glossary: terms to never translate, or to always translate the same way.
- Raw README and .txt files are translated too (readable view, code intact).
- Interface in 36 languages (Arabic, Hebrew and Persian right to left), light and dark themes.

**Video voice, translated (new in 1.1)**

- Turn on "Translate the voice in videos" in the popup, or press Alt+Shift+V.
- Videos with subtitles (HTML5 tracks, YouTube captions): the subtitles are translated and shown on the video.
- Videos without subtitles: the sound is transcribed by Groq Whisper (free tier, with your free Groq key), then translated.
- Bilingual subtitles and optional read-aloud with your browser's speech synthesis.
- New in 1.2, dubbing: choose "Subtitles + translated voice (dubbing)" and the translation is spoken by your browser's speech synthesis, timed to the subtitles, while the original sound is lowered. Free, on any site.

**Free, with your own keys**

- DevDocTrad is free and open source (MIT license).
- It uses your own free API keys: Google Gemini, Groq, Mistral, OpenRouter (only models whose name ends with :free), or a local model with Ollama.
- When a free key reaches its limit, the extension moves to another free key or to Ollama, never to a paid key.
- A paid key stays blocked until you set a daily cap and prices yourself.

**Privacy**

- The text of the page you translate is sent only to the provider you chose. Nothing is sent to the DevDocTrad developer.
- Video sound is sent only to Groq, only for a video without subtitles, only when you turn the feature on. Your microphone is never used.
- Each provider has its own terms. On free tiers, Google Gemini and Mistral may reuse the text sent. With Ollama, the text stays on your computer: prefer it for private pages.
- Sensitive pages (password fields, banks, mail, sign-in pages) are never translated automatically.
- No analytics, no tracking, no ads. Keys, settings and cache stay in the browser's local storage, never synced.

**Getting started**

1. Create a free key, for example at console.groq.com (no credit card needed).
2. Click the DevDocTrad icon, then the gear icon (Settings).
3. Keys tab: choose the provider, click Add, paste the key, click Load models, pick a model, then click Test.
4. On a documentation page, click the icon then "Translate this page", or press Alt+Shift+T.

To change the shortcuts: Add-ons Manager (about:addons), gear icon, "Manage Extension Shortcuts".

**Limits**

No extension can translate Firefox internal pages (about:), addons.mozilla.org and other domains reserved by Mozilla, or the built-in PDF viewer. Requires Firefox 140 or later, desktop only.

Website: https://devdoctrad.vercel.app/
Source code and help: https://github.com/jocravidd-droid/DevDocTrad
```

### 3.2 Description fr

```text
**Traduit fidèlement la documentation technique et les sites pour programmeurs, sans jamais toucher au code.** Et maintenant la voix des vidéos, en sous-titres traduits.

DevDocTrad est pour toutes celles et ceux qui lisent une documentation dans une langue qu’ils maîtrisent mal : documentation officielle, README et issues GitHub, Stack Overflow, forums, blogs techniques, pages de frameworks, tutoriels vidéo.

**Ce que fait l’extension**

- Traduction fidèle, phrase par phrase, dans le même ordre : pas de résumé, pas d’omission, pas d’ajout.
- Le code n’est jamais traduit : commandes, noms de fonctions, API, chemins et URL restent exactement tels quels.
- Les liens, le gras et les éléments de code restent à leur place.
- Langue cible : celle du navigateur par défaut (37 langues disponibles), modifiable dans les réglages.
- Deux affichages : remplacer le texte, ou mode bilingue avec la traduction sous chaque phrase.
- Retour à l’original exact en un clic, ou avec Alt+Maj+T.
- Traduction automatique sur les sites que tu choisis. Firefox demande l’autorisation site par site.
- Glossaire personnel : termes à ne jamais traduire, ou à toujours traduire de la même façon.
- Les README et fichiers .txt bruts sont aussi traduits (vue lisible, code intact).
- Interface en 36 langues (arabe, hébreu et persan de droite à gauche), thèmes clair et sombre.

**La voix des vidéos traduite (nouveau en 1.1)**

- Active « Traduire la voix des vidéos » dans le popup, ou appuie sur Alt+Maj+V.
- Vidéo avec sous-titres (pistes HTML5, sous-titres YouTube) : les sous-titres sont traduits et affichés sur la vidéo.
- Vidéo sans sous-titres : le son est transcrit par Groq Whisper (palier gratuit, avec ta clé Groq gratuite), puis traduit.
- Sous-titres bilingues et lecture à voix haute facultative avec la synthèse vocale du navigateur.
- Nouveau en 1.2, le doublage : choisis « Sous-titres + voix traduite (doublage) » et la traduction est dite par la synthèse vocale du navigateur, calée sur les sous-titres, pendant que le son d’origine est baissé. Gratuit, sur n’importe quel site.

**Gratuit, avec tes propres clés**

- DevDocTrad est gratuite et open source (licence MIT).
- Elle utilise tes propres clés d’API gratuites : Google Gemini, Groq, Mistral, OpenRouter (uniquement les modèles dont le nom finit par :free), ou un modèle local avec Ollama.
- Quand une clé gratuite atteint sa limite, l’extension passe à une autre clé gratuite ou à Ollama, jamais à une clé payante.
- Une clé payante reste bloquée tant que tu n’as pas réglé toi-même un plafond journalier et les prix.

**Confidentialité**

- Le texte de la page que tu traduis est envoyé uniquement au fournisseur que tu as choisi. Rien n’est envoyé au développeur de DevDocTrad.
- Le son d’une vidéo est envoyé uniquement à Groq, seulement pour une vidéo sans sous-titres, seulement quand tu actives la fonction. Ton micro n’est jamais utilisé.
- Chaque fournisseur a ses propres conditions. En palier gratuit, Google Gemini et Mistral peuvent réutiliser les textes envoyés. Avec Ollama, le texte reste sur ton ordinateur : c’est le choix à privilégier pour les pages privées.
- Les pages sensibles (champ mot de passe, banques, mails, pages de connexion) ne sont jamais traduites automatiquement.
- Aucune statistique, aucun pistage, aucune publicité. Les clés, les réglages et le cache restent dans le stockage local du navigateur, jamais synchronisés.

**Mise en route**

1. Crée une clé gratuite, par exemple sur console.groq.com (sans carte bancaire).
2. Clique sur l’icône DevDocTrad, puis sur la roue dentée (Réglages).
3. Onglet Clés : choisis le fournisseur, clique sur Ajouter, colle la clé, clique sur Charger les modèles, choisis un modèle, puis clique sur Tester.
4. Sur une page de documentation, clique sur l’icône puis sur « Traduire cette page », ou appuie sur Alt+Maj+T.

Pour changer les raccourcis : gestionnaire de modules (about:addons), roue dentée, « Gérer les raccourcis ».

**Limites**

Aucune extension ne peut traduire les pages internes de Firefox (about:), addons.mozilla.org et les autres domaines réservés par Mozilla, ni le lecteur PDF intégré. Firefox 140 ou plus récent, sur ordinateur uniquement.

Site : https://devdoctrad.vercel.app/
Code source et aide : https://github.com/jocravidd-droid/DevDocTrad
```

## 4. Légendes des captures

Envoie les 8 images **dans cet ordre**. Dossier `store/amo/en/` pour la fiche anglaise, `store/amo/fr/` pour la fiche française (mêmes captures, titre du bandeau dans la langue). Toutes font exactement 1280 x 800 pixels.

| N° | Fichier | Caption (en-US) | Légende (fr) |
|---|---|---|---|
| 1 | `01-traduction.png` | A documentation page translated into French: commands, function names and URLs stay exactly the same. | Une page de documentation traduite en français : commandes, noms de fonctions et URL restent identiques. |
| 2 | `02-bilingue.png` | Bilingual mode: the translation appears under each original sentence. | Mode bilingue : la traduction s’affiche sous chaque phrase d’origine. |
| 3 | `03-popup.png` | The popup: translate, switch back to the original, choose the target language or the key. | Le popup : traduire, revenir à l’original, choisir la langue cible ou la clé. |
| 4 | `04-voix-videos.png` | Video voice: subtitles translated live on the video, original above. Free Groq Whisper transcription for videos without subtitles. | Voix des vidéos : sous-titres traduits en direct sur la vidéo, original au-dessus. Transcription gratuite Groq Whisper pour les vidéos sans sous-titres. |
| 5 | `05-russe.png` | The target language follows your browser: here the same page in Russian. 37 languages available. | La langue cible suit celle du navigateur : ici la même page en russe. 37 langues disponibles. |
| 6 | `06-cles.png` | Settings: your own free keys (Gemini, Groq, Mistral, OpenRouter) or local Ollama. Keys are masked and stay in your browser. | Réglages : tes propres clés gratuites (Gemini, Groq, Mistral, OpenRouter) ou Ollama en local. Les clés sont masquées et restent dans ton navigateur. |
| 7 | `07-glossaire.png` | Personal glossary: terms never translated, or always translated the same way. | Glossaire personnel : des termes jamais traduits, ou toujours traduits de la même façon. |
| 8 | `08-theme-sombre.png` | Dark theme: popup, badge and settings follow your system theme. | Thème sombre : le popup, le badge et les réglages suivent le thème du système. |

Les captures sont faites sur une page de démonstration (« Nimbus HTTP », adresse fictive `docs.example.com`) avec un modèle local simulé ; les clés affichées sont factices et masquées. Pour les refaire : `pkill -f fake_ollama ; python3 build.py && node tools/amo_shots.js`.

## 5. Catégories et tags

**Catégories** (Firefox) : coche ces deux-là, et décoche les autres (en particulier « Search Tools », qui ne correspond pas) :

| Catégorie AMO (anglais) | Libellé français | Pourquoi |
|---|---|---|
| Language Support | Prise en charge des langues | C’est une extension de traduction. |
| Web Development | Développement web | Le public : les développeurs qui lisent de la documentation. |

**Tags** : AMO n’accepte que des tags de sa liste fermée (vérifiée sur l’API publique d’AMO le 26 novembre 2026). « translation » et « developer tools » n’existent pas. Choisis dans la liste proposée :

| Tag | Pourquoi |
|---|---|
| `translate` | Le cœur de l’extension. |
| `youtube` | Les sous-titres YouTube sont traduits (voix des vidéos). |

Aucun autre tag de la liste ne correspond (« dark mode » désigne les extensions qui assombrissent les sites, « privacy » les bloqueurs de pistage) : mieux vaut 2 tags justes que 10 trompeurs. Si AMO ajoute un jour des tags comme « developer tools », « documentation » ou « subtitles », ajoute-les.

## 6. Liens, licence, options

| Champ AMO (anglais) | Libellé français | Valeur |
|---|---|---|
| Homepage | Page d’accueil | `https://devdoctrad.vercel.app/` (à remplir en en-US **et** en fr) |
| Support website | Site d’assistance | `https://github.com/jocravidd-droid/DevDocTrad/issues` (en-US et fr) |
| Support email | E-mail d’assistance | Facultatif : l’adresse est affichée publiquement. Laisse vide pour ne recevoir les demandes que sur GitHub. |
| License | Licence | MIT License |
| This add-on is experimental | Ce module est expérimental | **Non** (case décochée) |
| This add-on requires payment… | Ce module nécessite un paiement… | **Non** (case décochée) : tout est gratuit, les clés des fournisseurs aussi. |
| Contributions URL | URL de contribution | Vide |
| Source code | Code source | Pas d’envoi : le paquet n’est ni minifié, ni concaténé, ni transpilé. Réponds **No**. |
| Compatibility | Compatibilité | Firefox (ordinateur) uniquement, version 140 ou plus. Pas Firefox pour Android. |

## 7. Politique de confidentialité (Privacy Policy)

Champ « Politique de confidentialité ». Colle le texte anglais dans la fiche en-US, et le français dans la fiche fr. C’est le texte actuel de `PRIVACY.md` (version 1.2.0), sans la mise en forme Markdown. Si `PRIVACY.md` change, recopie-le ici.

### 7.1 en-US

```text
DevDocTrad privacy policy

Last updated: November 26, 2026 (version 1.2, video dubbing).

DevDocTrad is an open-source browser extension (MIT license) that translates technical web pages. It collects no data for its developer.

- Text of the pages you translate is sent only to the provider you configured (Google Gemini, Groq, Mistral, OpenRouter, or Ollama, by default on your own computer). Nothing is sent to the DevDocTrad developer.
- Video sound (only if you turn on "Translate the voice in videos"). If the video has subtitles, only their text is translated, like page text: no sound is sent. Otherwise, the video's sound is cut into chunks of a few seconds and sent only to Groq (Whisper transcription) with your free Groq key. Silent chunks are not sent. The sound is not stored anywhere; translated subtitles and transcripts are kept in the local translation cache, like page text (see below), and nothing is sent to the developer. Your microphone is never used. Dubbing (translated voice) and read-aloud use your browser's built-in speech synthesis: the voice is generated by the browser and DevDocTrad sends nothing to any voice service. Note: some voices offered by the browser itself (for example those named "Google" in Chrome or "Online" in Edge) are produced by the browser vendor on its servers, under its own rules; other voices stay on your device. The "Open the video in a tab" button simply opens the embedded player's address.
- API keys, settings, glossary and translation cache (translated pages, subtitles and transcripts) are stored in your browser's local storage (storage.local), readable only by the extension (not by websites or other extensions), never synced, and never leave your device, except your key, sent to the matching provider in the request header.
- No analytics, no tracking, no ads, no remote code, no data sale or sharing.
- Sensitive pages (password fields, banks, mail, sign-in pages) are never translated automatically.
- Each provider has its own terms; on free tiers Google Gemini and Mistral may reuse the text sent. OpenRouter forwards the text to the third-party provider hosting the chosen model: free (:free) models go through providers that may keep and reuse the text sent.
- Ollama: by default the address is http://localhost:11434 and text stays on your computer. The address can be changed in the settings: if you point it to another machine (local network or Internet), the text to translate is sent to that machine; prefer an https address so it does not travel in clear text.
- Delete your data: Settings, Data tab, "Clear cache"; delete a key with its "Delete" button; uninstalling removes all local data.

Contact: https://github.com/jocravidd-droid/DevDocTrad/issues
```

### 7.2 fr

```text
Politique de confidentialité de DevDocTrad

Dernière mise à jour : 26 novembre 2026 (version 1.2, doublage des vidéos).

DevDocTrad est une extension de navigateur open source (licence MIT) qui traduit les pages web techniques. Elle ne collecte aucune donnée pour son développeur.

Données traitées
- Texte des pages que tu traduis. Quand tu lances une traduction (bouton, raccourci ou traduction automatique sur un site que tu as choisi), le texte visible de la page est envoyé uniquement au fournisseur que tu as configuré : Google Gemini, Groq, Mistral, OpenRouter, ou Ollama (par défaut sur ton propre ordinateur, voir plus bas). Rien n'est envoyé au développeur de DevDocTrad.
- Son des vidéos (seulement si tu actives « Traduire la voix des vidéos »). Si la vidéo a des sous-titres, seul leur texte est traduit, comme le texte d'une page : aucun son n'est envoyé. Si elle n'en a pas, le son de la vidéo est découpé en morceaux de quelques secondes et envoyé uniquement à Groq (transcription Whisper), avec ta clé Groq gratuite. Les morceaux silencieux ne sont pas envoyés. Le son n'est enregistré nulle part ; les sous-titres et les transcriptions traduits sont gardés dans le cache local de traductions, comme le texte des pages (voir plus bas), et rien n'est envoyé au développeur. Ton micro n'est jamais utilisé. Le doublage (voix traduite) et la lecture à voix haute utilisent la synthèse vocale de ton navigateur : la voix est générée par le navigateur, DevDocTrad n'envoie rien à un service de voix. Note : certaines voix proposées par le navigateur lui-même (par exemple celles nommées « Google » dans Chrome ou « Online » dans Edge) sont produites par l'éditeur du navigateur sur ses serveurs, selon ses propres règles ; les autres voix restent sur ton appareil. Le bouton « Ouvrir la vidéo dans un onglet » ouvre simplement l'adresse du lecteur intégré.
- Tes clés d'API, réglages, glossaire et cache de traductions (pages, sous-titres et transcriptions traduits) sont enregistrés dans le stockage local de ton navigateur (storage.local), que seule l'extension peut lire (ni les sites web ni les autres extensions n'y ont accès). Ils ne sont jamais synchronisés avec ton compte de navigateur et ne quittent jamais ton appareil, sauf ta clé, transmise au fournisseur correspondant dans l'en-tête de la requête.

Ce que DevDocTrad ne fait pas
- Aucune statistique d'utilisation, aucun pistage, aucune publicité.
- Aucun code chargé depuis Internet.
- Aucune vente ni aucun partage de données avec des tiers, à part l'envoi du texte au fournisseur que tu as choisi.
- Pas de traduction automatique sur les pages sensibles (champ mot de passe, banques, mails, pages de connexion).

Fournisseurs
Chaque fournisseur a ses propres conditions. En palier gratuit, Google Gemini et Mistral peuvent réutiliser les textes envoyés ; Groq indique ne pas entraîner ses modèles sur les données. OpenRouter transmet le texte à un fournisseur tiers qui héberge le modèle choisi : les modèles gratuits (:free) passent par des fournisseurs qui peuvent garder et réutiliser les textes envoyés. Consulte les conditions de chaque fournisseur avant de l'utiliser, et préfère Ollama pour les pages privées.

Ollama : par défaut, l'adresse est http://localhost:11434, et le texte reste sur ton ordinateur. Cette adresse se change dans les réglages : si tu indiques une autre machine (réseau local ou Internet), le texte à traduire part vers cette machine ; préfère alors une adresse en https pour qu'il ne circule pas en clair.

Effacer tes données
Réglages, onglet Données, bouton « Vider le cache ». Supprimer une clé : bouton « Supprimer » sur sa carte. Désinstaller l'extension efface toutes ses données locales.

Contact
Ouvre une issue sur le dépôt : https://github.com/jocravidd-droid/DevDocTrad/issues
```

## 8. Notes pour les relecteurs (Notes to Reviewer)

Champ de la page de la version (en anglais seulement, les relecteurs lisent l’anglais). N’y mets jamais une clé que tu utilises toi-même.

```text
Source code: https://github.com/jocravidd-droid/DevDocTrad (MIT). The package is not minified, concatenated, bundled or transpiled: build.py only copies src/ and merges manifests/base.json with manifests/firefox.json into manifest.json. No remote code, no eval.

Permissions:
- storage, unlimitedStorage: settings, keys and the translation cache, in storage.local only (never synced).
- activeTab, scripting: the content script is injected only into the tab where the user clicks the toolbar button or presses Alt+Shift+T / Alt+Shift+V.
- host_permissions (generativelanguage.googleapis.com, api.groq.com, api.mistral.ai, openrouter.ai): the translation providers, called with the user's own API key.
- optional_host_permissions (*://*/*, localhost:11434, 127.0.0.1:11434): requested at runtime, only for sites the user adds to automatic translation, and for Ollama. The Ollama address is configurable in the settings (default http://localhost:11434); if the user enters another address, permission is requested for that origin only, and the text is then sent to that machine.
- commands: Alt+Shift+T (translate / show original), Alt+Shift+V (video voice).

Data: declared as data_collection_permissions required: websiteContent. The visible text of the page is sent only to the provider the user configured, or to the Ollama server at the address the user set (localhost by default). Video voice: subtitle text is translated like page text; for a video without subtitles, short audio chunks of the video (never the microphone) are sent only to Groq's Whisper transcription endpoint (api.groq.com/openai/v1/audio/transcriptions) with the user's free Groq key. Dubbing (optional, "Subtitles + translated voice" in the popup): the translated subtitles are spoken with the browser's own speech synthesis (speechSynthesis); the extension sends nothing to any voice service. Most voices run locally; voices the browser itself labels "Google" (Chrome) or "Online" (Edge) may be generated on the browser vendor's servers, under the browser's own terms. Nothing is sent to the developer. No analytics, no tracking.

How to test for free:
1. Create a free Groq key at https://console.groq.com (no credit card): API Keys, then Create API Key.
2. Click the DevDocTrad toolbar icon, then the gear icon (Settings). If the settings page shows "Allow access to providers", click it and accept.
3. Keys tab: choose Groq, click Add, paste the key, click Load models, pick a model in "Model (simple pages)", then click Test.
4. Translation tab: the target language is the browser language. If Firefox is in English, set "Target language" to another language (for example French).
5. Open https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction, click the toolbar icon, then "Translate this page" (or press Alt+Shift+T). Code elements, commands and URLs stay untouched. "Show original" in the badge, or Alt+Shift+T again, restores the exact original.
6. Video voice: open a YouTube video that has English captions, then turn on "Translate the voice in videos" in the popup (or press Alt+Shift+V). Translated subtitles appear on the video. For a video without subtitles, the same Groq key is used for Whisper transcription.
7. Dubbing: in the popup, under the video switch, choose "Subtitles + translated voice (dubbing)". The translated subtitles are spoken by the browser's voice while the original sound is lowered; the speaker button on the subtitle bar switches the voice on or off.
```

## 9. Notes de version 1.2.0 (Release notes)

Champ « Notes de version » de la version 1.2.0 (page de la version, après l’envoi du fichier). Tiré de la section 1.2.0 de `CHANGELOG.md` ; le rappel de la voix des vidéos vient de la section 1.1.0.

**en-US** :

```text
- New in 1.2: free dubbing on any video. In the popup, under "Translate the voice in videos", choose "Subtitles + translated voice (dubbing)": the translation is spoken by your browser's built-in speech voice (best voice for the target language), timed to the subtitles, with pause and seek handled, while the original sound is lowered to about 15% only while the voice speaks. The speaker button on the subtitle bar switches the voice at any time.
- Everywhere: videos and sounds are also found in web-component players (open shadow roots); <audio> players (podcasts) are supported; with several videos, the one playing (or the largest visible one) is used.
- Embedded players from other sites (YouTube, Vimeo, Dailymotion, Loom, Twitch…): clear message and an "Open the video in a tab" button.
- Read-aloud: the video sound is no longer lowered all the time, only while the voice speaks. DRM-protected videos get a clear message right away.
- Reminder (1.1): video voice translation (popup switch or Alt+Shift+V). Subtitles and YouTube captions are translated live on the video; videos without subtitles are transcribed by Groq Whisper (free tier, free Groq key only), then translated.
- Raw text and Markdown files (GitHub "raw" READMEs, .txt, .md) are now shown readably and translated, code intact.
- Firefox fixes: the voice of videos without subtitles is now sent and translated; sites where Firefox forbids every extension (addons.mozilla.org, support.mozilla.org) and PDFs now show a clear message instead of doing nothing.
- Pages built with React, Vue, Next or Docusaurus no longer risk breaking: text is changed in place. "Stop" is respected; content loaded later is translated.
- Paid keys: the daily spending cap is now strictly enforced.
- Cleaner interface: sharp rounded corners, popup always fits, better contrast.
- 7 new interface texts translated into the 36 languages.
- No new permission. Privacy policy updated: the dubbing voice is generated by the browser, DevDocTrad sends nothing to any voice service.
```

**fr** :

```text
- Nouveau en 1.2 : doublage gratuit sur n’importe quelle vidéo. Dans le popup, sous « Traduire la voix des vidéos », choisis « Sous-titres + voix traduite (doublage) » : la traduction est dite par la voix de synthèse du navigateur (meilleure voix pour la langue cible), calée sur les sous-titres, pause et saut dans la vidéo compris, et le son d’origine est baissé à environ 15 % seulement pendant que la voix parle. Le bouton haut-parleur de la bande bascule la voix à tout moment.
- Partout : vidéos et sons trouvés aussi dans les lecteurs en composants web (shadow roots ouverts) ; lecteurs <audio> (podcasts) pris en charge ; plusieurs vidéos : celle qui joue, sinon la plus grande visible.
- Lecteurs intégrés d’un autre site (YouTube, Vimeo, Dailymotion, Loom, Twitch…) : message clair et bouton « Ouvrir la vidéo dans un onglet ».
- Lecture à voix haute : le son de la vidéo n’est plus baissé en continu, seulement pendant que la voix parle. Vidéo protégée par DRM : message clair tout de suite.
- Rappel (1.1) : traduction de la voix des vidéos (interrupteur du popup ou Alt+Maj+V). Les sous-titres et ceux de YouTube sont traduits en direct sur la vidéo ; une vidéo sans sous-titres est transcrite par Groq Whisper (palier gratuit, clé Groq gratuite uniquement), puis traduite.
- Fichiers texte et Markdown bruts (README « raw » de GitHub, .txt, .md) : affichés lisiblement et traduits, code intact.
- Correctifs Firefox : la voix d’une vidéo sans sous-titres est maintenant envoyée et traduite ; sites où Firefox interdit toute extension (addons.mozilla.org, support.mozilla.org) et PDF : message clair au lieu de ne rien faire.
- Les pages faites avec React, Vue, Next ou Docusaurus ne risquent plus de casser : le texte est modifié sur place. « Arrêter » est respecté ; le contenu chargé plus tard est traduit.
- Clés payantes : le plafond de dépense quotidien est strictement respecté.
- Interface plus nette : coins arrondis propres, popup toujours à la bonne taille, meilleur contraste.
- 7 nouveaux textes d’interface traduits dans les 36 langues.
- Aucune nouvelle permission. Politique de confidentialité mise à jour : la voix du doublage est générée par le navigateur, DevDocTrad n’envoie rien à un service de voix.
```
