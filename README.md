<p align="center"><img src="docs/assets/icon-512.png" width="96" alt="Icône DevDocTrad"></p>

<h1 align="center">DevDocTrad</h1>

<p align="center"><b>Traduit fidèlement la documentation technique et les sites pour programmeurs, sans jamais toucher au code.</b><br>
Chrome · Edge · Brave · Firefox — gratuit — licence MIT</p>

<p align="center"><a href="https://devdoctrad.vercel.app/"><b>Site : devdoctrad.vercel.app</b></a> · <a href="#installation">Installation</a> · <a href="#créer-une-clé-gratuite">Créer une clé gratuite</a> · <a href="#utilisation">Utilisation</a> · <a href="#english">English</a></p>

![Page de documentation traduite par DevDocTrad](docs/assets/readme-hero.png)

Pour tous ceux qui galèrent avec une doc en anglais ou dans une autre langue : documentation officielle, README et issues GitHub, Stack Overflow, forums, blogs techniques, pages de frameworks.

- **Traduction fidèle**, phrase par phrase, sans résumé, sans omission, sans ajout. L'extension traduit, elle n'explique pas.
- **Le code reste intact** : commandes, noms de fonctions, API, chemins et URL ne sont jamais traduits. Les liens, le gras et les blocs `code` restent en place.
- **Dans ta langue** : par défaut, la langue de ton navigateur (français, russe, espagnol, japonais… 37 langues). Tu peux en choisir une autre dans les réglages.
- **Original ou bilingue** : remplace le texte, ou affiche la traduction sous chaque phrase. Un clic pour revenir à l'original exact.
- **Gratuit** : utilise les paliers gratuits de Gemini, Groq, Mistral et OpenRouter avec tes propres clés, ou un modèle local avec Ollama. Une clé payante est bloquée tant que tu n'as pas réglé un plafond.
- **La voix des vidéos traduite** (nouveau en 1.1) : tutoriels, conférences, YouTube… les sous-titres sont traduits en direct sur la vidéo. Sans sous-titres, la voix est transcrite gratuitement par Groq Whisper avec ta clé Groq gratuite. Nouveau en 1.2 : **doublage** sur n'importe quelle vidéo, la traduction est dite par une voix de synthèse du navigateur (gratuite), calée sur les sous-titres, pendant que le son d'origine est baissé.
- **Privé** : aucune statistique, aucun pistage. Tes clés restent dans ton navigateur.
- **Agréable à utiliser** : interface en verre façon Apple, thème clair, sombre ou automatique, badge très discret sur les pages.

---

## Installation

Sous Firefox, l'extension est publiée sur [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/devdoctrad/) : un clic suffit. Pour Chrome, Edge et Brave, elle n'est pas encore sur les boutiques : en attendant, l'installation se fait à la main, en quelques clics. Les fichiers prêts à installer sont sur la [page de la dernière version](https://github.com/jocravidd-droid/DevDocTrad/releases/latest) (et, pour la version actuelle, dans le dossier [`release/`](release/)).

### Chrome, Edge ou Brave

1. Télécharge le fichier `devdoctrad-chrome-<version>.zip` sur la [page de la dernière version](https://github.com/jocravidd-droid/DevDocTrad/releases/latest) (rubrique « Assets »). Lien direct vers la version actuelle : [devdoctrad-chrome-1.3.0.zip](https://github.com/jocravidd-droid/DevDocTrad/raw/main/release/devdoctrad-chrome-1.3.0.zip).
2. Décompresse ce fichier zip dans un dossier que tu garderas (par exemple `Documents/DevDocTrad`). Ne supprime pas ce dossier ensuite : le navigateur charge l'extension depuis lui.
3. Ouvre la page des extensions en tapant dans la barre d'adresse :
   - Chrome : `chrome://extensions`
   - Edge : `edge://extensions`
   - Brave : `brave://extensions`
4. Active le **Mode développeur** (interrupteur en haut à droite dans Chrome et Brave, dans la colonne de gauche dans Edge).
5. Clique sur **Charger l'extension non empaquetée**.
6. Choisis le dossier décompressé à l'étape 2 (celui qui contient le fichier `manifest.json`).
7. L'icône de DevDocTrad apparaît dans le menu des extensions (pièce de puzzle). Clique sur l'épingle à côté de DevDocTrad pour la garder visible dans la barre d'outils.

### Firefox

**Le plus simple** : ouvre la page [DevDocTrad sur addons.mozilla.org](https://addons.mozilla.org/firefox/addon/devdoctrad/) et clique sur **Ajouter à Firefox**. Les mises à jour arrivent ensuite toutes seules. Firefox version 140 ou plus récente est nécessaire.

**Ou à la main**, avec le zip (module temporaire, utile pour tester une version précise) :

1. Télécharge le fichier `devdoctrad-firefox-<version>.zip` sur la [page de la dernière version](https://github.com/jocravidd-droid/DevDocTrad/releases/latest) (rubrique « Assets »). Lien direct vers la version actuelle : [devdoctrad-firefox-1.3.0.zip](https://github.com/jocravidd-droid/DevDocTrad/raw/main/release/devdoctrad-firefox-1.3.0.zip).
2. Tape `about:debugging#/runtime/this-firefox` dans la barre d'adresse.
3. Clique sur **Charger un module complémentaire temporaire…**
4. Choisis le fichier zip téléchargé à l'étape 1.

Attention : un module chargé de cette façon est **temporaire** et disparaît à la fermeture du navigateur. Il faut refaire les étapes 2 à 4 à chaque démarrage ; la version d'addons.mozilla.org, elle, reste installée.

---

## Créer une clé gratuite

L'extension a besoin d'au moins une clé d'API (ou d'Ollama). Toutes les options ci-dessous sont **gratuites**. Tu peux en ajouter plusieurs : quand l'une atteint sa limite, l'extension passe automatiquement à la suivante, et jamais à une clé payante.

**Ne publie jamais une clé sur GitHub ou ailleurs.** Elle reste dans le stockage local de ton navigateur.

### Ajouter la clé dans l'extension

1. Clique sur l'icône DevDocTrad, puis sur la roue dentée (Réglages).
2. Dans l'onglet **Clés**, choisis le fournisseur dans la liste, puis clique sur **Ajouter**.
3. Colle ta clé dans le champ **Clé**.
4. Clique sur **Charger les modèles**, puis choisis un modèle dans la liste du champ **Modèle (pages simples)**.
5. Clique sur **Tester**. Le message « Clé valide » confirme que tout fonctionne.

### Gemini (Google)

1. Va sur [aistudio.google.com](https://aistudio.google.com/) et connecte-toi avec un compte Google.
2. Clique sur **Get API key**, puis **Create API key**.
3. **Ne lie aucun compte de facturation** : sans facturation, la clé reste gratuite et ne peut rien te coûter.
4. Copie la clé et ajoute-la dans l'extension (fournisseur Gemini).

À savoir : en gratuit, Google peut réutiliser les textes envoyés.

### Groq

1. Va sur [console.groq.com](https://console.groq.com/) et crée un compte (aucune carte demandée).
2. Ouvre **API Keys**, puis **Create API Key**.
3. Copie la clé et ajoute-la dans l'extension (fournisseur Groq).

Au-delà de la limite gratuite, Groq renvoie simplement une erreur, jamais une facture.

Modèle conseillé : `openai/gpt-oss-120b` (le meilleur en test réel) ; `openai/gpt-oss-20b` est plus rapide, un peu moins juste. Attention : la limite est **par compte Groq**, pas par clé. Plusieurs clés du même compte partagent la même limite ; pour que la bascule automatique serve à quelque chose, il faut des clés de comptes ou de fournisseurs différents.

### Mistral

1. Va sur [console.mistral.ai](https://console.mistral.ai/) et crée un compte.
2. Choisis le mode gratuit (aucune carte demandée).
3. Ouvre **API Keys**, puis crée une clé.
4. Copie la clé et ajoute-la dans l'extension (fournisseur Mistral).

À savoir : en gratuit, les requêtes peuvent servir à l'entraînement ; tu peux le désactiver dans la console Mistral.

### OpenRouter

1. Va sur [openrouter.ai](https://openrouter.ai/) et crée un compte.
2. Ouvre **Keys**, puis **Create Key**.
3. Copie la clé et ajoute-la dans l'extension (fournisseur OpenRouter).
4. Choisis **uniquement un modèle dont le nom finit par `:free`**. L'extension refuse les autres modèles en mode gratuit.

Limite gratuite : environ 50 requêtes par jour. N'achète jamais de crédit pour cette extension.

### Ollama (local, facultatif)

Ollama fait tourner un modèle sur ton ordinateur : gratuit, rien ne quitte ta machine, mais il faut un ordinateur assez puissant.

1. Installe Ollama depuis [ollama.com](https://ollama.com/download).
2. Ouvre un terminal et télécharge un modèle, par exemple : `ollama pull qwen2.5:7b`. Testés en vrai (carte graphique de 6 Go) : `qwen2.5:7b` (le meilleur, 36 langues), `qwen2.5:3b` (le plus rapide), `mistral:7b`, `llama3.2:3b`, `gemma3:4b`. Un petit modèle se trompe plus souvent ; l'extension laisse alors le passage en original plutôt que d'afficher une traduction douteuse.
3. Dans les réglages de l'extension, choisis **Ollama (local)** puis **Ajouter**, et accepte la permission demandée par le navigateur.
4. Clique sur **Charger les modèles**, choisis ton modèle, puis **Tester**.
5. Si le test affiche une erreur 403 : définis la variable d'environnement `OLLAMA_ORIGINS` avec la valeur `chrome-extension://*,moz-extension://*`, redémarre Ollama, puis clique à nouveau sur **Tester**.

Ollama est utilisé en secours quand toutes les clés gratuites sont en pause, et en premier sur les pages sensibles (banque, mail, connexion) quand tu les traduis à la main.

---

## Utilisation

- **Traduire une page** : clique sur l'icône DevDocTrad, puis sur **Traduire cette page**. Ou utilise le raccourci **Alt+Maj+T**.
- **Traduire la voix d'une vidéo** : sur une page avec une vidéo (ou un son, comme un podcast), active **Traduire la voix des vidéos** dans le popup, ou appuie sur **Alt+Maj+V**. Les sous-titres traduits s'affichent sur la vidéo ; la croix arrête tout. Pour une vidéo sans sous-titres, il faut une clé **Groq** gratuite (la transcription Whisper est incluse dans le palier gratuit de Groq). Plusieurs vidéos sur la page : celle qui joue est prise, sinon la plus grande visible. Les lecteurs en composants web (shadow DOM) sont pris en charge.
- **Voix traduite (doublage)** : sous l'interrupteur, trois choix : **Sous-titres**, **Sous-titres + voix traduite** (doublage), ou **Voix traduite seule (sans sous-titres)** : la bande ne montre alors plus de texte, seulement sa petite barre (message, haut-parleur, vitesse, fermer). La traduction est dite par la meilleure voix de synthèse disponible pour la langue choisie (gratuit, aucun service payant), au début de chaque sous-titre et un peu plus vite si la phrase est longue ; le son d'origine descend à environ 15 % pendant que la voix parle. C'est l'extension elle-même qui parle (Chrome, Edge, Brave : `chrome.tts` ; Firefox : synthèse vocale de sa page de fond) : aucun clic dans la page n'est nécessaire. Pause de la vidéo = pause de la voix ; un saut dans la vidéo fait repartir la voix au bon sous-titre. Le bouton haut-parleur de la bande active ou coupe la voix à tout moment (en « voix seule », couper la voix fait revenir les sous-titres). Si ton système n'a aucune voix pour la langue choisie, un message le dit et les sous-titres restent. La qualité de la voix dépend du système et du navigateur (Edge et Chrome proposent souvent des voix « Online » ou « Google » plus naturelles ; sous Linux, il faut parfois installer des voix).
- **Vitesse de la voix** : boutons **−** et **+** dans la barre de la bande (la valeur s'affiche, par exemple « 1,2× »), appliqués dès la phrase suivante, ou curseur **Vitesse de la voix traduite** dans Réglages > **Traduction** (0,5× à 2×, par pas de 0,1). Le réglage multiplie le calage automatique sur la durée des sous-titres.
- **Vidéo intégrée d'un autre site** (YouTube, Vimeo, Dailymotion, Wistia, Loom… dans un cadre) : la bande propose **Ouvrir la vidéo dans un onglet** ; la traduction marche dans ce nouvel onglet. Les vidéos protégées (DRM, comme Netflix) ne donnent pas accès à leur son.
- **Revenir à l'original** : bouton **Voir l'original** dans le petit badge en bas à droite de la page, dans le popup, ou de nouveau **Alt+Maj+T**.
- **Traduire automatiquement un site** : sur un site que tu lis souvent, ouvre le popup et active **Traduire automatiquement ce site**. Le navigateur te demande la permission pour ce site uniquement.
- **Changer de langue** : directement dans le popup (menu **Langue cible**, 37 langues), ou dans Réglages > **Traduction**. Par défaut : la langue de ton navigateur.
- **Mode bilingue** : Réglages, onglet **Traduction**, **Affichage**, **Bilingue**.
- **Glossaire** : Réglages, onglet **Glossaire**, pour les termes à ne jamais traduire ou à toujours traduire d'une certaine façon.
- **Thème clair ou sombre** : Réglages, section **Apparence** (Système, Clair ou Sombre).
- **Changer le raccourci** : Chrome, `chrome://extensions/shortcuts` ; Firefox, gestionnaire de modules, roue dentée, « Gérer les raccourcis ».

Pages jamais traduites automatiquement : pages avec un champ mot de passe, banques, mails, pages de connexion (liste modifiable dans les réglages). Le bouton manuel fonctionne quand même.

Pages qu'aucune extension ne peut traduire : pages internes du navigateur (`chrome://`, `about:`), boutiques d'extensions, lecteur PDF intégré.

---

## Pour les développeurs

Prérequis : Python 3.8 ou plus récent, Node.js 20 ou plus récent (seulement pour les tests).

```bash
python3 build.py
```

Cette commande reconstruit `dist/chrome`, `dist/firefox`, les deux zips, les copies dans `release/` et affiche leurs empreintes SHA-256.

```bash
npm install
```

```bash
npm test
```

Les tests automatiques (Node + jsdom) utilisent de faux fournisseurs : aucun appel réseau réel.

```bash
node tools/e2e.js
```

```bash
node tools/e2e_voice.js
```

Le second vérifie la traduction de la voix des vidéos dans un vrai Chromium (vidéo de démo, sous-titres, son transcrit par un faux Groq).

```bash
node tools/e2e_firefox.js
```

Le troisième fait la même chose dans un vrai Firefox (140 ou plus récent ; `FIREFOX_BIN=/chemin/firefox` si Firefox n'est pas dans le PATH), sans aucune dépendance : il pilote Firefox par son protocole intégré (WebDriver BiDi).

```bash
python3 tools/build_site.py
```

Régénère le site `docs/` dans les 37 langues à partir de `tools/site/<langue>.json` (un fichier de textes par langue, mêmes clés que `fr.json`). Les tests vérifient que `docs/` est à jour.

Test de bout en bout dans un vrai Chromium (Playwright), avec une page de démo et un faux serveur Ollama local. `tools/e2e.js` et `tools/e2e_voice.js` écrivent leurs captures d'écran dans un dossier temporaire (chemin affiché à la fin) ; pour mettre à jour les captures suivies du dépôt (`store/screenshots/` et `docs/assets/`), lance-les avec `DDT_SHOTS=1`, par exemple `DDT_SHOTS=1 node tools/e2e.js`. Autres scripts : `node tools/qa_shots.js` (captures de contrôle du popup et du badge), `node tools/export_logo.js` (exports du logo), `node tools/promo.js` (images promotionnelles).

Historique des versions : [CHANGELOG.md](CHANGELOG.md). Une mise à jour (correctifs et améliorations) est préparée tous les 15 jours.

Organisation : `src/` (code de l'extension), `manifests/` (manifestes Chrome et Firefox), `tests/`, `tools/` (icônes, textes de l'interface, démo, test de bout en bout), `docs/` (site), `store/` (fiches des boutiques), `PLAN.md` (cahier des charges), `design/` (direction artistique, spécification, logo, contrôle visuel).

Les textes de l'interface se modifient dans `tools/gen_locales.py` (français et anglais) et `tools/locales/<langue>.json` (34 autres langues), puis `python3 tools/gen_locales.py`.

## Licence

MIT : chacun peut reprendre, modifier et redistribuer ce code, y compris dans un autre projet, à condition de garder la mention de licence. Voir [LICENSE](LICENSE).

## Confidentialité

Voir [PRIVACY.md](PRIVACY.md). En bref : le texte des pages que tu traduis part uniquement vers le fournisseur que tu as choisi (ou reste sur ta machine avec Ollama). Aucune donnée n'est envoyée au développeur.

---

## English

**DevDocTrad faithfully translates developer documentation and programming websites, without ever touching the code.** By default it translates into your browser's language (37 languages available); you can pick another one in the settings.

- Sentence by sentence, no summary, no omission, no addition.
- Code, commands, function names, APIs, paths and URLs are never translated; links, bold text and `code` elements stay in place.
- Replace mode or bilingual mode, one click back to the exact original.
- Free: uses the free tiers of Gemini, Groq, Mistral and OpenRouter with your own keys, or a local model with Ollama. Paid keys are blocked until you set a daily cap.
- New in 1.1: translates the voice of videos (tutorials, talks, YouTube) into live subtitles; videos without subtitles are transcribed for free with Groq Whisper (your free Groq key); optional read-aloud.
- New in 1.2: **dubbing** on any video: the translation is spoken by your browser's built-in speech synthesis (free), timed to the subtitles, while the original sound is lowered.
- No analytics, no tracking. Keys stay in your browser's local storage.

### Install (Chrome, Edge, Brave)

1. Download `devdoctrad-chrome-<version>.zip` from the [latest release page](https://github.com/jocravidd-droid/DevDocTrad/releases/latest) ("Assets"), or directly: [devdoctrad-chrome-1.3.0.zip](https://github.com/jocravidd-droid/DevDocTrad/raw/main/release/devdoctrad-chrome-1.3.0.zip). Unzip it into a folder you will keep.
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder (the one containing `manifest.json`).

### Install (Firefox 140+)

Install it from [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/devdoctrad/) (click **Add to Firefox**; updates are automatic).

Or by hand, as a temporary add-on:

1. Download `devdoctrad-firefox-<version>.zip` from the [latest release page](https://github.com/jocravidd-droid/DevDocTrad/releases/latest) ("Assets"), or directly: [devdoctrad-firefox-1.3.0.zip](https://github.com/jocravidd-droid/DevDocTrad/raw/main/release/devdoctrad-firefox-1.3.0.zip).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select the zip file. (Temporary: it is removed when Firefox closes.)

### Add a free key

Open the settings (gear icon in the popup), **Keys** tab, choose a provider, click **Add**, paste your key, click **Load models**, pick a model, then **Test**. Free keys: [Google AI Studio](https://aistudio.google.com/) (do not link billing), [Groq](https://console.groq.com/), [Mistral](https://console.mistral.ai/) (free mode), [OpenRouter](https://openrouter.ai/) (only models ending with `:free`), or [Ollama](https://ollama.com/download) locally. Never publish a key.

### Use

Click the toolbar icon, then **Translate this page**, or press **Alt+Shift+T**. Press it again to go back to the original. For a video (or an audio player such as a podcast), turn on **Translate the voice in videos** in the popup or press **Alt+Shift+V**. With several videos, the one playing is used, otherwise the largest visible one; players built with web components (shadow DOM) work too.

**Translated voice (dubbing)**: under the switch, three choices: **Subtitles**, **Subtitles + translated voice** (dubbing), or **Translated voice only (no subtitles)**: the bar then shows no text, only its small control strip (message, speaker, speed, close). The translation is spoken by the best speech voice available for the target language (free, no paid service), at the start of each subtitle and slightly faster when the sentence is long; the original sound drops to about 15% while the voice speaks. The extension itself speaks (Chrome, Edge, Brave: `chrome.tts`; Firefox: speech synthesis of its background page), so no click in the page is needed. Pausing the video pauses the voice, and seeking restarts it at the right subtitle. The speaker button turns the voice on or off at any time (in "voice only", turning it off brings the subtitles back). If your system has no voice for the target language, a message says so and the subtitles stay. Voice quality depends on your system and browser (Edge and Chrome often offer more natural "Online" or "Google" voices; on Linux you may need to install voices).

**Voice speed**: **−** and **+** buttons on the bar (the value is shown, e.g. "1.2×"), applied from the next sentence, or the **Translated voice speed** slider in Settings > **Translation** (0.5× to 2×, in steps of 0.1). It multiplies the automatic fit to the subtitle duration.

**Video embedded from another site** (YouTube, Vimeo, Dailymotion, Wistia, Loom… in a frame): the bar offers **Open the video in a tab**, where translation works. Protected videos (DRM, e.g. Netflix) do not give access to their sound.

Website in 37 languages: https://devdoctrad.vercel.app/en/
