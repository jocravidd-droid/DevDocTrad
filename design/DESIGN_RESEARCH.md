# DevDocTrad — Dossier de recherche visuelle

Date : 21 novembre 2026. Étape 2 de la méthode de `design/DIRECTION_ARTISTIQUE.md`.

## Méthode et limites (à lire d'abord)

**Mise à jour (même jour) :** l'accès réseau a ensuite été ouvert. Les pages ont alors été **réellement ouvertes dans Chromium** et capturées (clair et sombre, 1440 × 900) avec `node tools/capture_refs.js`. Les captures sont gardées dans `design/references/` **en local seulement** (ignoré par git : ce sont des pages de tiers, non republiées) ; la commande les régénère. Les lignes « Observé dans la capture » ci-dessous viennent de ces captures. Behance s'affiche **vide** sans connexion (page blanche capturée) : aucune observation Behance.

Version initiale :

- Les recherches ont été faites avec un outil de recherche web qui renvoie **des résumés textuels et des liens**. Depuis l'environnement de travail, l'ouverture directe des pages (apple.com, developer.mozilla.org, developer.chrome.com, behance.net, raycast.com) est **bloquée par le réseau** : aucune page n'a été ouverte dans un navigateur, et **aucune capture d'écran de ces références n'a pu être faite**.
- Chaque fiche sépare donc : ce que disent les sources (citations ou résumés de la recherche), mon interprétation, et la proposition pour DevDocTrad. Rien n'est présenté comme « vu à l'écran ».
- Les deux images de référence fournies par l'utilisateur dans la conversation de design **n'ont pas été transmises** dans cette session ; seule leur description écrite (`design/CONVERSATION_DESIGN.md`, section 1) est utilisée.
- Behance n'a pas pu être consulté (pages et images inaccessibles) : aucune fiche Behance n'est inventée.
- À faire par l'utilisateur ou dans une session avec accès web complet : ouvrir les URL ci-dessous, ajouter des captures dans `design/references/`, et corriger les fiches si l'observation visuelle contredit le résumé.

## Fiches

### 1. Apple — Liquid Glass (Technology Overview et session WWDC25 219)

- Sources : https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass ; https://developer.apple.com/videos/play/wwdc2025/219/ ; https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- Ce que disent les sources : Liquid Glass est un matériau dynamique qui « combine les propriétés optiques du verre et une sensation de fluidité » et « forme une couche fonctionnelle distincte pour les commandes et la navigation ». Ce n'est pas l'imitation d'un matériau réel mais un « méta-matériau numérique qui courbe et façonne la lumière ». Apple met en garde : en abuser sur de nombreux contrôles personnalisés « distrait du contenu ».
- Interprétation : le verre est réservé à la **couche de commande**, pas au contenu. Le contenu reste stable et lisible ; le verre flotte au-dessus.
- Pour DevDocTrad : dans le popup, le verre sert aux contrôles (barre d'action, capsules, segmenté), pas aux textes d'état. Sur les pages web, la page elle-même n'est jamais « vitrée » : seul le badge appartient à la couche de commande, et en version très retenue.
- À ne pas copier : la forme des barres d'onglets iOS, les contrôles système d'Apple tels quels.
- Observé dans la capture (communiqué Apple du 9 juin 2025, `05-apple-newsroom-design-*`) : le texte décrit le matériau comme « translucide », dont « la couleur est informée par le contenu environnant » et qui « s'adapte intelligemment entre clair et sombre », avec des « reflets spéculaires » qui réagissent au mouvement. L'illustration montre de grands chiffres « 9:41 » en verre posés sur une photo très colorée (feuillage vert, fleur orange) : le verre n'est lisible que parce que le fond est riche et contrasté.

### 2. Apple Human Interface Guidelines — Materials

- Sources : https://developer.apple.com/design/human-interface-guidelines/materials ; https://developer.apple.com/videos/play/wwdc2023/10076/
- Ce que disent les sources : les matériaux fins et translucides aident à garder le contexte ; « utiliser des matériaux plus épais derrière le texte et les interfaces détaillées, plus fins pour les composants interactifs simples » ; « éviter d'empiler des matériaux clairs les uns sur les autres » (perte de contraste) ; Liquid Glass « paraît plus opaque dans les grands éléments comme les barres latérales pour préserver la lisibilité » ; le niveau de texte le plus faible (quaternaire) est à éviter sur les matériaux les plus fins.
- Interprétation : il faut **plusieurs épaisseurs de verre** selon le rôle, et plus la surface est grande ou chargée en texte, plus elle doit être opaque.
- Pour DevDocTrad : 4 matériaux distincts (primaire épais, secondaire, flottant, contrôle) + repli opaque ; la barre latérale des réglages est la plus opaque ; jamais deux verres clairs superposés sans séparation (bordure ou ombre).
- À ne pas copier : les valeurs exactes des matériaux système (non publiées pour le web de toute façon).
- Observé dans la capture (`02-apple-hig-materials-light`) : la page définit un matériau comme « un effet visuel qui crée une impression de profondeur, de superposition et de hiérarchie entre les éléments de premier plan et d'arrière-plan » ; l'illustration est faite de formes arrondies superposées (bulles décalées) sur fond jaune : la profondeur vient de la superposition décalée de formes simples, pas de détails.

### 3. Apple HIG — App icons et Icon Composer (WWDC25 361, WWDC26 8012)

- Sources : https://developer.apple.com/design/human-interface-guidelines/app-icons ; https://developer.apple.com/icon-composer/ ; https://developer.apple.com/videos/play/wwdc2025/361
- Ce que disent les sources : icônes construites en **couches** (un fond, une ou plusieurs couches de premier plan) qui « créent la dimension » ; le système ajoute reflets spéculaires, réfraction, ombres ; éviter les bords flous des formes ; « une icône aux détails fins peut paraître chargée et les détails difficiles à discerner aux petites tailles » ; préférer des formes pleines qui se superposent ; la session 2026 mentionne une translucidité réduite pour des icônes plus nettes.
- Interprétation : le logo doit être lisible comme **2 à 3 formes pleines superposées**, l'effet de verre n'étant qu'une matière ajoutée.
- Pour DevDocTrad : symbole = 2 feuilles pleines décalées, bords nets ; reflets et irisation appliqués par-dessus dans les grandes tailles, retirés à 16 px.
- À ne pas copier : la grille d'icône Apple, la silhouette de la pomme (marque).
- Observé dans la capture (`03-apple-hig-app-icons-light`) : page mise à jour le 28 octobre 2026 (« ajout de conseils sur les formats d'icône ») ; l'icône d'exemple est un symbole simple en formes pleines sur fond uni, lisible sans effet.

### 4. macOS Tahoe — Centre de contrôle et retours critiques

- Sources : https://9to5mac.com/2025/07/09/macos-tahoe-has-big-control-center-upgrades-heres-everything-new/ ; https://www.macrumors.com/2025/08/01/macos-tahoe-review ; https://www.macworld.com/article/2862474/macos-tahoe-prioritizes-productivity-over-liquid-glass.html
- Ce que disent les sources : le Centre de contrôle adopte Liquid Glass, aspect translucide unifié avec le Dock et la barre de menus. Critiques : le verre « ne rend bien que lorsqu'il y a quelque chose dessous à réfracter » ; sur Mac « la plupart des fenêtres ont juste du blanc dessous » ; sur iOS 26 bêta 1, le Centre de contrôle était « si translucide qu'il était presque illisible », Apple a ensuite assombri et opacifié les boutons.
- Interprétation : **un verre posé sur un fond blanc uni ne se voit pas** ; un verre trop transparent devient illisible. Il faut un fond qui donne de la matière au verre, et des contrôles plus opaques que les panneaux.
- Pour DevDocTrad : le popup et les réglages ont leur propre fond « lumière » (dégradés doux, taches de couleur maîtrisées) pour que le verre ait quelque chose à réfracter ; les boutons et capsules sont plus opaques que les panneaux ; texte jamais posé directement sur le fond coloré.
- À ne pas copier : l'erreur de transparence excessive des premières bêtas.
- Observé dans la capture (`04-apple-macos-*`, page « macOS 27 ») : navigation en **capsules** (Overview, iOS, macOS…) dont l'élément sélectionné est une capsule blanche pleine ; un champ de saisie en verre sombre à très grand rayon, texte blanc très contrasté, posé sur un fond abstrait chaud et doux ; petites commandes en pilules (« Show Results », contrôles de carrousel). Les surfaces de verre qui portent du texte sont **sombres et peu transparentes**.

### 5. visionOS — Vibrancy et hiérarchie du texte sur verre

- Sources : https://developer.apple.com/videos/play/wwdc2023/10076/ ; https://www.createwithswift.com/ensuring-interface-legibility-and-contrast-in-visionos
- Ce que disent les sources : trois niveaux de vibrancy (primaire pour le texte standard, secondaire pour les descriptions, tertiaire pour les éléments inactifs seulement) ; ajouter un fond plus sombre derrière le texte ou les éléments interactifs améliore le contraste ; choisir un matériau selon l'usage, pas selon la couleur qu'il donne.
- Interprétation : le texte sur verre a **3 niveaux maximum**, et le niveau tertiaire n'est pas utilisé pour de l'information utile.
- Pour DevDocTrad : tokens `--text-1` (titres, commandes), `--text-2` (descriptions), `--text-3` (désactivé uniquement). Les avertissements de coût et de confidentialité sont en `--text-1` ou `--text-2`, jamais en `--text-3`.

### 6. Verre dichroïque (matière de référence pour l'irisation)

- Sources : https://en.wikipedia.org/wiki/Dichroic_glass ; https://www.generalglass.com/dichroic-glass-and-how-it-works/ ; https://libanswers.cmog.org/faq/143937
- Ce que disent les sources : la couleur vient d'une **interférence** dans de fines couches d'oxydes métalliques, pas d'un pigment ; la couleur **transmise** (vue à travers) diffère de la couleur **réfléchie** (vue sur fond sombre) ; la couleur change avec l'angle de vue.
- Interprétation : une irisation crédible n'est pas un arc-en-ciel uniforme. Elle a **deux couleurs complémentaires** (transmise et réfléchie) et change avec l'angle. Sur fond clair on voit surtout la couleur transmise, sur fond sombre la couleur réfléchie.
- Pour DevDocTrad : l'accent irisé utilise un couple de teintes qui varie selon le thème : thème clair, transmise cyan vers bleu ; thème sombre, réfléchie violet vers turquoise. Au survol d'une action majeure, le dégradé glisse légèrement (changement d'angle simulé), une seule fois, sans boucle.
- À ne pas faire : un dégradé arc-en-ciel complet sur chaque bordure.
- Observé dans la capture (`10-wikipedia-dichroic-light`) : la photo d'un pendentif en verre dichroïque montre des plages orange, violettes et bleues qui changent selon l'endroit, avec des zones sombres entre elles : les couleurs irisées sont **séparées par de l'ombre**, pas fondues en un dégradé continu.

### 7. Raycast — densité et finition d'un outil pour utilisateurs avancés

- Sources : https://raycast.com/blog/a-fresh-look-and-feel ; https://developers.raycast.com/api-reference/user-interface
- Ce que disent les sources (officielles) : la refonte regroupe « titre de navigation, notifications (toasts) et actions contextuelles avec leurs raccourcis clavier » dans **une seule barre en bas** de la fenêtre ; barre de recherche agrandie ; mode compact. Les reconstructions de design system trouvées sont non officielles et n'ont pas été retenues.
- Interprétation : dans un petit outil, **regrouper** l'état, les retours et les actions secondaires dans une barre unique évite d'éparpiller l'information.
- Pour DevDocTrad : le popup a une barre inférieure qui contient le raccourci clavier et les retours (toasts) au même endroit ; les raccourcis sont montrés comme des touches.
- À ne pas copier : le thème sombre unique de Raycast, sa palette rouge, sa liste de commandes.
- Observé dans la capture (`06-raycast-light*`) : fond presque noir, une seule touche de couleur forte (traînées lumineuses rouges en diagonale) réservée à la vitrine ; dans la fenêtre d'application, texte petit et dense, champ de filtre en haut, liste compacte. La couleur forte n'apparaît jamais dans l'outil lui-même.

### 8. Contraintes des popups d'extension (Chrome et Firefox)

- Sources : https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/Popups ; https://groups.google.com/a/chromium.org/g/chromium-extensions/c/U08htZ7r6RY ; https://extension.js.org/docs/implementation-guide/popup-sizing
- Ce que disent les sources : taille maximale 800 × 600 px dans Chrome et Firefox, pas d'API pour fixer la taille, le contenu au-delà défile ; un guide tiers recommande de rester bien en dessous.
- Interprétation : le popup doit tenir **sans défilement** dans ~360 × 560 px dans son état le plus chargé.
- Pour DevDocTrad : largeur fixe 360 px, hauteur visée ≤ 540 px ; la liste des clés se replie au-delà de 3 clés.

### 9. `backdrop-filter` : support et repli

- Sources : https://web.dev/articles/backdrop-filter ; https://caniuse.com/css-backdrop-filter ; https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
- Ce que disent les sources : support sans préfixe Chrome 76, Edge 79, Firefox 103 ; recommandation d'une **solution de repli** plutôt qu'un polyfill ; détection avec `@supports` ; des développeurs signalent que certains Firefox ont mal répondu à `@supports` pour cette propriété.
- Interprétation : nos cibles (Chrome ≥ 120, Firefox ≥ 140) supportent le flou, mais il faut un repli opaque **par défaut** et n'ajouter la transparence que si le flou est disponible.
- Pour DevDocTrad : matériau « Solid Fallback » écrit en premier, transparence ajoutée dans `@supports`. Flou limité aux panneaux (pas sur chaque bouton).

### 10. `prefers-reduced-transparency`

- Sources : https://developer.chrome.com/blog/css-prefers-reduced-transparency ; https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency
- Ce que disent les sources : disponible depuis Chrome 118/119 et Edge, derrière une option dans Firefox, absent de Safari ; recommandation de poser une valeur sûre par défaut puis d'ajouter le comportement selon la préférence.
- Interprétation : les personnes qui réduisent la transparence dans leur système doivent obtenir des surfaces opaques.
- Pour DevDocTrad : sous `prefers-reduced-transparency: reduce`, tous les matériaux passent en version opaque, l'irisation est réduite à la bordure du bouton principal.

## Ce que les captures ont changé dans la spécification

- Les panneaux qui portent du texte en thème sombre restent peu transparents (64 % à 86 % d'opacité), comme le champ de saisie de la page macOS.
- Le contrôle segmenté du popup utilise une capsule pleine pour l'élément sélectionné, comme la navigation de la page macOS.
- L'irisation reste concentrée sur une seule surface par écran (bouton principal), comme la couleur forte de Raycast, réservée à un seul endroit.

## Synthèse : principes retenus

1. Le verre est une **couche de commande**, le contenu reste stable (fiches 1, 2).
2. **Plusieurs épaisseurs** de verre, plus opaques quand la surface est grande ou pleine de texte (fiches 2, 4).
3. Le verre a besoin d'un **fond qui a de la matière** ; jamais de verre sur blanc uni (fiche 4).
4. Texte : 3 niveaux, le tertiaire réservé à l'inactif (fiche 5).
5. Irisation = **couple de teintes transmise/réfléchie** qui varie avec le thème et l'angle, jamais un arc-en-ciel partout (fiche 6).
6. Logo en **formes pleines superposées**, lisible sans effets (fiche 3).
7. Popup compact sans défilement, retours et raccourci regroupés dans une barre (fiches 7, 8).
8. Repli opaque d'abord, transparence ensuite ; respect de la réduction de transparence et de mouvement (fiches 9, 10).
