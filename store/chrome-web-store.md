# DevDocTrad : fiche Chrome Web Store

Textes prêts à copier pour publier DevDocTrad sur le Chrome Web Store, en français et en anglais, puis la marche à suivre complète.

État : l’extension n’est pas encore publiée. Le paquet à envoyer est `release/devdoctrad-chrome-1.0.0.zip`. L’inscription au Chrome Web Store coûte 5 dollars, une seule fois : c’est toi qui décides quand payer.

Astuce : sur GitHub, chaque bloc de texte a un bouton de copie en haut à droite. Copie le bloc entier et colle-le tel quel dans le champ indiqué.

Sommaire :

1. Nom
2. Description courte
3. Description détaillée
4. Catégorie et langue
5. Objet unique (single purpose)
6. Justification des permissions
7. Code distant
8. Utilisation des données
9. Politique de confidentialité et liens
10. Instructions de test pour les relecteurs
11. Images : icône, captures d’écran, image promotionnelle
12. Marche à suivre (français)
13. Submission checklist (English)

---

## 1. Nom

Le nom vient du manifeste (`__MSG_extName__` dans `_locales/fr` et `_locales/en`). Il ne se modifie pas dans le tableau de bord.

```text
DevDocTrad
```

## 2. Description courte

La description courte (132 caractères au maximum) vient aussi du manifeste : champ `extDescription` de `src/_locales/fr/messages.json` et `src/_locales/en/messages.json`. Le tableau de bord l’affiche mais ne permet pas de la modifier. Pour la changer, il faut modifier ces fichiers, relancer `python3 build.py` et renvoyer le zip.

### 2.1 Français : 106 caractères sur 132

```text
Traduit fidèlement la documentation technique et les sites pour programmeurs, sans jamais toucher au code.
```

### 2.2 English: 103 characters out of 132

```text
Faithfully translates developer documentation and programming websites, without ever touching the code.
```

## 3. Description détaillée

Le Chrome Web Store affiche la description en texte brut (pas de gras, pas de liens cliquables). Les tirets restent visibles comme des puces.

### 3.1 Description détaillée (français)

```text
Traduit fidèlement la documentation technique et les sites pour programmeurs, sans jamais toucher au code.

DevDocTrad est pour toutes celles et ceux qui lisent une documentation dans une langue qu’ils maîtrisent mal : documentation officielle, README et issues GitHub, Stack Overflow, forums, blogs techniques, pages de frameworks.

Ce que fait l’extension
- Traduction fidèle, phrase par phrase, dans le même ordre : pas de résumé, pas d’omission, pas d’ajout.
- Par défaut, aucune explication n’est ajoutée. L’extension traduit, elle n’explique pas.
- Le code n’est jamais traduit : commandes, noms de fonctions, API, chemins et URL restent tels quels.
- Les liens, le gras et les éléments de code restent à leur place.
- Langue cible : celle du navigateur par défaut (37 langues disponibles), modifiable dans les réglages.
- Deux affichages : remplacer le texte, ou mode bilingue avec la traduction sous chaque phrase.
- Retour à l’original exact en un clic, ou avec le raccourci Alt+Maj+T.
- Traduction automatique sur les sites que tu choisis. Le navigateur demande l’autorisation site par site.
- Glossaire personnel : termes à ne jamais traduire, ou à toujours traduire de la même façon.
- Interface en 36 langues, selon la langue du navigateur (arabe, hébreu et persan de droite à gauche).

Gratuit, avec tes propres clés
- DevDocTrad est gratuite et open source (licence MIT).
- Elle utilise tes propres clés d’API gratuites : Google Gemini, Groq, Mistral, OpenRouter (uniquement les modèles dont le nom finit par :free), ou un modèle local avec Ollama.
- Quand une clé gratuite atteint sa limite, l’extension passe à une autre clé gratuite ou à Ollama, jamais à une clé payante.
- Une clé payante reste bloquée tant que tu n’as pas réglé toi-même un plafond journalier et les prix.

Confidentialité
- Le texte de la page que tu traduis est envoyé uniquement au fournisseur que tu as choisi. Rien n’est envoyé au développeur de DevDocTrad.
- Chaque fournisseur a ses propres conditions. En palier gratuit, Google Gemini et Mistral peuvent réutiliser les textes envoyés. Avec Ollama, le texte reste sur ton ordinateur : c’est le choix à privilégier pour les pages privées.
- Les pages sensibles (champ mot de passe, banques, mails, pages de connexion) ne sont jamais traduites automatiquement. Le bouton manuel fonctionne quand même.
- Aucune statistique, aucun pistage, aucune publicité.
- Les clés, les réglages et le cache restent dans le stockage local du navigateur. Ils ne sont jamais synchronisés.

Sites visés
Documentations officielles (MDN, Python, Rust, sites générés par Sphinx, Read the Docs, Docusaurus, MkDocs), GitHub (README, issues, discussions), Stack Overflow et Stack Exchange, forums Discourse et Reddit, blogs techniques, pages de frameworks JavaScript.

Limites
Aucune extension ne peut traduire les pages internes du navigateur, les boutiques d’extensions ni le lecteur PDF intégré.

Mise en route
1. Crée une clé gratuite (par exemple sur console.groq.com, sans carte bancaire).
2. Clique sur l’icône DevDocTrad, puis sur la roue dentée (Réglages).
3. Onglet Clés : choisis le fournisseur, clique sur Ajouter, colle la clé, clique sur Charger les modèles, choisis un modèle, puis clique sur Tester.
4. Sur une page de documentation, clique sur l’icône puis sur Traduire cette page, ou appuie sur Alt+Maj+T.

Code source et aide : https://github.com/jocravidd-droid/DevDocTrad
Politique de confidentialité : https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md
```

### 3.2 Detailed description (English)

```text
Faithfully translates developer documentation and programming websites, without ever touching the code.

DevDocTrad is for anyone reading documentation in a language they are not comfortable with: official docs, GitHub READMEs and issues, Stack Overflow, forums, technical blogs, framework sites.

What it does
- Faithful translation, sentence by sentence, in the same order: no summary, no omission, no addition.
- By default, no explanations are added. The extension translates; it does not explain.
- Code is never translated: commands, function names, APIs, paths and URLs stay as they are.
- Links, bold text and code elements stay in place.
- Target language: your browser language by default (37 languages available), changeable in the settings.
- Two display modes: replace the text, or bilingual mode with the translation under each sentence.
- One click, or the Alt+Shift+T shortcut, brings back the exact original.
- Automatic translation on the sites you choose. The browser asks for permission one site at a time.
- Personal glossary: terms to never translate, or to always translate the same way.
- Interface in 36 languages, following the browser (Arabic, Hebrew and Persian right to left).

Free, with your own keys
- DevDocTrad is free and open source (MIT license).
- It uses your own free API keys: Google Gemini, Groq, Mistral, OpenRouter (only models whose name ends with :free), or a local model with Ollama.
- When a free key reaches its limit, the extension moves to another free key or to Ollama, never to a paid key.
- A paid key stays blocked until you set a daily cap and prices yourself.

Privacy
- The text of the page you translate is sent only to the provider you chose. Nothing is sent to the DevDocTrad developer.
- Each provider has its own terms. On free tiers, Google Gemini and Mistral may reuse the text sent. With Ollama, the text stays on your computer: prefer it for private pages.
- Sensitive pages (password fields, banks, mail, sign-in pages) are never translated automatically. The manual button still works.
- No analytics, no tracking, no ads.
- Keys, settings and cache stay in the browser's local storage. They are never synced.

Designed for
Official documentation (MDN, Python, Rust, Sphinx sites, Read the Docs, Docusaurus, MkDocs), GitHub (READMEs, issues, discussions), Stack Overflow and Stack Exchange, Discourse and Reddit forums, technical blogs, JavaScript framework sites.

Limits
No extension can translate browser internal pages, extension stores or the built-in PDF viewer.

Getting started
1. Create a free key (for example at console.groq.com, no credit card needed).
2. Click the DevDocTrad icon, then the gear icon (Settings).
3. Keys tab: choose the provider, click Add, paste the key, click Load models, pick a model, then click Test.
4. On a documentation page, click the icon then Translate this page, or press Alt+Shift+T.

Source code and help: https://github.com/jocravidd-droid/DevDocTrad
Privacy policy: https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md
```

## 4. Catégorie et langue

| Champ | Valeur |
|---|---|
| Catégorie (Category) | Outils de développement (Developer Tools) |
| Langue principale (Language) | Anglais (English). C’est la langue par défaut du paquet (`default_locale` : `en`). |
| Fiche traduite | Français (French). Le paquet contient `_locales/fr`, le tableau de bord propose donc une fiche française. |

## 5. Objet unique (single purpose)

Le formulaire est relu en anglais : colle la version anglaise. La version française sert de référence.

English (to paste):

```text
DevDocTrad translates the text of technical web pages (developer documentation and programming websites) into the user's language, directly on the page, while leaving code, commands, function names, APIs, paths and URLs untouched.
```

Français (référence) :

```text
DevDocTrad traduit le texte des pages web techniques (documentation pour développeurs et sites de programmation) dans la langue de l’utilisateur, directement sur la page, sans toucher au code, aux commandes, aux noms de fonctions, aux API, aux chemins ni aux URL.
```

## 6. Justification des permissions

Le tableau de bord affiche un champ par permission du manifeste, plus un champ pour les autorisations d’hôtes. Colle la version anglaise. Chaque texte tient sous la limite de 1 000 caractères.

### 6.1 storage

English (to paste):

```text
Stores the user's settings (target language, display mode, sites chosen for automatic translation, sensitive-page list), personal glossary, and the API keys the user enters, in chrome.storage.local on the user's device. This data is never synced and never sent to the developer.
```

Français (référence) :

```text
Enregistre les réglages de l’utilisateur (langue cible, mode d’affichage, sites choisis pour la traduction automatique, liste des pages sensibles), son glossaire personnel et les clés d’API qu’il saisit, dans chrome.storage.local, sur son appareil. Ces données ne sont jamais synchronisées ni envoyées au développeur.
```

### 6.2 unlimitedStorage

English (to paste):

```text
The extension keeps a local cache of translations, so that a page already translated is shown again without a new request to the provider. This saves the user's free quota. The cache is limited by the extension itself (about 20 MB), but together with settings and glossary it can exceed the default 10 MB quota of chrome.storage.local, which would make saving fail. The cache can be cleared at any time in Settings, Data tab.
```

Français (référence) :

```text
L’extension garde un cache local des traductions : une page déjà traduite s’affiche à nouveau sans nouvelle requête au fournisseur, ce qui économise le quota gratuit de l’utilisateur. Le cache est limité par l’extension elle-même (environ 20 Mo), mais avec les réglages et le glossaire il peut dépasser le quota par défaut de 10 Mo de chrome.storage.local, ce qui ferait échouer l’enregistrement. Le cache se vide à tout moment dans les Réglages, onglet Données.
```

### 6.3 activeTab

English (to paste):

```text
When the user clicks "Translate this page" in the popup or presses the keyboard shortcut, the extension gets temporary access to the current tab only, to read its visible text and insert the translation. It has no access to other tabs, and no access to the page without this user action.
```

Français (référence) :

```text
Quand l’utilisateur clique sur « Traduire cette page » dans le popup ou utilise le raccourci clavier, l’extension obtient un accès temporaire à l’onglet actif uniquement, pour lire son texte visible et y insérer la traduction. Elle n’a aucun accès aux autres onglets, ni à la page sans cette action de l’utilisateur.
```

### 6.4 scripting

English (to paste):

```text
Used together with activeTab to inject the extension's own packaged scripts (shared.js and content.js) into the current tab when the user asks for a translation. Also used to register the packaged script auto.js only on the sites the user explicitly added to "Translate this site automatically", after the browser granted permission for that site. No remote code is ever injected.
```

Français (référence) :

```text
Utilisée avec activeTab pour injecter dans l’onglet actif les scripts fournis dans le paquet (shared.js et content.js) quand l’utilisateur demande une traduction. Sert aussi à enregistrer le script du paquet auto.js uniquement sur les sites que l’utilisateur a ajoutés lui-même avec « Traduire automatiquement ce site », après l’autorisation du navigateur pour ce site. Aucun code distant n’est jamais injecté.
```

### 6.5 Autorisations d’hôtes (host permissions)

Le tableau de bord n’a souvent qu’un seul champ pour toutes les autorisations d’hôtes. Colle ce texte, qui couvre `host_permissions` et `optional_host_permissions`.

English (to paste):

```text
host_permissions (4 API endpoints): the text of the page the user chose to translate is sent to the translation provider the user configured with their own API key: generativelanguage.googleapis.com (Google Gemini), api.groq.com (Groq), api.mistral.ai (Mistral), openrouter.ai (OpenRouter). They are used only for API requests from the extension's background script, only to providers for which the user added a key. The extension does not read or modify web pages on these domains.

optional_host_permissions *://*/*: never granted at install. Requested at runtime for one site at a time (that site and its subdomains), only when the user turns on "Translate this site automatically" for that site in the popup. The browser shows its permission prompt for that single site. Removing the site from the list removes the permission.

optional_host_permissions http://localhost:11434/* and http://127.0.0.1:11434/*: requested only when the user adds an Ollama (local) key in the settings, to send text to the Ollama server running on the user's own computer. That text does not leave the computer.
```

Français (référence) :

```text
host_permissions (4 points d’accès d’API) : le texte de la page que l’utilisateur a choisi de traduire est envoyé au fournisseur de traduction qu’il a configuré avec sa propre clé d’API : generativelanguage.googleapis.com (Google Gemini), api.groq.com (Groq), api.mistral.ai (Mistral), openrouter.ai (OpenRouter). Ces autorisations servent uniquement aux requêtes d’API du script d’arrière-plan, et uniquement vers les fournisseurs pour lesquels l’utilisateur a ajouté une clé. L’extension ne lit ni ne modifie les pages web de ces domaines.

optional_host_permissions *://*/* : jamais accordée à l’installation. Demandée pendant l’utilisation, pour un seul site à la fois (ce site et ses sous-domaines), uniquement quand l’utilisateur active « Traduire automatiquement ce site » dans le popup. Le navigateur affiche sa demande d’autorisation pour ce seul site. Retirer le site de la liste retire l’autorisation.

optional_host_permissions http://localhost:11434/* et http://127.0.0.1:11434/* : demandées uniquement quand l’utilisateur ajoute une clé Ollama (local) dans les réglages, pour envoyer le texte au serveur Ollama qui tourne sur son propre ordinateur. Ce texte ne quitte pas l’ordinateur.
```

### 6.6 commands

`commands` est une clé du manifeste, pas une permission : le tableau de bord ne demande en général pas de justification. Si un champ ou un relecteur la demande, colle ce texte.

English (to paste):

```text
Declares one keyboard shortcut, Alt+Shift+T, to translate the current page or go back to the original. The user can change or remove it at chrome://extensions/shortcuts.
```

Français (référence) :

```text
Déclare un seul raccourci clavier, Alt+Maj+T, pour traduire la page actuelle ou revenir à l’original. L’utilisateur peut le changer ou le supprimer dans chrome://extensions/shortcuts.
```

## 7. Code distant

Question : « Utilisez-vous du code distant ? » (Are you using remote code?)

Réponse : **Non** (No).

Si un champ de justification apparaît, English (to paste):

```text
No. All JavaScript is included in the package. The extension does not load or run code from the Internet and does not use eval. Responses from the translation APIs are data (translated text), never executed.
```

Français (référence) :

```text
Non. Tout le JavaScript est inclus dans le paquet. L’extension ne charge ni n’exécute aucun code venant d’Internet et n’utilise pas eval. Les réponses des API de traduction sont des données (du texte traduit), jamais exécutées.
```

## 8. Utilisation des données

Formulaire « Pratiques de confidentialité » (Privacy practices), partie « Utilisation des données » (Data usage).

### 8.1 Types de données collectées

| Type de donnée (libellé anglais) | Réponse | Pourquoi |
|---|---|---|
| Informations permettant d’identifier personnellement l’utilisateur (Personally identifiable information) | Non | Aucun nom, aucune adresse e-mail, aucun identifiant n’est demandé ni envoyé. |
| Informations de santé (Health information) | Non | Aucune. |
| Informations financières et de paiement (Financial and payment information) | Non | Aucune. |
| Informations d’authentification (Authentication information) | Non | Voir la remarque ci-dessous. |
| Communications personnelles (Personal communications) | Non | Les pages de mail ne sont jamais traduites automatiquement. Si l’utilisateur traduit une page à la main, son texte relève de « Contenu du site Web ». |
| Localisation (Location) | Non | Aucune. |
| Historique Web (Web history) | Non | L’adresse de la page n’est pas envoyée au fournisseur. La liste des sites choisis pour la traduction automatique reste dans le stockage local. |
| Activité de l’utilisateur (User activity) | Non | Aucune statistique, aucun pistage. |
| Contenu du site Web (Website content) | **Oui** | Le texte de la page que l’utilisateur traduit est envoyé uniquement au fournisseur de traduction qu’il a choisi (Google Gemini, Groq, Mistral, OpenRouter), ou à Ollama sur son propre ordinateur. Rien n’est envoyé au développeur. |

Remarque sur les clés d’API : la clé que l’utilisateur saisit reste dans le stockage local du navigateur. Elle est envoyée uniquement au fournisseur qui l’a délivrée, dans l’en-tête de la requête, pour authentifier la requête de l’utilisateur lui-même. Le développeur ne la reçoit jamais. Si tu préfères être plus transparent, tu peux aussi cocher « Informations d’authentification » avec la même explication ; cela ne change rien au reste du formulaire.

### 8.2 Engagements à cocher

Coche les trois cases :

| Engagement (libellé anglais) | Réponse |
|---|---|
| Je ne vends pas et ne transfère pas les données des utilisateurs à des tiers, en dehors des cas d’usage approuvés (I do not sell or transfer user data to third parties, outside of the approved use cases) | Coché. Les données ne sont pas vendues. Le seul transfert est l’envoi du texte au fournisseur choisi par l’utilisateur, nécessaire à la traduction demandée. |
| Je n’utilise pas et ne transfère pas les données des utilisateurs à des fins sans rapport avec l’objet unique de l’extension (I do not use or transfer user data for purposes that are unrelated to my item's single purpose) | Coché. Le texte sert uniquement à la traduction. |
| Je n’utilise pas et ne transfère pas les données des utilisateurs pour déterminer leur solvabilité ou pour des prêts (I do not use or transfer user data to determine creditworthiness or for lending purposes) | Coché. |

### 8.3 Data usage (English summary)

- Website content collected: **Yes**. The text of the page the user translates is sent only to the translation provider the user chose (Google Gemini, Groq, Mistral, OpenRouter), or to Ollama on the user's own computer. Nothing is sent to the developer.
- All other data types: **No**. The API key entered by the user stays in local storage and is sent only to the provider that issued it, in the request header.
- Not sold to third parties: **certified**.
- Not used or transferred for purposes unrelated to the single purpose: **certified**.
- Not used or transferred to determine creditworthiness or for lending: **certified**.

## 9. Politique de confidentialité et liens

| Champ | Valeur |
|---|---|
| URL de la politique de confidentialité (Privacy policy URL) | `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md` |
| Page d’accueil (Homepage URL) | `https://devdoctrad.vercel.app/` une fois GitHub Pages activé ; sinon `https://github.com/jocravidd-droid/DevDocTrad` |
| Assistance (Support URL) | `https://github.com/jocravidd-droid/DevDocTrad/issues` |
| Contenu pour adultes (Mature content) | Non |

## 10. Instructions de test pour les relecteurs

Si le tableau de bord a un onglet « Instructions de test » (Test instructions), colle ce texte. Il permet au relecteur de tester sans payer.

English (to paste):

```text
DevDocTrad needs an API key from a translation provider chosen by the user. All providers below have a free tier.

1. Create a free Groq key at https://console.groq.com (no credit card needed): API Keys, then Create API Key.
2. Click the DevDocTrad toolbar icon, then the gear icon (Settings).
3. Keys tab: choose Groq in the list, click Add, paste the key, click Load models, pick a model in "Model (simple pages)", then click Test. The message "Valid key, ... models available." confirms it works.
4. Translation tab: by default the target language is the browser language. If the browser is in English, set "Target language" to another language (for example French) so that English pages are translated.
5. Open a documentation page, for example https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction, click the toolbar icon, then "Translate this page" (or press Alt+Shift+T).
6. Code elements, commands and URLs stay untouched. Click "Show original" in the badge at the bottom right, or press Alt+Shift+T again, to go back to the original.
```

Les libellés cités (« Translate this page », « Load models », « Model (simple pages) », « Target language », « Show original ») sont ceux de l’interface anglaise de la version 1.0.0.

Option : tu peux créer une clé Groq gratuite réservée à l’examen, l’ajouter à la fin de ces instructions, puis la supprimer dans la console Groq une fois l’extension publiée. N’y mets jamais une clé que tu utilises toi-même, ni une clé liée à un moyen de paiement.

## 11. Images

| Élément | Fichier | Taille | Statut |
|---|---|---|---|
| Icône de la boutique | `store/icon-128.png` | 128 x 128 | Prêt |
| Capture 1 | `store/screenshots/screenshot-1-traduction-fr.png` | 1280 x 800 | Prête |
| Capture 2 | `store/screenshots/screenshot-2-bilingue.png` | 1280 x 800 | Prête |
| Capture 3 | `store/screenshots/screenshot-3-reglages.png` | 1280 x 800 | Prête |
| Capture 4 | `store/screenshots/screenshot-4-russe.png` | 1280 x 800 | Prête |
| Capture 5 | `store/screenshots/screenshot-5-github-reel.png` | 1280 x 800 | Prête (vraie page GitHub, vraie traduction par Groq) |
| Petite image promotionnelle (Small promo tile) | à créer, par exemple `store/promo-440x280.png` | 440 x 280 | **Manquante** |

Les captures ont été faites sur une page de documentation de démonstration (« Nimbus HTTP »), avec un modèle local simulé et l’option « traduire les commentaires du code » activée (elle est désactivée par défaut). C’est pour ça que le commentaire du bloc de code apparaît traduit ; le code lui-même ne change pas. Plus tard, des captures sur des pages réelles (MDN, GitHub, Stack Overflow) seront plus parlantes.

### 11.1 Légendes des captures (français)

1. `screenshot-1-traduction-fr.png` : « Une page de documentation traduite en français : les commandes, les noms de fonctions et les URL restent identiques. »
2. `screenshot-2-bilingue.png` : « Mode bilingue : la traduction s’affiche sous chaque phrase originale. »
3. `screenshot-3-reglages.png` : « Réglages : tes propres clés gratuites (Gemini, Groq, Mistral, OpenRouter) ou Ollama en local. »
4. `screenshot-4-russe.png` : « La langue cible se change dans les réglages : ici, la même page en russe. »

### 11.2 Screenshot captions (English)

1. `screenshot-1-traduction-fr.png`: "A documentation page translated into French: commands, function names and URLs stay the same."
2. `screenshot-2-bilingue.png`: "Bilingual mode: the translation appears under each original sentence."
3. `screenshot-3-reglages.png`: "Settings: your own free keys (Gemini, Groq, Mistral, OpenRouter) or local Ollama."
4. `screenshot-4-russe.png`: "The target language can be changed in the settings: here, the same page in Russian."
5. `screenshot-5-github-reel.png`: "A real GitHub README translated: commands and code samples stay untouched."

Le Chrome Web Store n’a pas de champ de légende par capture : ces textes servent pour AMO, le site et les annonces. Garde-les quand même ici, dans l’ordre d’envoi des captures.

---

## 12. Marche à suivre (français)

Chaque étape se fait dans l’ordre. Les libellés du tableau de bord peuvent changer légèrement avec le temps : cherche le libellé le plus proche.

### A. Préparer les fichiers sur ton ordinateur

1. Ouvre un terminal dans le dossier du dépôt (le dossier qui contient `build.py`).
2. Tape `npm install` puis appuie sur Entrée. Attends la fin de l’installation.
3. Tape `npm test` puis appuie sur Entrée. Tous les tests doivent passer (aucune ligne « fail » à la fin). Si un test échoue, ne publie pas : corrige d’abord.
4. Tape `python3 build.py` puis appuie sur Entrée. Le script reconstruit les paquets et affiche une ligne « sha256 » par paquet.
5. Ouvre le dossier `release/` et vérifie que le fichier `devdoctrad-chrome-1.0.0.zip` est présent. C’est le seul fichier que tu enverras au Chrome Web Store.
6. Crée la petite image promotionnelle de 440 x 280 pixels (PNG ou JPEG), par exemple à partir du logo du dossier `design/logo/`. Enregistre-la dans `store/promo-440x280.png`. Elle est obligatoire pour publier.
7. Ouvre dans ton navigateur l’adresse `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md`. La politique de confidentialité doit s’afficher. Si la page est introuvable, envoie d’abord `PRIVACY.md` sur la branche `main` du dépôt public.

### B. Créer le compte développeur

8. Ouvre `https://myaccount.google.com/security` avec le compte Google que tu veux utiliser pour publier. Dans « Validation en deux étapes », active-la si ce n’est pas déjà fait. Elle est obligatoire pour publier sur le Chrome Web Store.
9. Ouvre `https://chrome.google.com/webstore/devconsole` et connecte-toi avec ce même compte Google.
10. Lis et accepte le contrat du développeur (Developer Agreement).
11. Paie les frais d’inscription de 5 dollars (une seule fois, pour toutes tes futures extensions). Fais-le seulement quand tu as décidé de publier.
12. Ouvre l’onglet « Compte » (Account) dans la colonne de gauche. Remplis le nom d’éditeur (Publisher name) : c’est le nom affiché publiquement sous l’extension, par exemple ton pseudo.
13. Toujours dans « Compte », renseigne une adresse e-mail de contact, puis clique sur le lien de vérification que tu reçois par e-mail. Sans vérification, tu ne peux pas publier.
14. Si le tableau de bord te demande de déclarer si tu es un « professionnel » (trader) au sens de la réglementation européenne, lis l’explication affichée. Pour une extension gratuite publiée à titre personnel, sans revenu, la réponse est en général « non professionnel » (non-trader). En cas de doute, choisis selon ta situation réelle.
15. Clique sur « Enregistrer » (Save) en bas de la page « Compte ».

### C. Envoyer le paquet

16. Dans la colonne de gauche, clique sur « Éléments » (Items), puis sur le bouton « Nouvel élément » (New item).
17. Clique sur « Parcourir » (Browse files) et choisis `release/devdoctrad-chrome-1.0.0.zip`. N’envoie pas le dossier décompressé : seulement le zip.
18. Attends la fin de l’envoi. La page de l’élément s’ouvre, avec plusieurs onglets à gauche : « Paquet » (Package), « Fiche Play Store » ou « Fiche de la boutique » (Store listing), « Pratiques de confidentialité » (Privacy), « Distribution », et parfois « Instructions de test » (Test instructions).

### D. Remplir la fiche (onglet Store listing)

19. En haut de l’onglet, repère le sélecteur de langue. Choisis « English ». La fiche anglaise est la fiche principale, car la langue par défaut du paquet est l’anglais.
20. Vérifie que le nom affiché est « DevDocTrad » et que la description courte est « Faithfully translates developer documentation and programming websites, without ever touching the code. ». Ces deux textes viennent du paquet et ne se modifient pas ici.
21. Dans le champ « Description », colle tout le bloc de la section « 3.2 Detailed description (English) » de ce fichier.
22. Dans « Catégorie » (Category), choisis « Developer Tools » (Outils de développement).
23. Dans « Langue » (Language), choisis « English ».
24. Dans « Icône de la boutique » (Store icon), envoie le fichier `store/icon-128.png`.
25. Dans « Captures d’écran » (Screenshots), envoie les quatre captures dans cet ordre : `store/screenshots/screenshot-1-traduction-fr.png`, puis `screenshot-2-bilingue.png`, puis `screenshot-3-reglages.png`, puis `screenshot-4-russe.png`.
26. Dans « Petite vignette promotionnelle » (Small promo tile), envoie `store/promo-440x280.png` (créée à l’étape 6).
27. Laisse vides la grande vignette (Marquee promo tile) et la vidéo : elles sont facultatives.
28. Dans « URL de la page d’accueil » (Homepage URL), colle `https://devdoctrad.vercel.app/` si GitHub Pages est activé et que la page s’ouvre ; sinon colle `https://github.com/jocravidd-droid/DevDocTrad`.
29. Dans « URL d’assistance » (Support URL), colle `https://github.com/jocravidd-droid/DevDocTrad/issues`.
30. Pour « Contenu pour adultes » (Mature content), réponds « Non ».
31. Remonte en haut de l’onglet et choisis « Français » dans le sélecteur de langue.
32. Dans le champ « Description » de la fiche française, colle tout le bloc de la section « 3.1 Description détaillée (français) » de ce fichier. Si la fiche française propose ses propres captures, envoie les mêmes quatre captures dans le même ordre.
33. Clique sur « Enregistrer le brouillon » (Save draft) en haut à droite.

### E. Remplir la confidentialité (onglet Privacy)

34. Dans « Description de l’objet unique » (Single purpose description), colle le bloc anglais de la section « 5. Objet unique » de ce fichier.
35. Dans le champ de justification de `storage`, colle le bloc anglais de la section « 6.1 storage ».
36. Dans le champ de justification de `unlimitedStorage`, colle le bloc anglais de la section « 6.2 unlimitedStorage ».
37. Dans le champ de justification de `activeTab`, colle le bloc anglais de la section « 6.3 activeTab ».
38. Dans le champ de justification de `scripting`, colle le bloc anglais de la section « 6.4 scripting ».
39. Dans le champ de justification des autorisations d’hôtes (Host permission justification), colle le bloc anglais de la section « 6.5 Autorisations d’hôtes ».
40. Si un champ de justification pour `commands` apparaît, colle le bloc anglais de la section « 6.6 commands ». S’il n’apparaît pas, ne fais rien.
41. À la question « Utilisez-vous du code distant ? » (Are you using remote code?), choisis « Non » (No). Si un champ de justification apparaît, colle le bloc anglais de la section « 7. Code distant ».
42. Dans « Utilisation des données » (Data usage), coche uniquement « Contenu du site Web » (Website content). Laisse toutes les autres cases décochées (ou coche aussi « Informations d’authentification » si tu as choisi d’être plus transparent, comme expliqué dans la section 8.1).
43. Coche les trois engagements listés dans la section « 8.2 Engagements à cocher ».
44. Dans « URL de la politique de confidentialité » (Privacy policy URL), colle `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md`.
45. Clique sur « Enregistrer le brouillon » (Save draft).

### F. Distribution et instructions de test

46. Ouvre l’onglet « Distribution ». Dans « Paiements » (Payments), choisis « Gratuit » (Free) ou « Aucun paiement » si c’est le libellé affiché.
47. Dans « Visibilité » (Visibility), choisis « Public ».
48. Dans « Zones géographiques » (Distribution regions), sélectionne toutes les régions.
49. Si l’onglet « Instructions de test » (Test instructions) existe, ouvre-le et colle le bloc anglais de la section « 10. Instructions de test pour les relecteurs ».
50. Clique sur « Enregistrer le brouillon » (Save draft).

### G. Envoyer pour examen

51. Clique sur « Envoyer pour examen » (Submit for review) en haut à droite. Si le bouton est grisé, le tableau de bord indique en rouge le champ manquant : complète-le, enregistre, puis réessaie.
52. Une fenêtre peut proposer de publier automatiquement après l’examen. Laisse l’option activée pour une publication dès l’acceptation, ou désactive-la si tu préfères cliquer toi-même sur « Publier » ensuite.
53. Confirme l’envoi. L’état de l’élément passe à « En attente d’examen » (Pending review).
54. Attends la réponse par e-mail. L’examen prend souvent quelques jours, parfois plus. Tu n’as rien à faire pendant ce temps.
55. Si l’extension est refusée, lis l’e-mail : il indique la règle concernée. Corrige le point demandé (texte, permission ou code), reconstruis le zip avec `python3 build.py` si le code a changé, envoie le nouveau zip dans l’onglet « Paquet » (Package), puis clique de nouveau sur « Envoyer pour examen ». N’envoie jamais une de tes clés d’API dans une réponse.
56. Une fois publiée, ouvre la fiche publique et copie son adresse. Ajoute-la dans le README, sur le site et dans `store/annonces.md` à la place de `<LIEN_CHROME_WEB_STORE>`.

### H. Versions suivantes

57. Pour chaque nouvelle version, augmente le numéro `version` dans `manifests/base.json` (par exemple `1.0.1`), puis lance `npm test` et `python3 build.py`.
58. Dans le tableau de bord, ouvre l’élément DevDocTrad, onglet « Paquet » (Package), clique sur « Importer un nouveau paquet » (Upload new package), choisis le nouveau zip de `release/`, puis clique sur « Envoyer pour examen ».

### I. Facultatif : Microsoft Edge Add-ons

59. Le même zip fonctionne pour Microsoft Edge. L’inscription sur `https://partner.microsoft.com/dashboard/microsoftedge/` est gratuite. Les textes de ce fichier (description, objet unique, justifications, politique de confidentialité) peuvent y être réutilisés tels quels.

---

## 13. Submission checklist (English)

Do the steps in order. Dashboard labels may change slightly over time: look for the closest label.

### A. Prepare the files on your computer

1. Open a terminal in the repository folder (the folder that contains `build.py`).
2. Type `npm install` and press Enter. Wait until it finishes.
3. Type `npm test` and press Enter. All tests must pass (no "fail" line at the end). If a test fails, do not publish: fix it first.
4. Type `python3 build.py` and press Enter. The script rebuilds the packages and prints one "sha256" line per package.
5. Open the `release/` folder and check that `devdoctrad-chrome-1.0.0.zip` is there. It is the only file you will upload to the Chrome Web Store.
6. Create the small promo tile, 440 x 280 pixels (PNG or JPEG), for example from the logo in `design/logo/`. Save it as `store/promo-440x280.png`. It is required to publish.
7. Open `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md` in your browser. The privacy policy must be displayed. If the page is not found, first push `PRIVACY.md` to the `main` branch of the public repository.

### B. Create the developer account

8. Open `https://myaccount.google.com/security` with the Google account you want to publish with. Under "2-Step Verification", turn it on if it is not on yet. It is required to publish on the Chrome Web Store.
9. Open `https://chrome.google.com/webstore/devconsole` and sign in with the same Google account.
10. Read and accept the Developer Agreement.
11. Pay the 5 dollar registration fee (one time, for all your future extensions). Do it only when you have decided to publish.
12. Open the "Account" tab in the left column. Fill in "Publisher name": this is the public name shown under the extension, for example your nickname.
13. Still in "Account", enter a contact email address, then click the verification link you receive by email. You cannot publish without verifying it.
14. If the dashboard asks whether you are a "trader" under European Union rules, read the explanation shown. For a free extension published as an individual, with no income, the answer is usually "non-trader". If in doubt, answer according to your real situation.
15. Click "Save" at the bottom of the "Account" page.

### C. Upload the package

16. In the left column, click "Items", then the "New item" button.
17. Click "Browse files" and choose `release/devdoctrad-chrome-1.0.0.zip`. Do not upload the unzipped folder: only the zip.
18. Wait for the upload to finish. The item page opens with several tabs on the left: "Package", "Store listing", "Privacy", "Distribution", and sometimes "Test instructions".

### D. Fill in the listing ("Store listing" tab)

19. At the top of the tab, find the language selector. Choose "English". The English listing is the main one, because the package's default language is English.
20. Check that the name shown is "DevDocTrad" and that the short description is "Faithfully translates developer documentation and programming websites, without ever touching the code.". Both come from the package and cannot be edited here.
21. In the "Description" field, paste the whole block from section "3.2 Detailed description (English)" of this file.
22. In "Category", choose "Developer Tools".
23. In "Language", choose "English".
24. In "Store icon", upload `store/icon-128.png`.
25. In "Screenshots", upload the four screenshots in this order: `store/screenshots/screenshot-1-traduction-fr.png`, then `screenshot-2-bilingue.png`, then `screenshot-3-reglages.png`, then `screenshot-4-russe.png`.
26. In "Small promo tile", upload `store/promo-440x280.png` (created in step 6).
27. Leave "Marquee promo tile" and the video empty: they are optional.
28. In "Homepage URL", paste `https://devdoctrad.vercel.app/` if GitHub Pages is enabled and the page opens; otherwise paste `https://github.com/jocravidd-droid/DevDocTrad`.
29. In "Support URL", paste `https://github.com/jocravidd-droid/DevDocTrad/issues`.
30. For "Mature content", answer "No".
31. Scroll back to the top of the tab and choose "French" (Français) in the language selector.
32. In the "Description" field of the French listing, paste the whole block from section "3.1 Description détaillée (français)" of this file. If the French listing has its own screenshot slots, upload the same four screenshots in the same order.
33. Click "Save draft" at the top right.

### E. Fill in privacy ("Privacy" tab)

34. In "Single purpose description", paste the English block from section "5. Objet unique (single purpose)" of this file.
35. In the justification field for `storage`, paste the English block from section "6.1 storage".
36. In the justification field for `unlimitedStorage`, paste the English block from section "6.2 unlimitedStorage".
37. In the justification field for `activeTab`, paste the English block from section "6.3 activeTab".
38. In the justification field for `scripting`, paste the English block from section "6.4 scripting".
39. In "Host permission justification", paste the English block from section "6.5 Autorisations d’hôtes (host permissions)".
40. If a justification field for `commands` appears, paste the English block from section "6.6 commands". If it does not appear, do nothing.
41. For "Are you using remote code?", choose "No". If a justification field appears, paste the English block from section "7. Code distant".
42. Under "Data usage", tick only "Website content". Leave every other box unticked (or also tick "Authentication information" if you chose to be more transparent, as explained in section 8.1).
43. Tick the three certifications listed in section "8.2 Engagements à cocher": not sold or transferred outside approved use cases; not used for purposes unrelated to the single purpose; not used for creditworthiness or lending.
44. In "Privacy policy URL", paste `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md`.
45. Click "Save draft".

### F. Distribution and test instructions

46. Open the "Distribution" tab. Under "Payments", choose "Free" (or "No payments", whichever label is shown).
47. Under "Visibility", choose "Public".
48. Under "Distribution regions", select all regions.
49. If the "Test instructions" tab exists, open it and paste the English block from section "10. Instructions de test pour les relecteurs".
50. Click "Save draft".

### G. Submit for review

51. Click "Submit for review" at the top right. If the button is greyed out, the dashboard shows the missing field in red: fill it in, save, and try again.
52. A dialog may offer to publish automatically after review. Leave it on to publish as soon as it is approved, or turn it off if you prefer to click "Publish" yourself later.
53. Confirm. The item status changes to "Pending review".
54. Wait for the answer by email. Review often takes a few days, sometimes longer. There is nothing to do in the meantime.
55. If the extension is rejected, read the email: it names the policy concerned. Fix what is asked (text, permission or code), rebuild the zip with `python3 build.py` if the code changed, upload the new zip in the "Package" tab, then click "Submit for review" again. Never send one of your API keys in a reply.
56. Once published, open the public listing and copy its address. Add it to the README, to the website and to `store/annonces.md` in place of `<LIEN_CHROME_WEB_STORE>`.

### H. Later versions

57. For each new version, increase `version` in `manifests/base.json` (for example `1.0.1`), then run `npm test` and `python3 build.py`.
58. In the dashboard, open the DevDocTrad item, "Package" tab, click "Upload new package", choose the new zip from `release/`, then click "Submit for review".

### I. Optional: Microsoft Edge Add-ons

59. The same zip works for Microsoft Edge. Registration at `https://partner.microsoft.com/dashboard/microsoftedge/` is free. The texts in this file (description, single purpose, justifications, privacy policy) can be reused there as they are.
