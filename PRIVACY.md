# Politique de confidentialité de DevDocTrad

Dernière mise à jour : 25 novembre 2026 (version 1.1, voix des vidéos). [English version below](#privacy-policy).

DevDocTrad est une extension de navigateur open source (licence MIT) qui traduit les pages web techniques. Elle ne collecte aucune donnée pour son développeur.

## Données traitées

- **Texte des pages que tu traduis.** Quand tu lances une traduction (bouton, raccourci ou traduction automatique sur un site que tu as choisi), le texte visible de la page est envoyé **uniquement** au fournisseur que tu as configuré : Google Gemini, Groq, Mistral, OpenRouter, ou Ollama sur ton propre ordinateur. Rien n'est envoyé au développeur de DevDocTrad.
- **Son des vidéos (seulement si tu actives « Traduire la voix des vidéos »).** Si la vidéo a des sous-titres, seul leur texte est traduit, comme le texte d'une page : aucun son n'est envoyé. Si elle n'en a pas, le son de la vidéo est découpé en morceaux de quelques secondes et envoyé **uniquement à Groq** (transcription Whisper), avec ta clé Groq gratuite. Les morceaux silencieux ne sont pas envoyés. Rien n'est enregistré sur ton appareil ni envoyé au développeur. Ton micro n'est jamais utilisé. La lecture à voix haute utilise la synthèse vocale de ton navigateur.
- **Tes clés d'API, réglages, glossaire et cache de traductions** sont enregistrés dans le stockage local de ton navigateur (`storage.local`). Ils ne sont jamais synchronisés avec ton compte de navigateur et ne quittent jamais ton appareil, sauf ta clé, transmise au fournisseur correspondant dans l'en-tête de la requête.

## Ce que DevDocTrad ne fait pas

- Aucune statistique d'utilisation, aucun pistage, aucune publicité.
- Aucun code chargé depuis Internet.
- Aucune vente ni aucun partage de données avec des tiers, à part l'envoi du texte au fournisseur que tu as choisi.
- Pas de traduction automatique sur les pages sensibles (champ mot de passe, banques, mails, pages de connexion).

## Fournisseurs

Chaque fournisseur a ses propres conditions. En palier gratuit, Google Gemini et Mistral peuvent réutiliser les textes envoyés ; Groq indique ne pas entraîner ses modèles sur les données. Avec Ollama, le texte reste sur ton ordinateur. Consulte les conditions de chaque fournisseur avant de l'utiliser, et préfère Ollama pour les pages privées.

## Effacer tes données

Réglages, onglet Données, bouton « Vider le cache ». Supprimer une clé : bouton « Supprimer » sur sa carte. Désinstaller l'extension efface toutes ses données locales.

## Contact

Ouvre une issue sur le dépôt : https://github.com/jocravidd-droid/DevDocTrad/issues

---

# Privacy policy

Last updated: November 25, 2026 (version 1.1, video voice).

DevDocTrad is an open-source browser extension (MIT license) that translates technical web pages. It collects no data for its developer.

- **Text of the pages you translate** is sent **only** to the provider you configured (Google Gemini, Groq, Mistral, OpenRouter, or Ollama on your own computer). Nothing is sent to the DevDocTrad developer.
- **Video sound (only if you turn on "Translate the voice in videos").** If the video has subtitles, only their text is translated, like page text: no sound is sent. Otherwise, the video's sound is cut into chunks of a few seconds and sent **only to Groq** (Whisper transcription) with your free Groq key. Silent chunks are not sent. Nothing is stored on your device or sent to the developer. Your microphone is never used. Read-aloud uses your browser's built-in speech synthesis.
- **API keys, settings, glossary and translation cache** are stored in your browser's local storage, never synced, and never leave your device, except your key, sent to the matching provider in the request header.
- No analytics, no tracking, no ads, no remote code, no data sale or sharing.
- Sensitive pages (password fields, banks, mail, sign-in pages) are never translated automatically.
- Each provider has its own terms; on free tiers Google Gemini and Mistral may reuse the text sent. With Ollama, text stays on your computer.
- Delete your data: Settings, Data tab, "Clear cache"; delete a key with its "Delete" button; uninstalling removes all local data.

Contact: https://github.com/jocravidd-droid/DevDocTrad/issues
