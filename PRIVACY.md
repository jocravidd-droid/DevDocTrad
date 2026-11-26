# Politique de confidentialité de DevDocTrad

Dernière mise à jour : 26 novembre 2026 (version 1.2, doublage des vidéos). [English version below](#privacy-policy).

DevDocTrad est une extension de navigateur open source (licence MIT) qui traduit les pages web techniques. Elle ne collecte aucune donnée pour son développeur.

## Données traitées

- **Texte des pages que tu traduis.** Quand tu lances une traduction (bouton, raccourci ou traduction automatique sur un site que tu as choisi), le texte visible de la page est envoyé **uniquement** au fournisseur que tu as configuré : Google Gemini, Groq, Mistral, OpenRouter, ou Ollama (par défaut sur ton propre ordinateur, voir plus bas). Rien n'est envoyé au développeur de DevDocTrad.
- **Son des vidéos (seulement si tu actives « Traduire la voix des vidéos »).** Si la vidéo a des sous-titres, seul leur texte est traduit, comme le texte d'une page : aucun son n'est envoyé. Si elle n'en a pas, le son de la vidéo est découpé en morceaux de quelques secondes et envoyé **uniquement à Groq** (transcription Whisper), avec ta clé Groq gratuite. Les morceaux silencieux ne sont pas envoyés. Le son n'est enregistré nulle part ; les sous-titres et les transcriptions traduits sont gardés dans le cache local de traductions, comme le texte des pages (voir plus bas), et rien n'est envoyé au développeur. Ton micro n'est jamais utilisé. Le **doublage** (voix traduite) et la lecture à voix haute utilisent la synthèse vocale de ton navigateur : la voix est générée par le navigateur, DevDocTrad n'envoie rien à un service de voix. Note : certaines voix proposées par le navigateur lui-même (par exemple celles nommées « Google » dans Chrome ou « Online » dans Edge) sont produites par l'éditeur du navigateur sur ses serveurs, selon ses propres règles ; les autres voix restent sur ton appareil. Le bouton « Ouvrir la vidéo dans un onglet » ouvre simplement l'adresse du lecteur intégré.
- **Tes clés d'API, réglages, glossaire et cache de traductions** (pages, sous-titres et transcriptions traduits) sont enregistrés dans le stockage local de ton navigateur (`storage.local`), que seule l'extension peut lire (ni les sites web ni les autres extensions n'y ont accès). Ils ne sont jamais synchronisés avec ton compte de navigateur et ne quittent jamais ton appareil, sauf ta clé, transmise au fournisseur correspondant dans l'en-tête de la requête.

## Ce que DevDocTrad ne fait pas

- Aucune statistique d'utilisation, aucun pistage, aucune publicité.
- Aucun code chargé depuis Internet.
- Aucune vente ni aucun partage de données avec des tiers, à part l'envoi du texte au fournisseur que tu as choisi.
- Pas de traduction automatique sur les pages sensibles (champ mot de passe, banques, mails, pages de connexion).

## Fournisseurs

Chaque fournisseur a ses propres conditions. En palier gratuit, Google Gemini et Mistral peuvent réutiliser les textes envoyés ; Groq indique ne pas entraîner ses modèles sur les données. OpenRouter transmet le texte à un fournisseur tiers qui héberge le modèle choisi : les modèles gratuits (`:free`) passent par des fournisseurs qui peuvent garder et réutiliser les textes envoyés. Consulte les conditions de chaque fournisseur avant de l'utiliser, et préfère Ollama pour les pages privées.

**Ollama** : par défaut, l'adresse est `http://localhost:11434`, et le texte reste sur ton ordinateur. Cette adresse se change dans les réglages : si tu indiques une autre machine (réseau local ou Internet), le texte à traduire part vers cette machine ; préfère alors une adresse en `https` pour qu'il ne circule pas en clair.

## Effacer tes données

Réglages, onglet Données, bouton « Vider le cache ». Supprimer une clé : bouton « Supprimer » sur sa carte. Désinstaller l'extension efface toutes ses données locales.

## Contact

Ouvre une issue sur le dépôt : https://github.com/jocravidd-droid/DevDocTrad/issues

---

# Privacy policy

Last updated: November 26, 2026 (version 1.2, video dubbing).

DevDocTrad is an open-source browser extension (MIT license) that translates technical web pages. It collects no data for its developer.

- **Text of the pages you translate** is sent **only** to the provider you configured (Google Gemini, Groq, Mistral, OpenRouter, or Ollama, by default on your own computer). Nothing is sent to the DevDocTrad developer.
- **Video sound (only if you turn on "Translate the voice in videos").** If the video has subtitles, only their text is translated, like page text: no sound is sent. Otherwise, the video's sound is cut into chunks of a few seconds and sent **only to Groq** (Whisper transcription) with your free Groq key. Silent chunks are not sent. The sound is not stored anywhere; translated subtitles and transcripts are kept in the local translation cache, like page text (see below), and nothing is sent to the developer. Your microphone is never used. **Dubbing** (translated voice) and read-aloud use your browser's built-in speech synthesis: the voice is generated by the browser and DevDocTrad sends nothing to any voice service. Note: some voices offered by the browser itself (for example those named "Google" in Chrome or "Online" in Edge) are produced by the browser vendor on its servers, under its own rules; other voices stay on your device. The "Open the video in a tab" button simply opens the embedded player's address.
- **API keys, settings, glossary and translation cache** (translated pages, subtitles and transcripts) are stored in your browser's local storage (`storage.local`), readable only by the extension (not by websites or other extensions), never synced, and never leave your device, except your key, sent to the matching provider in the request header.
- No analytics, no tracking, no ads, no remote code, no data sale or sharing.
- Sensitive pages (password fields, banks, mail, sign-in pages) are never translated automatically.
- Each provider has its own terms; on free tiers Google Gemini and Mistral may reuse the text sent. OpenRouter forwards the text to the third-party provider hosting the chosen model: free (`:free`) models go through providers that may keep and reuse the text sent.
- Ollama: by default the address is `http://localhost:11434` and text stays on your computer. The address can be changed in the settings: if you point it to another machine (local network or Internet), the text to translate is sent to that machine; prefer an `https` address so it does not travel in clear text.
- Delete your data: Settings, Data tab, "Clear cache"; delete a key with its "Delete" button; uninstalling removes all local data.

Contact: https://github.com/jocravidd-droid/DevDocTrad/issues
