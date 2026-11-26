# Publier DevDocTrad sur Microsoft Edge Add-ons (gratuit)

L'inscription développeur Microsoft Edge est **gratuite** (pas de frais, contrairement aux 5 $ du Chrome Web Store). La boutique Edge accepte exactement le même paquet que Chrome.

Paquet à envoyer : `release/devdoctrad-chrome-1.2.0.zip` (le zip Chrome, tel quel).

## 1. Créer le compte (une seule fois, 10 minutes)

1. Va sur https://partner.microsoft.com/dashboard/microsoftedge/public/login et connecte-toi avec un compte Microsoft (Outlook, Hotmail ou autre ; tu peux en créer un gratuitement).
2. Choisis **Individuel** (Individual) comme type de compte. Remplis nom, pays, adresse mail de contact.
3. Valide l'adresse mail reçue. Aucun moyen de paiement n'est demandé.

## 2. Créer la fiche (20 minutes)

1. Dans le tableau de bord Edge, clique sur **Créer une extension** (Create new extension).
2. **Package** : glisse `release/devdoctrad-chrome-1.2.0.zip`. Attends la fin de la vérification automatique.
3. **Availability** : visibilité **Public**, marchés : **tous**.
4. **Properties** :
   - Catégorie : **Developer tools** ;
   - Privacy policy URL : `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md` ;
   - Website URL : `https://devdoctrad.vercel.app/` ;
   - Support contact : `https://github.com/jocravidd-droid/DevDocTrad/issues` ;
   - « Mature content » : **non**.
5. **Store listings** : ajoute au moins **English** et **Français** (tu peux ajouter d'autres langues plus tard ; les textes du site `tools/site/<langue>.json` peuvent servir : `meta_desc` pour la description courte, les `f_*_t` / `f_*_p` pour la description longue).
   - Description : copie celle de [`chrome-web-store.md`](chrome-web-store.md) (mêmes limites) et ajoute ce paragraphe :
     ```text
     New in 1.1: translate the voice of videos. Subtitles (including YouTube captions) are translated live on the video. Videos without subtitles are transcribed for free with Groq Whisper using your own free Groq key. Optional read-aloud with your browser's voice.
     ```
     En français :
     ```text
     Nouveau en 1.1 : la voix des vidéos traduite. Les sous-titres (y compris ceux de YouTube) sont traduits en direct sur la vidéo. Une vidéo sans sous-titres est transcrite gratuitement par Groq Whisper avec ta propre clé Groq gratuite. Lecture à voix haute possible avec la voix de ton navigateur.
     ```
   - Logo : `store/icon-128.png` (300×300 conseillé : `design/logo/devdoctrad-symbol-1024.png` redimensionné convient aussi).
   - Captures 1280×800 : les cinq fichiers de `store/screenshots/`.
   - Petite promo 440×280 : `store/promo-440x280.png`. Grande promo 1400×560 : `store/promo-1400x560.png`.
   - Mots-clés de recherche (Search terms) : `translate documentation`, `developer`, `translator`, `subtitles`, `video translation`, `code`, `README`, `Stack Overflow`.
6. **Notes for certification** (copie-colle, en anglais) :
   ```text
   DevDocTrad translates the visible text of web pages (and optionally video subtitles or video audio) with the user's own API keys (Google Gemini, Groq, Mistral, OpenRouter) or a local Ollama model. No account, no server, no analytics.
   To test: open the options page, add a free Groq or Gemini key, click "Load models", pick a model, "Test", then open any documentation page (e.g. https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and click "Translate this page" in the popup.
   Permissions: storage (settings, keys, cache), activeTab + scripting (inject the translator into the current tab when the user clicks), host permissions only for the four API endpoints; optional per-site permission only when the user enables automatic translation for that site.
   Video voice: on a page with a video, the popup switch "Translate the voice in videos" translates subtitles; without subtitles, short audio chunks are sent to Groq's Whisper endpoint with the user's free Groq key. The microphone is never used.
   ```
7. Clique sur **Publish**. La vérification prend en général de quelques heures à 7 jours ouvrés. Tu reçois un mail.

## 3. Mettre à jour (tous les 15 jours si une nouvelle version existe)

1. Tableau de bord > DevDocTrad > **Update**.
2. **Package** : envoie le nouveau `release/devdoctrad-chrome-<version>.zip` (le numéro doit être plus grand que le précédent ; `build.py` le prend dans `manifests/base.json`).
3. Mets à jour la description si une fonction visible a été ajoutée (voir `CHANGELOG.md`), puis **Publish**.

## Après la publication

Remplace dans `store/annonces.md` et sur le site le texte « bientôt sur les boutiques » par le lien de la fiche Edge (donne-moi l'adresse, je fais la modification et je régénère les 37 pages).
