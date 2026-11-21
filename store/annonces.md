# DevDocTrad : textes d’annonce

Textes prêts à publier pour faire connaître DevDocTrad, en français et en anglais. Ils sont écrits pour être honnêtes et utiles, pas pour vendre : ils disent ce que fait l’extension, ce qu’elle ne fait pas, et le compromis de confidentialité.

C’est toi qui publies, jamais un outil automatique.

## Avant de publier

1. Publie ces textes une fois l’extension en ligne sur le Chrome Web Store et sur addons.mozilla.org. Remplace alors `<LIEN_CHROME_WEB_STORE>` et `<LIEN_AMO>` par les vraies adresses des fiches.
2. Si tu publies avant, supprime les deux lignes qui contiennent ces liens et garde seulement le lien du dépôt GitHub, où l’installation manuelle est expliquée.
3. Lis les règles de chaque communauté avant de poster (autopromotion, jour dédié aux projets, étiquette obligatoire). Si une règle interdit ce type de message, ne poste pas.
4. Un seul message par communauté. Ne reposte pas le même texte plusieurs fois, ne demande pas de votes.
5. Dis toujours que tu es l’auteur de l’extension (c’est déjà écrit dans chaque texte).
6. Reste disponible quelques heures après la publication pour répondre aux questions et aux critiques, calmement.
7. N’écris jamais une de tes clés d’API dans un message ou une capture.

Liens utilisés dans les textes :

| Élément | Adresse |
|---|---|
| Dépôt GitHub | `https://github.com/jocravidd-droid/DevDocTrad` |
| Site (une fois GitHub Pages activé) | `https://devdoctrad.vercel.app/` |
| Politique de confidentialité | `https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md` |
| Chrome Web Store | `<LIEN_CHROME_WEB_STORE>` (à remplacer) |
| addons.mozilla.org | `<LIEN_AMO>` (à remplacer) |

Sommaire :

1. Reddit r/programmation (français)
2. Reddit r/learnprogramming (English)
3. Forum developpez.com (français)
4. Article dev.to (English)
5. Show HN, Hacker News (English)
6. Fiche AlternativeTo (English)
7. Pull request pour une liste « awesome » (English)

---

## 1. Reddit r/programmation (français)

Où : `https://www.reddit.com/r/programmation/`. Type de publication : texte. Ajoute une étiquette (flair) si la communauté en demande une.

Titre :

```text
J’ai écrit une extension gratuite et open source qui traduit la documentation technique sans toucher au code
```

Texte :

```text
Bonjour,

Je suis l’auteur de DevDocTrad, une extension pour Chrome, Edge, Brave et Firefox (140 et plus). Elle traduit les pages de documentation et les sites pour programmeurs en laissant le code tel quel. Je la partage ici parce que beaucoup d’entre nous lisent de la doc en anglais tous les jours.

Ce qu’elle fait :

- traduction phrase par phrase, dans le même ordre, sans résumé, sans omission, sans ajout, et sans explication par défaut ;
- les commandes, noms de fonctions, API, chemins et URL ne sont jamais traduits ; les liens, le gras et les blocs de code restent en place ;
- la langue cible est celle du navigateur par défaut (37 langues), modifiable dans les réglages ;
- affichage au choix : remplacement du texte, ou bilingue avec la traduction sous chaque phrase ;
- retour à l’original exact en un clic ou avec Alt+Maj+T.

Comment ça marche, côté argent : l’extension est gratuite, sous licence MIT, et n’a pas de serveur. Elle utilise vos propres clés gratuites (Google Gemini, Groq, Mistral, OpenRouter avec les modèles :free) ou un modèle local avec Ollama. Elle ne bascule jamais vers une clé payante, et une clé payante reste bloquée tant qu’on n’a pas réglé un plafond journalier et des prix.

Le compromis à connaître : le texte de la page part chez le fournisseur choisi. En palier gratuit, Gemini et Mistral peuvent réutiliser ce texte. Pour une page privée (dépôt privé, intranet), Ollama garde tout sur votre machine. L’extension elle-même n’a aucune statistique ni aucun pistage, les clés restent dans le stockage local du navigateur sans synchronisation, et les pages sensibles (mot de passe, banque, mail, connexion) ne sont jamais traduites automatiquement.

Liens :
- code source et installation : https://github.com/jocravidd-droid/DevDocTrad
- Chrome Web Store : <LIEN_CHROME_WEB_STORE>
- Firefox : <LIEN_AMO>

Je cherche surtout des retours sur les pages où la mise en forme casse, ou où quelque chose qui devrait rester du code est traduit. Les issues GitHub sont le meilleur endroit pour ça, mais je lis aussi les commentaires ici.
```

---

## 2. Reddit r/learnprogramming (English)

Where: `https://www.reddit.com/r/learnprogramming/`. Post type: text. This community has strict rules on self-promotion: read them first, and if project posts are not allowed, do not post.

Title:

```text
I made a free, open-source extension to read programming docs in your own language without the code getting translated
```

Text:

```text
Hi,

When you are learning to program and English is not your first language, reading documentation is twice the work. I wrote a browser extension for that, DevDocTrad, and I am sharing it in case it helps someone. I am the author.

What it does:

- Translates documentation pages sentence by sentence, in order. No summary, no omission, no addition, and no explanations by default, so you read what the docs actually say.
- Never translates code, commands, function names, APIs, paths or URLs. Links, bold text and code blocks stay in place, so you can still copy the exact command.
- Translates into your browser language by default (37 languages), or another one you pick in the settings.
- Bilingual mode shows the translation under each original sentence, which helps if you are also learning English. One click or Alt+Shift+T brings back the exact original.

It works on Chrome, Edge, Brave and Firefox 140+.

Cost: it is free and open source (MIT), with no server of its own. You use your own free key from Google Gemini, Groq, Mistral or OpenRouter (:free models only), or a local model with Ollama. It never falls back to a paid key, and paid keys are blocked until you set a daily cap and prices.

Privacy trade-off: the page text is sent to the provider you choose, and on free tiers Gemini and Mistral may reuse it. With Ollama, the text stays on your computer. The extension has no analytics or tracking, keeps keys in local storage (never synced), and never auto-translates sensitive pages such as password, bank, mail or login pages.

Source and install instructions: https://github.com/jocravidd-droid/DevDocTrad
Chrome Web Store: <LIEN_CHROME_WEB_STORE>
Firefox: <LIEN_AMO>

If a page breaks or some code gets translated, a GitHub issue with the URL helps a lot.
```

---

## 3. Forum developpez.com (français)

Où : `https://www.developpez.net/forums/`. Choisis la rubrique la plus proche (outils pour développeurs, ou navigateurs et extensions) et lis ses règles avant de poster.

Titre :

```text
DevDocTrad : extension gratuite et open source pour traduire la documentation technique sans toucher au code
```

Texte :

```text
Bonjour à tous,

Je suis l’auteur de DevDocTrad, une extension de navigateur que je viens de publier, et je souhaite vous la présenter pour recueillir vos avis.

Le besoin
Une grande partie de la documentation technique n’existe qu’en anglais. Je voulais une traduction qui respecte le texte d’origine et qui ne touche jamais au code.

Ce que fait l’extension
- Traduction fidèle, phrase par phrase, dans le même ordre : pas de résumé, pas d’omission, pas d’ajout. Par défaut, aucune explication n’est ajoutée.
- Les commandes, noms de fonctions, API, chemins et URL ne sont jamais traduits. Les liens, le gras et les éléments de code restent en place.
- La langue cible est celle du navigateur par défaut (37 langues disponibles) ; elle se change dans les réglages.
- Deux affichages : remplacement du texte, ou mode bilingue avec la traduction sous chaque phrase.
- Retour à l’original exact en un clic ou avec le raccourci Alt+Maj+T.
- Navigateurs : Chrome, Edge, Brave et Firefox 140 ou plus récent. Interface en français et en anglais.

Fonctionnement et coût
L’extension est gratuite et open source (licence MIT). Elle n’a pas de serveur : elle utilise vos propres clés d’API gratuites (Google Gemini, Groq, Mistral, ou OpenRouter avec les seuls modèles « :free »), ou un modèle local avec Ollama. Elle ne bascule jamais vers une clé payante ; une clé payante reste bloquée tant que vous n’avez pas réglé un plafond journalier et les prix.

Confidentialité : le compromis
Le texte de la page traduite est envoyé au fournisseur que vous avez choisi, et à lui seul. En palier gratuit, Google Gemini et Mistral peuvent réutiliser les textes envoyés. Pour une page privée (dépôt privé, intranet), je vous conseille Ollama : le texte reste sur votre machine. L’extension ne contient aucune statistique ni aucun pistage, les clés restent dans le stockage local du navigateur (jamais synchronisées), et les pages sensibles (champ mot de passe, banques, mails, pages de connexion) ne sont jamais traduites automatiquement.

Liens
- Code source et installation : https://github.com/jocravidd-droid/DevDocTrad
- Chrome Web Store : <LIEN_CHROME_WEB_STORE>
- Modules Firefox : <LIEN_AMO>
- Politique de confidentialité : https://github.com/jocravidd-droid/DevDocTrad/blob/main/PRIVACY.md

Vos retours m’intéressent, en particulier sur les pages où la mise en forme est cassée ou où un élément de code est traduit par erreur. Vous pouvez répondre ici ou ouvrir une issue sur GitHub.

Merci de votre lecture.
```

---

## 4. Article dev.to (English)

Where: `https://dev.to/new`. Paste the whole block below into the editor (Markdown mode). `published: false` keeps it as a draft until you click "Publish". About 400 words.

````markdown
---
title: "DevDocTrad: translating developer docs without touching the code"
published: false
tags: showdev, opensource, webdev, javascript
---

Many developers read documentation in a language that is not their own. Page translators help, but for technical pages I wanted something stricter: translate every sentence, in order, and leave the code alone.

DevDocTrad is a browser extension I wrote to do that. It is free, open source (MIT), and runs on Chrome, Edge, Brave and Firefox 140+.

## What it does

- Translates sentence by sentence. No summary, no omission, no addition, and no explanations unless you turn that option on.
- Never translates code, commands, function names, APIs, paths or URLs. Links, bold text and `code` elements stay where they were.
- Translates into your browser language by default (37 languages), or into another language you pick in the settings.
- Replace mode, or bilingual mode with the translation under each sentence. One click or `Alt+Shift+T` brings back the exact original.

## How it works

There is no DevDocTrad server. The extension sends the page text to a language model provider, using your own key:

- Google Gemini, Groq, Mistral or OpenRouter (only `:free` models), all with free tiers;
- or Ollama, running a model on your own machine.

The cost rules are strict on purpose. When a free key hits its rate limit, the extension moves to another free key or to Ollama, never to a paid key. A key marked as paid stays blocked until you set a daily cap and prices yourself.

## The privacy trade-off

Free cloud tiers have a cost that is not money. The page text goes to the provider you chose, and on free tiers Google Gemini and Mistral may reuse that text. For public documentation that is often acceptable. For a private repository or an intranet page, use Ollama: the text stays on your computer.

The extension itself has no analytics and no tracking. Keys are kept in the browser's local storage and never synced. Pages with a password field, banks, mail and sign-in pages are never translated automatically; you can still translate them by hand.

## Try it

- Source code and install instructions: https://github.com/jocravidd-droid/DevDocTrad
- Chrome Web Store: <LIEN_CHROME_WEB_STORE>
- Firefox Add-ons: <LIEN_AMO>

The interface is available in English and French.

## Feedback welcome

I am most interested in pages where the layout breaks, or where something that should stay as code gets translated. A GitHub issue with the page URL is the most useful report. Comments here are welcome too.
````

---

## 5. Show HN, Hacker News (English)

Where: `https://news.ycombinator.com/submit`. Put the repository address in the "url" field and the text below in the "text" field. Hacker News shows plain text: no Markdown lists.

Title (77 characters, the limit is 80):

```text
Show HN: DevDocTrad – Translate developer docs in the browser, code untouched
```

URL:

```text
https://github.com/jocravidd-droid/DevDocTrad
```

Text:

```text
DevDocTrad is a browser extension (Chrome, Edge, Brave, Firefox 140+) that translates documentation pages sentence by sentence while leaving code, commands, function names, APIs, paths and URLs untouched. Links, bold text and inline code stay in place. It does not summarize or explain by default; it translates.

It is free and MIT-licensed, and there is no backend. You bring your own key for a free tier (Gemini, Groq, Mistral, or OpenRouter :free models), or run a local model with Ollama. It never falls back to a paid key, and a paid key is blocked until you set a daily cap and prices.

The trade-off: the page text goes to the provider you pick, and the free tiers of Gemini and Mistral may reuse it. Ollama keeps it on your machine. The extension has no analytics or tracking, keys stay in local storage (never synced), and pages with password fields, banks, mail or login are never translated automatically.

The target language defaults to the browser language (37 languages). Replace or bilingual display, and Alt+Shift+T toggles back to the exact original.

I wrote it and would appreciate reports of pages where code gets translated or the layout breaks.
```

---

## 6. Fiche AlternativeTo (English)

Where: `https://alternativeto.net/`, menu "Add new app" (sign in first). Fill in the fields below.

| Field | Value |
|---|---|
| Name | DevDocTrad |
| Website | `https://devdoctrad.vercel.app/` once GitHub Pages is enabled; otherwise `https://github.com/jocravidd-droid/DevDocTrad` |
| Source code | `https://github.com/jocravidd-droid/DevDocTrad` |
| License / pricing | Free, Open Source (MIT) |
| Platforms | Google Chrome, Microsoft Edge, Brave, Mozilla Firefox |
| Category | Development (or the closest available) |
| Alternative to | Google Translate (built-in browser page translation), Immersive Translate |
| Tags | translation, browser-extension, developer-tools, documentation, llm, ollama |
| Features | Ad-free, No tracking, Bilingual display, Keyboard shortcuts, Bring your own API key, Local LLM support (Ollama) |

Short description:

```text
Browser extension that faithfully translates developer documentation and programming websites, without ever touching the code. Free and open source, with your own free API keys or a local Ollama model.
```

Description:

```text
DevDocTrad faithfully translates developer documentation and programming websites, without ever touching the code.

- Sentence by sentence, in order: no summary, no omission, no addition, and no explanations by default.
- Code, commands, function names, APIs, paths and URLs are never translated. Links, bold text and code elements stay in place.
- Target language: the browser language by default (37 languages), changeable in the settings.
- Replace mode or bilingual mode. One click or Alt+Shift+T brings back the exact original.
- Works on Chrome, Edge, Brave and Firefox 140+. Interface in English and French.

Free and open source (MIT), with no server of its own. It uses your own free keys for Google Gemini, Groq, Mistral or OpenRouter (:free models only), or a local model with Ollama. It never falls back to a paid key; paid keys are blocked until you set a daily cap and prices.

Privacy trade-off: the page text is sent only to the provider you choose. On free tiers, Google Gemini and Mistral may reuse that text; with Ollama it stays on your computer. No analytics, no tracking, keys kept in local storage and never synced. Sensitive pages (password fields, banks, mail, sign-in) are never translated automatically.
```

---

## 7. Pull request pour une liste « awesome » (English)

Choisis une liste « awesome » qui accepte des extensions de navigateur pour développeurs, ou des outils de traduction. Avant d’ouvrir la pull request, lis son fichier `CONTRIBUTING.md` et respecte exactement son format : section, ordre alphabétique, style de ligne, ponctuation finale. Adapte la ligne ci-dessous à ce format si besoin.

Entry (one line, to add in the right section):

```markdown
- [DevDocTrad](https://github.com/jocravidd-droid/DevDocTrad) - Translates developer documentation sentence by sentence without translating code. Free, open source, uses your own LLM API keys or a local Ollama model.
```

Pull request title:

```text
Add DevDocTrad
```

Pull request description:

```text
This adds DevDocTrad, a browser extension (Chrome, Edge, Brave, Firefox 140+) that translates developer documentation and programming websites sentence by sentence, without translating code, commands, function names, APIs, paths or URLs.

- Free and open source (MIT): https://github.com/jocravidd-droid/DevDocTrad
- Uses the user's own keys (free tiers of Google Gemini, Groq, Mistral, OpenRouter :free models) or a local model with Ollama. It never falls back to a paid key.
- Privacy trade-off, stated in the README and privacy policy: the page text is sent only to the provider the user chooses; on free tiers Gemini and Mistral may reuse it, while Ollama keeps it on the user's computer. No analytics or tracking.

I am the author. I followed the contribution guidelines of this list; happy to change the wording or the section if needed.
```
