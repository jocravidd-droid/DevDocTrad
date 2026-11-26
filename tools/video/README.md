# Vidéo de présentation (0 €, reproductible)

Ce dossier fabrique la vidéo publicitaire de DevDocTrad à partir de **vraies captures de l'extension**,
sans aucun logiciel payant ni contenu sous droits.

Résultat, dans `store/video/` :

| Fichier | Format | Durée |
|---|---|---|
| `devdoctrad-promo-fr-1080p.mp4`, `devdoctrad-promo-en-1080p.mp4` | 1920×1080, 30 i/s, H.264 yuv420p + AAC | 39 s |
| `devdoctrad-promo-fr-vertical.mp4`, `devdoctrad-promo-en-vertical.mp4` | 1080×1920 (Shorts, TikTok, Reels) | 29,5 s |
| `thumbnail-fr.png`, `thumbnail-en.png` | miniature 1280×720 | — |

Où publier chaque fichier, avec titres et descriptions prêts à coller : `store/video/README.md`.

## Refaire la vidéo

```sh
python3 build.py                       # construit dist/chrome (attention : réécrit aussi release/)
git checkout -- release                # si tu ne veux pas garder les zips reconstruits
node tools/video/make.js               # captures + rendu + encodage (environ 15 à 25 min)
```

Il faut Node 18 ou plus, ffmpeg (avec libx264 et libvpx-vp9) et Playwright avec son Chromium :
`npm install --no-save playwright && npx playwright install chromium` (déjà présent si `tools/e2e.js` fonctionne).

Options utiles :

- `--skip-capture` : réutilise les captures de `dist/video/captures` (rendu seul, plus rapide) ;
- `--only fr-wide` (ou `en-wide`, `fr-vertical`, `en-vertical`, `thumbs`) : un seul fichier ;
- `--frames 3,8.5,20` : n'encode rien, enregistre ces instants en PNG dans `dist/video/preview` pour vérifier ;
- `--crf 20` : fichiers plus légers (18 par défaut, plus petit = meilleure qualité).
- `--skip-capture --audio-only` : refait seulement la musique des vidéos déjà encodées (après une retouche de `music.js`).

Le script lance un faux Ollama sur le port 11434 et deux petits serveurs sur 8141 et 8142 ;
il arrête d'abord un éventuel `fake_ollama` resté d'une autre exécution. Si plusieurs tests tournent
sur la même machine, lance-le sous verrou :
`flock /tmp/ddt-e2e.lock -c 'node tools/video/make.js'`.

## Comment c'est fait

1. **`capture.js`** — vraies captures, comme `tools/e2e.js` :
   `dist/chrome` chargé dans Chromium (`channel: 'chromium'`), faux traducteur `tools/fake_ollama.js`
   (traductions préparées, aucune IA, aucun envoi), page de démo `tools/demo/index.html`.
   Pour chaque langue d'interface (français, anglais) : page originale, traduite, revenue à l'original,
   bilingue, russe ; en 1280×800 (16:9) et 900×1400 (9:16), en résolution ×2 pour des zooms nets ;
   le popup de l'extension ; la voix des vidéos (sous-titres de `tools/demo/voice/subs.en.vtt`
   traduits par l'extension), filmée image par image en déplaçant la vidéo de 1/30 s à chaque fois.
2. **`clip.js`** — la petite vidéo « tutoriel » de 10 s jouée pendant cette capture (terminal, éditeur),
   plus lisible dans une publicité que l'image de test de `tools/demo/voice/clip.webm`.
3. **`stage.html` + `stage.js`** — la mise en scène (accroche, fenêtre de navigateur en verre, clic,
   balayage de traduction, mise en évidence du code, sélecteur original / traduction / bilingue,
   vidéo sous-titrée, 37 langues, gratuit / open source / sans pistage, appel à l'action) et les
   sous-titres incrustés. Toute animation est une fonction du temps `renderAt(t)` : aucune horloge réelle,
   donc aucune saccade, et le même rendu à chaque fois.
4. **`make.js`** — calcule chaque image (30 par seconde) dans Chromium et l'envoie à ffmpeg
   (libx264, `-preset slow -crf 18`, yuv420p, BT.709, `+faststart`), avec le son de `music.js`.
5. **`music.js`** — musique synthétisée par le script lui-même (accords doux, basse, arpège, petits
   bruitages calés sur les clics). Aucune musique ni échantillon existant. Volume normalisé à −16 LUFS.

Textes de la vidéo : objet `TEXT` en haut de `stage.js` (français et anglais).
Calendrier des scènes : objet `T` juste en dessous.

## Outils et licences

| Outil | Licence | Rôle |
|---|---|---|
| Playwright, Chromium | Apache 2.0, BSD | captures et calcul des images |
| ffmpeg (libx264, libvpx) | LGPL / GPL | encodage (la licence ne s'applique pas aux vidéos produites) |
| Inter, JetBrains Mono (`fonts/`) | SIL OFL 1.1 (`fonts/OFL.txt`) | polices, sous-ensembles embarqués |
| Logo DevDocTrad, captures, musique | ceux du projet (MIT) | — |

Aucun service en ligne, aucun logiciel payant, aucune banque d'images ou de sons.
Remotion n'est pas utilisé (sa licence demande une licence payante aux entreprises) :
des pages HTML/CSS capturées image par image suffisent.
