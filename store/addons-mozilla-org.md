# DevDocTrad : fiche addons.mozilla.org (AMO)

Textes prêts à copier pour publier DevDocTrad sur addons.mozilla.org, en français et en anglais, puis la marche à suivre complète.

État : l’extension n’est pas encore publiée. Le paquet à envoyer est `release/devdoctrad-firefox-1.0.0.zip`. Le compte développeur Mozilla est gratuit.

Astuce : sur GitHub, chaque bloc de texte a un bouton de copie en haut à droite. Copie le bloc entier et colle-le tel quel dans le champ indiqué.

Sommaire :

1. Informations fixes du paquet
2. Nom
3. Résumé (summary)
4. Description
5. Catégories
6. Liens, licence et politique de confidentialité
7. Collecte de données (`data_collection_permissions`)
8. Code source : pas d’envoi nécessaire
9. Notes pour les relecteurs
10. Captures d’écran et légendes
11. Vérification avec `web-ext lint`
12. Marche à suivre (français)
13. Submission checklist (English)

---

## 1. Informations fixes du paquet

| Élément | Valeur | Remarque |
|---|---|---|
| Identifiant (`browser_specific_settings.gecko.id`) | `devdoctrad@ingenieurfou` | Ne plus jamais le changer après la première publication : AMO lie la fiche à cet identifiant. |
| Version minimale de Firefox (`strict_min_version`) | `140.0` | Firefox 140 ou plus récent. |
| Collecte de données (`data_collection_permissions`) | `required: ["websiteContent"]` | Voir la section 7. |
| Langue par défaut (`default_locale`) | `en` | La fiche principale sur AMO est donc en anglais ; le français s’ajoute comme traduction. |
| Plateforme | Firefox pour ordinateur uniquement | Pas de version mobile (Firefox pour Android non pris en charge). |

## 2. Nom

Le nom vient du manifeste (`__MSG_extName__`). AMO le remplit automatiquement.

```text
DevDocTrad
```

## 3. Résumé (summary)

Limite AMO : 250 caractères. AMO préremplit le résumé avec la description du manifeste (106 caractères en français, 103 en anglais). Remplace-le par les textes ci-dessous, plus complets.

### 3.1 Résumé en français : 219 caractères sur 250

```text
Traduit fidèlement la documentation technique et les sites pour programmeurs, sans jamais toucher au code. Gratuite et open source, avec tes propres clés gratuites (Gemini, Groq, Mistral, OpenRouter) ou Ollama en local.
```

### 3.2 Summary in English: 202 characters out of 250

```text
Faithfully translates developer documentation and programming websites, without ever touching the code. Free and open source, with your own free keys (Gemini, Groq, Mistral, OpenRouter) or local Ollama.
```

## 4. Description

Texte brut, sans mise en forme : il s’affiche correctement sur AMO tel quel.

### 4.1 Description (français)

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
- Traduction automatique sur les sites que tu choisis. Firefox demande l’autorisation site par site.
- Glossaire personnel : termes à ne jamais traduire, ou à toujours traduire de la même façon.
- Interface en français et en anglais.

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
Aucune extension ne peut traduire les pages internes du navigateur (about:), les boutiques d’extensions ni le lecteur PDF intégré. Firefox 140 ou plus récent est nécessaire.

Mise en route
1. Crée une clé gratuite (par exemple sur console.groq.com, sans carte bancaire).
2. Clique sur l’icône DevDocTrad, puis sur la roue dentée (Réglages).
3. Onglet Clés : choisis le fournisseur, clique sur Ajouter, colle la clé, clique sur Charger les modèles, choisis un modèle, puis clique sur Tester.
4. Sur une page de documentation, clique sur l’icône puis sur Traduire cette page, ou appuie sur Alt+Maj+T.
Pour changer le raccourci : gestionnaire de modules (about:addons), roue dentée, « Gérer les raccourcis ».

Code source et aide : https://github.com/jocravidd-droid/DevDocTrad
```

### 4.2 Description (English)

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
- Automatic translation on the sites you choose. Firefox asks for permission one site at a time.
- Personal glossary: terms to never translate, or to always translate the same way.
- Interface in English and French.

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
No extension can translate browser internal pages (about:), extension stores or the built-in PDF viewer. Requires Firefox 140 or later.

Getting started
1. Create a free key (for example at console.groq.com, no credit card needed).
2. Click the DevDocTrad icon, then the gear icon (Settings).
3. Keys tab: choose the provider, click Add, paste the key, click Load models, pick a model, then click Test.
4. On a documentation page, click the icon then Translate this page, or press Alt+Shift+T.
To change the shortcut: Add-ons Manager (about:addons), gear icon, "Manage Extension Shortcuts".

Source code and help: https://github.com/jocravidd-droid/DevDocTrad
```

## 5. Catégories

AMO limite le nombre de catégories. Choisis ces deux-là, dans cet ordre de priorité :

| Catégorie (libellé anglais sur AMO) | Équivalent français | Pourquoi |
|---|---|---|
| Web Development | Développement web | Le public visé : développeurs qui lisent de la documentation. Équivaut à « Developer Tools » sur le Chrome Web Store. |
| Language Support | Prise en charge des langues | C’est une extension de traduction. |

## 6. Liens, licence et politique de confidentialité

| Champ AMO (libellé anglais) | Valeur |
|---|---|
| Homepage (page d’accueil) | `https://jocravidd-droid.github.io/DevDocTrad/` une fois GitHub Pages activé ; sinon `https://github.com/jocravidd-droid/DevDocTrad` |
| Support website (site d’assistance) | `https://github.com/jocravidd-droid/DevDocTrad/issues` |
| Support email (e-mail d’assistance) | Facultatif. Laisse vide, sauf si tu veux afficher publiquement une adresse. |
| License (licence) | MIT License |
| Privacy policy (politique de confidentialité) | Coche « This add-on has a privacy policy » si la case existe, puis colle le texte anglais de la partie « Privacy policy » de `PRIVACY.md` (de la ligne « Last updated » jusqu’à la ligne « Contact » incluse). Le texte complet en ligne : `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md` |

## 7. Collecte de données (`data_collection_permissions`)

Le manifeste Firefox déclare :

```json
"data_collection_permissions": {
  "required": ["websiteContent"]
}
```

Ce que ça veut dire, en français :

```text
Depuis Firefox 140, une extension déclare dans son manifeste les données qu’elle transmet hors de l’appareil. DevDocTrad déclare une seule catégorie, obligatoire : « contenu des sites web » (websiteContent). Firefox l’affiche à l’installation et sur la fiche AMO.

Pourquoi : pour traduire une page, l’extension envoie le texte visible de cette page au fournisseur de traduction que l’utilisateur a configuré avec sa propre clé (Google Gemini, Groq, Mistral ou OpenRouter), ou à Ollama sur son propre ordinateur. Le texte n’est envoyé que lorsque l’utilisateur lance une traduction (bouton, raccourci) ou sur les sites qu’il a lui-même choisis pour la traduction automatique. Rien n’est envoyé au développeur.

La catégorie est « obligatoire » (required) et non « facultative » (optional), car sans cet envoi l’extension ne peut rien traduire. Aucune autre catégorie n’est déclarée : pas d’historique de navigation, pas d’identifiants personnels, pas de statistiques d’utilisation.

En palier gratuit, Google Gemini et Mistral peuvent réutiliser les textes envoyés. Avec Ollama, le texte reste sur l’ordinateur de l’utilisateur.
```

In English (for reviewers or any data collection field):

```text
Since Firefox 140, an extension declares in its manifest the data it transmits off the device. DevDocTrad declares one required category: website content (websiteContent). Firefox shows it at install time and on the AMO listing.

Why: to translate a page, the extension sends the visible text of that page to the translation provider the user configured with their own key (Google Gemini, Groq, Mistral or OpenRouter), or to Ollama on the user's own computer. Text is sent only when the user starts a translation (button or shortcut), or on the sites the user chose for automatic translation. Nothing is sent to the developer.

The category is required, not optional, because without sending the text the extension cannot translate anything. No other category is declared: no browsing history, no personal identifiers, no usage statistics.

On free tiers, Google Gemini and Mistral may reuse the text sent. With Ollama, the text stays on the user's computer.
```

## 8. Code source : pas d’envoi nécessaire

AMO demande le code source séparé seulement si le paquet contient du code minifié, concaténé, transpilé ou généré par un outil. Ce n’est pas le cas ici :

- les fichiers JavaScript du zip sont exactement ceux de `src/`, lisibles, non minifiés ;
- `build.py` ne fait que copier `src/`, fusionner `manifests/base.json` et `manifests/firefox.json` en `manifest.json`, ajouter `LICENSE` et créer le zip ;
- aucune dépendance tierce n’est incluse dans le paquet (`jsdom` sert uniquement aux tests et n’est pas dans le zip).

À la question « Do you need to submit source code? » (Devez-vous envoyer le code source ?), réponds **No** (Non).

## 9. Notes pour les relecteurs

Champ « Notes to Reviewer » (notes pour les relecteurs). Colle ce texte en anglais.

```text
Source code: https://github.com/jocravidd-droid/DevDocTrad (MIT).
No build tools, no minification, no bundling, no transpilation. build.py only copies src/ and merges manifests/base.json with manifests/firefox.json into manifest.json. No remote code, no eval.

Data: the visible text of the page is sent only to the translation provider the user configured (Gemini, Groq, Mistral, OpenRouter) or to Ollama on localhost:11434. Declared as data_collection_permissions required: websiteContent. No analytics, no tracking. Keys and settings are kept in storage.local, never synced.

How to test without paying:
1. Create a free Groq key at https://console.groq.com (no credit card): API Keys, then Create API Key.
2. Click the DevDocTrad toolbar icon, then the gear icon (Settings). If the settings page shows "Allow access to providers", click it and accept.
3. Keys tab: choose Groq, click Add, paste the key, click Load models, pick a model in "Model (simple pages)", then click Test.
4. Translation tab: the target language is the browser language by default. If Firefox is in English, set "Target language" to another language (for example French).
5. Open https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction, click the toolbar icon, then "Translate this page" (or press Alt+Shift+T).
6. Code elements, commands and URLs stay untouched. "Show original" in the badge, or Alt+Shift+T again, restores the original.
```

Option : tu peux créer une clé Groq gratuite réservée à l’examen, l’ajouter à la fin de ces notes, puis la supprimer dans la console Groq une fois l’extension acceptée. N’y mets jamais une clé que tu utilises toi-même, ni une clé liée à un moyen de paiement.

## 10. Captures d’écran et légendes

AMO accepte une légende par capture. Les quatre captures font 1280 x 800 pixels.

Les captures ont été faites sur une page de documentation de démonstration (« Nimbus HTTP »), avec un modèle local simulé et l’option « traduire les commentaires du code » activée (elle est désactivée par défaut). Le code lui-même ne change pas.

| Fichier | Légende (français) | Caption (English) |
|---|---|---|
| `store/screenshots/screenshot-1-traduction-fr.png` | Une page de documentation traduite en français : les commandes, les noms de fonctions et les URL restent identiques. | A documentation page translated into French: commands, function names and URLs stay the same. |
| `store/screenshots/screenshot-2-bilingue.png` | Mode bilingue : la traduction s’affiche sous chaque phrase originale. | Bilingual mode: the translation appears under each original sentence. |
| `store/screenshots/screenshot-3-reglages.png` | Réglages : tes propres clés gratuites (Gemini, Groq, Mistral, OpenRouter) ou Ollama en local. | Settings: your own free keys (Gemini, Groq, Mistral, OpenRouter) or local Ollama. |
| `store/screenshots/screenshot-4-russe.png` | La langue cible se change dans les réglages : ici, la même page en russe. | The target language can be changed in the settings: here, the same page in Russian. |

L’icône vient du paquet (`icons/icon-128.png`, identique à `store/icon-128.png`). AMO l’utilise automatiquement.

## 11. Vérification avec `web-ext lint`

`web-ext` est l’outil officiel de Mozilla. `lint` vérifie le paquet avec les mêmes règles que la validation automatique d’AMO. Node.js 20 ou plus récent est nécessaire ; `npx` télécharge `web-ext` la première fois, rien n’est ajouté au projet.

Depuis le dossier du dépôt :

```bash
python3 build.py
```

```bash
npx web-ext lint --source-dir dist/firefox
```

Lecture du résultat :

- `errors 0` : obligatoire. S’il y a une erreur, corrige-la dans `src/` ou `manifests/`, relance `python3 build.py`, puis relance `web-ext lint`.
- `warnings` : lis chaque avertissement. Ils n’empêchent pas l’envoi, mais un relecteur peut poser une question à leur sujet.
- `notices` : informations, rien à faire.

---

## 12. Marche à suivre (français)

Chaque étape se fait dans l’ordre. Les libellés d’AMO peuvent changer légèrement avec le temps : cherche le libellé le plus proche.

### A. Préparer et vérifier le paquet

1. Ouvre un terminal dans le dossier du dépôt (le dossier qui contient `build.py`).
2. Tape `npm install` puis appuie sur Entrée. Attends la fin de l’installation.
3. Tape `npm test` puis appuie sur Entrée. Tous les tests doivent passer (aucune ligne « fail » à la fin). Si un test échoue, ne publie pas : corrige d’abord.
4. Tape `python3 build.py` puis appuie sur Entrée. Le script reconstruit `dist/firefox` et le fichier `release/devdoctrad-firefox-1.0.0.zip`.
5. Tape `npx web-ext lint --source-dir dist/firefox` puis appuie sur Entrée. Si le terminal demande l’autorisation d’installer `web-ext`, tape `y` puis Entrée.
6. Lis le résumé à la fin : il doit indiquer `errors 0`. S’il y a des erreurs, corrige-les, puis recommence à partir de l’étape 3.
7. Ouvre `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md` dans ton navigateur. La politique de confidentialité doit s’afficher. Si la page est introuvable, envoie d’abord `PRIVACY.md` sur la branche `main` du dépôt public.

### B. Créer le compte

8. Ouvre `https://addons.mozilla.org` et clique sur « Se connecter » (Log in) en haut à droite.
9. Crée un compte Mozilla gratuit, ou connecte-toi si tu en as déjà un. Confirme ton adresse e-mail avec le lien reçu.
10. Si AMO demande d’activer la validation en deux étapes pour publier, suis les instructions affichées (application d’authentification sur ton téléphone) et garde les codes de secours en lieu sûr.
11. Ouvre `https://addons.mozilla.org/developers/` (le « Developer Hub »).
12. À la première visite, lis et accepte le contrat de distribution des modules (Firefox Add-on Distribution Agreement) et les règles (Add-on Policies).
13. Dans le profil développeur, choisis le nom public qui apparaîtra comme auteur de l’extension, par exemple ton pseudo.

### C. Envoyer le paquet

14. Dans le Developer Hub, clique sur « Soumettre un nouveau module » (Submit a New Add-on).
15. À la question « Où voulez-vous distribuer cette version ? », choisis « Sur ce site » (On this site). C’est ce qui crée une fiche publique sur AMO.
16. Clique sur « Sélectionner un fichier » (Select a file) et choisis `release/devdoctrad-firefox-1.0.0.zip`.
17. Attends la validation automatique. Elle doit indiquer qu’il n’y a aucune erreur. Lis les avertissements éventuels (ce sont les mêmes que ceux de `web-ext lint`).
18. Dans « Compatibilité » (Compatible with), coche « Firefox » et décoche « Firefox pour Android » : l’extension n’est pas faite pour le mobile.
19. Clique sur « Continuer » (Continue).
20. À la question « Devez-vous envoyer le code source ? » (Do you need to submit source code?), réponds « Non » (No). Le code n’est ni minifié, ni concaténé, ni transpilé.
21. Clique sur « Continuer » (Continue).

### D. Remplir la fiche

22. Vérifie que le nom est « DevDocTrad ».
23. Dans « URL du module » (Add-on URL), garde ou saisis `devdoctrad`. La fiche aura l’adresse `https://addons.mozilla.org/firefox/addon/devdoctrad/`.
24. Dans « Résumé » (Summary), efface le texte prérempli et colle le bloc de la section « 3.2 Summary in English » de ce fichier.
25. Dans « Description », colle tout le bloc de la section « 4.2 Description (English) » de ce fichier.
26. Dans « Catégories » (Categories), coche « Web Development » puis « Language Support ».
27. Dans « E-mail d’assistance » (Support email), laisse vide, sauf si tu veux afficher publiquement une adresse.
28. Dans « Site d’assistance » (Support website), colle `https://github.com/jocravidd-droid/DevDocTrad/issues`.
29. Dans « Licence » (License), choisis « MIT License ».
30. Pour la politique de confidentialité, coche « Ce module a une politique de confidentialité » (This add-on has a privacy policy) si la case existe. Colle ensuite le texte anglais de la partie « Privacy policy » de `PRIVACY.md`, de la ligne « Last updated » jusqu’à la ligne « Contact » incluse.
31. Dans « Notes pour les relecteurs » (Notes to Reviewer), colle le bloc de la section « 9. Notes pour les relecteurs » de ce fichier.
32. Clique sur « Envoyer la version » (Submit Version). La version passe en attente d’examen.

### E. Compléter la fiche après l’envoi

33. Dans le Developer Hub, ouvre « Mes modules » (My Add-ons), puis DevDocTrad, puis « Modifier la fiche » (Edit Product Page).
34. Dans la partie des images, envoie les quatre captures dans cet ordre : `store/screenshots/screenshot-1-traduction-fr.png`, `screenshot-2-bilingue.png`, `screenshot-3-reglages.png`, `screenshot-4-russe.png`.
35. Sous chaque capture, colle la légende anglaise correspondante de la section « 10. Captures d’écran et légendes ».
36. Dans « Page d’accueil » (Homepage), colle `https://jocravidd-droid.github.io/DevDocTrad/` si GitHub Pages est activé et que la page s’ouvre ; sinon colle `https://github.com/jocravidd-droid/DevDocTrad`.
37. Enregistre chaque partie modifiée avec son bouton « Enregistrer les modifications » (Save Changes).
38. Pour ajouter la fiche française : en haut de la page de modification, utilise le sélecteur de langue pour choisir « Français ».
39. Dans le résumé français, colle le bloc de la section « 3.1 Résumé en français » de ce fichier.
40. Dans la description française, colle tout le bloc de la section « 4.1 Description (français) » de ce fichier.
41. Si les légendes des captures sont traduisibles, colle les légendes françaises de la section 10.
42. Enregistre les modifications.

### F. Examen et publication

43. Attends l’e-mail de Mozilla. La validation automatique est immédiate ; un examen humain peut avoir lieu avant ou après la publication et prendre de quelques jours à plusieurs semaines.
44. Si un relecteur pose une question, réponds dans le Developer Hub, sur la page de la version concernée. Réponds en anglais, simplement, en t’appuyant sur les sections 7, 8 et 9 de ce fichier. N’envoie jamais une de tes clés d’API personnelles.
45. Si une correction est demandée, corrige `src/` ou `manifests/`, augmente `version` dans `manifests/base.json` (par exemple `1.0.1`), relance `npm test`, `python3 build.py` et `npx web-ext lint --source-dir dist/firefox`, puis envoie la nouvelle version avec « Téléverser une nouvelle version » (Upload New Version).
46. Une fois publiée, ouvre la fiche publique et copie son adresse. Ajoute-la dans le README, sur le site et dans `store/annonces.md` à la place de `<LIEN_AMO>`.

### G. Facultatif : installation permanente sans fiche publique

47. Si tu veux seulement une version signée par Mozilla pour toi, sans fiche publique, choisis « Par moi-même » (On your own) à l’étape 15. Mozilla signe le fichier, que tu peux ensuite installer de façon permanente dans Firefox. Ne fais pas cela à la place de la fiche publique si le but est d’être trouvé.

---

## 13. Submission checklist (English)

Do the steps in order. AMO labels may change slightly over time: look for the closest label.

### A. Prepare and check the package

1. Open a terminal in the repository folder (the folder that contains `build.py`).
2. Type `npm install` and press Enter. Wait until it finishes.
3. Type `npm test` and press Enter. All tests must pass (no "fail" line at the end). If a test fails, do not publish: fix it first.
4. Type `python3 build.py` and press Enter. The script rebuilds `dist/firefox` and `release/devdoctrad-firefox-1.0.0.zip`.
5. Type `npx web-ext lint --source-dir dist/firefox` and press Enter. If the terminal asks to install `web-ext`, type `y` and press Enter.
6. Read the summary at the end: it must say `errors 0`. If there are errors, fix them, then start again from step 3.
7. Open `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md` in your browser. The privacy policy must be displayed. If the page is not found, first push `PRIVACY.md` to the `main` branch of the public repository.

### B. Create the account

8. Open `https://addons.mozilla.org` and click "Log in" at the top right.
9. Create a free Mozilla account, or sign in if you already have one. Confirm your email address with the link you receive.
10. If AMO asks you to turn on two-step authentication to publish, follow the instructions shown (authenticator app on your phone) and keep the recovery codes somewhere safe.
11. Open `https://addons.mozilla.org/developers/` (the "Developer Hub").
12. On your first visit, read and accept the Firefox Add-on Distribution Agreement and the Add-on Policies.
13. In your developer profile, choose the public name shown as the extension's author, for example your nickname.

### C. Upload the package

14. In the Developer Hub, click "Submit a New Add-on".
15. When asked where to distribute this version, choose "On this site". This creates a public listing on AMO.
16. Click "Select a file" and choose `release/devdoctrad-firefox-1.0.0.zip`.
17. Wait for the automatic validation. It must report no errors. Read any warnings (they are the same as those from `web-ext lint`).
18. Under "Compatible with", tick "Firefox" and untick "Firefox for Android": the extension is not made for mobile.
19. Click "Continue".
20. For "Do you need to submit source code?", answer "No". The code is not minified, concatenated or transpiled.
21. Click "Continue".

### D. Fill in the listing

22. Check that the name is "DevDocTrad".
23. In "Add-on URL", keep or type `devdoctrad`. The listing address will be `https://addons.mozilla.org/firefox/addon/devdoctrad/`.
24. In "Summary", delete the prefilled text and paste the block from section "3.2 Summary in English" of this file.
25. In "Description", paste the whole block from section "4.2 Description (English)" of this file.
26. In "Categories", tick "Web Development" and "Language Support".
27. Leave "Support email" empty, unless you want to show an address publicly.
28. In "Support website", paste `https://github.com/jocravidd-droid/DevDocTrad/issues`.
29. In "License", choose "MIT License".
30. For the privacy policy, tick "This add-on has a privacy policy" if the box exists. Then paste the English "Privacy policy" part of `PRIVACY.md`, from the "Last updated" line to the "Contact" line included.
31. In "Notes to Reviewer", paste the block from section "9. Notes pour les relecteurs" of this file.
32. Click "Submit Version". The version is now waiting for review.

### E. Complete the listing after submission

33. In the Developer Hub, open "My Add-ons", then DevDocTrad, then "Edit Product Page".
34. In the images part, upload the four screenshots in this order: `store/screenshots/screenshot-1-traduction-fr.png`, `screenshot-2-bilingue.png`, `screenshot-3-reglages.png`, `screenshot-4-russe.png`.
35. Under each screenshot, paste the matching English caption from section "10. Captures d’écran et légendes".
36. In "Homepage", paste `https://jocravidd-droid.github.io/DevDocTrad/` if GitHub Pages is enabled and the page opens; otherwise paste `https://github.com/jocravidd-droid/DevDocTrad`.
37. Save each edited part with its "Save Changes" button.
38. To add the French listing: at the top of the edit page, use the language selector to choose "Français".
39. In the French summary, paste the block from section "3.1 Résumé en français" of this file.
40. In the French description, paste the whole block from section "4.1 Description (français)" of this file.
41. If screenshot captions can be translated, paste the French captions from section 10.
42. Save the changes.

### F. Review and publication

43. Wait for the email from Mozilla. Automatic validation is immediate; a human review may happen before or after publication and can take from a few days to several weeks.
44. If a reviewer asks a question, answer in the Developer Hub, on the page of the version concerned. Answer in plain English, using sections 7, 8 and 9 of this file. Never send one of your personal API keys.
45. If a fix is requested, fix `src/` or `manifests/`, increase `version` in `manifests/base.json` (for example `1.0.1`), run `npm test`, `python3 build.py` and `npx web-ext lint --source-dir dist/firefox` again, then upload the new version with "Upload New Version".
46. Once published, open the public listing and copy its address. Add it to the README, to the website and to `store/annonces.md` in place of `<LIEN_AMO>`.

### G. Optional: permanent install without a public listing

47. If you only want a Mozilla-signed version for yourself, with no public listing, choose "On your own" at step 15. Mozilla signs the file, which you can then install permanently in Firefox. Do not do this instead of the public listing if the goal is to be found.
