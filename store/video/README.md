# Vidéos de présentation : où publier quoi

Fichiers fabriqués par `node tools/video/make.js` (voir `tools/video/README.md`) à partir de vraies
captures de l'extension. Musique originale synthétisée par le script : aucun droit d'auteur tiers,
pas de risque de blocage par Content ID. Les textes sont incrustés dans l'image : la vidéo se comprend
sans le son.

| Fichier | Format | Durée | Pour |
|---|---|---|---|
| `devdoctrad-promo-fr-1080p.mp4` | 16:9, 1920×1080 | 39 s | YouTube, X, LinkedIn, Mastodon, site, fiches des boutiques (via YouTube) |
| `devdoctrad-promo-en-1080p.mp4` | 16:9, 1920×1080 | 39 s | idem, public anglophone |
| `devdoctrad-promo-fr-vertical.mp4` | 9:16, 1080×1920 | 29,5 s | YouTube Shorts, TikTok, Instagram Reels, Facebook Reels |
| `devdoctrad-promo-en-vertical.mp4` | 9:16, 1080×1920 | 29,5 s | idem, public anglophone |
| `thumbnail-fr.png`, `thumbnail-en.png` | 1280×720 | — | miniature personnalisée YouTube |

Liens à mettre partout :

- Firefox : https://addons.mozilla.org/firefox/addon/devdoctrad/
- Site (Chrome, Edge, Brave, toutes les langues) : https://devdoctrad.vercel.app/
- Code source : https://github.com/jocravidd-droid/DevDocTrad

## Où publier chaque format

| Plateforme | Fichier | Conseils |
|---|---|---|
| **YouTube** (vidéo normale) | `-1080p.mp4` | Une vidéo par langue (FR et EN). Miniature : `thumbnail-<langue>.png` (il faut avoir validé le compte par téléphone pour mettre une miniature personnalisée). Catégorie « Science et technologie ». Le lien YouTube sert ensuite pour les fiches des boutiques. |
| **YouTube Shorts** | `-vertical.mp4` | Téléverser tel quel : une vidéo verticale de moins de 3 min devient un Short. Mettre `#Shorts` dans le titre ou la description n'est pas obligatoire mais aide. |
| **TikTok** | `-vertical.mp4` | Téléverser depuis l'ordinateur (tiktok.com/upload) pour garder la qualité. Choisir comme couverture l'image du « 37 langues » ou de « Code intact ». |
| **Instagram / Facebook Reels** | `-vertical.mp4` | Téléverser comme Reel. Le lien n'est pas cliquable dans la légende : mettre le site dans la bio ou dans un « lien » de story. |
| **X (Twitter)** | `-1080p.mp4` (ou `-vertical.mp4`) | Téléverser la vidéo dans le message (pas un lien YouTube : la vidéo native est bien plus vue). Le lien du site dans le texte. |
| **LinkedIn** | `-1080p.mp4` | Téléverser la vidéo dans le post. Texte court + lien du site en fin de post. |
| **Mastodon** | `-1080p.mp4` | Limite habituelle : 40 Mo par vidéo (dépend de l'instance) ; les fichiers font moins de 25 Mo. Ajouter une description de la vidéo (texte alternatif), voir plus bas. |
| **Fiche Firefox (AMO)** | lien YouTube de la vidéo **EN** | Dans le Developer Hub, partie « Media » de la fiche : coller le lien YouTube là où AMO le propose. Sinon, ajouter une ligne « Video: https://youtu.be/… » à la fin de la description (les liens y sont autorisés). Pour la traduction française de la fiche, le lien de la vidéo FR. |
| **Chrome Web Store / Edge Add-ons** (quand l'extension y sera) | lien YouTube | Champ « Vidéo promotionnelle » (URL YouTube) de la fiche. |
| **Site** (`docs/`) | lien YouTube | Facultatif : intégrer la vidéo YouTube sur la page d'accueil (aucun fichier lourd dans le dépôt du site). |
| **README GitHub** | `-1080p.mp4` | GitHub affiche une vidéo si on la glisse dans l'éditeur d'un fichier ou d'une issue (limite 10 Mo pour les comptes gratuits : utiliser plutôt la miniature avec un lien vers YouTube). |

## Textes prêts à coller

### YouTube — français

Titre :

```text
DevDocTrad : traduis n'importe quelle doc technique en un clic, sans toucher au code (gratuit)
```

Description :

```text
Une doc en anglais ? DevDocTrad la traduit directement dans la page, phrase par phrase, sans jamais toucher au code : commandes, noms de fonctions, API, chemins et URL restent intacts.

• Traduction fidèle : pas de résumé, pas d'ajout, pas d'omission
• Le code reste intact, les liens et la mise en forme aussi
• Original, traduction ou bilingue (la traduction sous chaque phrase), en un clic
• La voix des vidéos aussi : sous-titres traduits en direct
• 37 langues
• Gratuit et open source (licence MIT), sans pistage, sans statistiques
• Fonctionne avec des clés gratuites (Gemini, Groq, Mistral, OpenRouter) ou un modèle local avec Ollama

Firefox : https://addons.mozilla.org/firefox/addon/devdoctrad/
Chrome, Edge, Brave : https://devdoctrad.vercel.app/
Code source : https://github.com/jocravidd-droid/DevDocTrad

Musique originale générée pour cette vidéo.

#DevDocTrad #traduction #documentation #développeur #programmation #opensource #Firefox
```

### YouTube — English

Title:

```text
DevDocTrad: translate any developer docs in one click, code untouched (free & open source)
```

Description:

```text
Docs not in your language? DevDocTrad translates them right in the page, sentence by sentence, without ever touching the code: commands, function names, APIs, paths and URLs stay exactly as they are.

• Faithful translation: no summary, nothing added, nothing left out
• Code stays untouched, and so do links and formatting
• Original, translation or bilingual (translation under each sentence), in one click
• Video voice too: subtitles translated live
• 37 languages
• Free and open source (MIT License), no tracking, no analytics
• Works with free API keys (Gemini, Groq, Mistral, OpenRouter) or a local model with Ollama

Firefox: https://addons.mozilla.org/firefox/addon/devdoctrad/
Chrome, Edge, Brave: https://devdoctrad.vercel.app/
Source code: https://github.com/jocravidd-droid/DevDocTrad

Original music generated for this video.

#DevDocTrad #translation #documentation #developer #programming #opensource #Firefox
```

### Shorts, TikTok, Reels — français

Titre (Shorts) :

```text
Une doc en anglais ? Traduite en un clic, le code reste intact #Shorts
```

Légende (TikTok, Reels) :

```text
Une doc en anglais ? DevDocTrad la traduit dans la page, sans toucher au code. Bilingue en un clic, sous-titres des vidéos traduits, 37 langues. Gratuit, open source, sans pistage. Lien : devdoctrad.vercel.app
#dev #programmation #développeur #codage #opensource #firefox #astuce
```

### Shorts, TikTok, Reels — English

Title (Shorts):

```text
Docs not in your language? Translated in one click, code untouched #Shorts
```

Caption (TikTok, Reels):

```text
Docs not in your language? DevDocTrad translates them in the page without touching the code. Bilingual in one click, video subtitles translated, 37 languages. Free, open source, no tracking. Link: devdoctrad.vercel.app
#dev #programming #coding #developer #opensource #firefox #devtools
```

### X, Mastodon, LinkedIn — français

```text
Une doc en anglais ? DevDocTrad la traduit directement dans la page, sans jamais toucher au code. Original, traduction ou bilingue en un clic, sous-titres des vidéos traduits, 37 langues.
Gratuit, open source, sans pistage.
Firefox : https://addons.mozilla.org/firefox/addon/devdoctrad/
Chrome, Edge, Brave : https://devdoctrad.vercel.app/
```

### X, Mastodon, LinkedIn — English

```text
Docs not in your language? DevDocTrad translates them right in the page, without ever touching the code. Original, translation or bilingual in one click, video subtitles translated, 37 languages.
Free, open source, no tracking.
Firefox: https://addons.mozilla.org/firefox/addon/devdoctrad/
Chrome, Edge, Brave: https://devdoctrad.vercel.app/
```

### Description de la vidéo (texte alternatif, Mastodon et accessibilité)

```text
Vidéo de présentation de DevDocTrad, sans voix, textes à l'écran. Une page de documentation en anglais s'ouvre ; un clic sur l'icône de l'extension puis sur « Traduire cette page » : la page passe en français, le bloc de code est mis en évidence, il n'a pas changé. Un sélecteur passe de l'original à la traduction puis au mode bilingue. Une vidéo tutoriel affiche ses sous-titres anglais traduits en français. Puis : 37 langues, gratuit, open source, sans pistage, et les liens vers Firefox et le site.
```

```text
DevDocTrad promo video, no voice, on-screen text. An English documentation page opens; one click on the extension icon, then "Translate this page": the page switches to French, the code block is highlighted and unchanged. A switch goes from original to translation to bilingual. A tutorial video shows its English subtitles translated into French. Then: 37 languages, free, open source, no tracking, and links to Firefox and the website.
```
