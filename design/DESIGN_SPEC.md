# DevDocTrad — Spécification de design

Version 1.0 — 21 novembre 2026. Applique `design/DIRECTION_ARTISTIQUE.md` ; s'appuie sur `design/DESIGN_RESEARCH.md`. Remplace uniquement l'apparence décrite à la section 7 de `PLAN.md` ; le fonctionnement reste celui du plan.

## 1. Trois pistes étudiées

| | A. Prisme feuilleté | B. Verre nuit | C. Studio nacré |
|---|---|---|---|
| Idée | Le motif du logo (feuille décalée) devient la signature de l'interface : le panneau principal a une couche décalée derrière lui. Verre nacré en clair, bleu nuit en sombre. Irisation réservée au logo, à l'action principale et à la progression. | Interface pensée d'abord en sombre : champ bleu lumineux derrière des panneaux indigo très translucides, comme la référence 2 (logiciel de conception). Accents électriques fins sur les contours. | Surfaces presque opaques blanc nacré, verre seulement dans l'en-tête et la barre d'outils, irisation en filets de 1 px. |
| Matériaux | 4 épaisseurs (primaire, secondaire, flottant, contrôle) + repli opaque | 2 épaisseurs très transparentes | 1 surface opaque + 1 verre |
| Logo | Feuilles décalées pleines + verre prismatique | Idem, avec halo lumineux | Idem en version plate |
| Popup | Panneau « feuille » avec état, action irisée, progression, segmenté ; panneau secondaire pour clé et automatique | Grande zone lumineuse, commandes flottantes | Liste simple, bouton bleu |
| Badge | Pilule compacte, verre discret, aucune irisation | Panneau indigo lumineux | Pilule opaque |
| Avantages | Identité reconnaissable sans lire le nom ; lisible ; hiérarchie claire ; coûts de flou limités | Spectaculaire, très « futuriste » | Très lisible, très léger |
| Risques | Le motif de feuille décalée doit rester rare pour ne pas devenir un gadget | Fatigue en lecture longue, thème clair faible, glisse vers le cyberpunk (néons) interdit | Retombe dans le « minimal je sais pas quoi » refusé par l'utilisateur ; générique |

**Choix : A, Prisme feuilleté.** Raisons : c'est la seule piste où l'identité vient du produit (les couches de document du logo) et pas d'un effet ajouté ; elle applique les principes observés (verre pour la couche de commande, plusieurs épaisseurs, texte jamais sur un reflet) ; les deux thèmes ont chacun leur personnalité ; elle garde le badge neutre ; le flou n'est posé que sur 2 à 3 panneaux par écran (performance).

## 2. Principes de marque

1. La traduction est une **couche posée sur le document**, jamais une réécriture : la feuille décalée l'exprime.
2. **Le verre commande, le contenu reste stable** : textes d'état et listes sur des surfaces épaisses et contrastées.
3. **Une seule surface irisée par écran** : l'action principale (popup) ou l'élément sélectionné (réglages). Le logo est toujours irisé.
4. **Discrétion sur les pages lues** : le badge n'est pas une vitrine.

## 3. Tokens

Source unique : `src/tokens.css`. Le badge (shadow DOM dans les pages) recopie les valeurs nécessaires ; `tests/design.test.js` vérifie qu'elles restent identiques.

- **Fond « lumière »** : `--bg-base` + 4 champs radiaux (cyan, bleu, violet, turquoise en clair ; bleu, violet, sarcelle en sombre). Il existe pour que le verre ait quelque chose à réfracter (fiche 4 de la recherche).
- **Matériaux** :
  - `.m-primary` : `--glass-primary` (blanc 70 % / indigo 64 %), flou 28 px, saturation 180 %, contour `--edge`, reflet haut `--edge-inner`, ombre `--shadow-2`. Pour l'état et l'action principale.
  - `.m-secondary` : 50 % / 46 %, flou 18 px, ombre légère. Pour les réglages rapides et listes.
  - `.m-floating` : 84 % / 86 %, ombre `--shadow-3`. Pour les notifications et menus.
  - Contrôles : `--glass-control` 88 % / 78 % (plus opaques que les panneaux, fiche 4).
  - Repli : `--solid-fallback`, appliqué d'abord, puis verre dans `@supports (backdrop-filter)` ; forcé sous `prefers-reduced-transparency: reduce`.
- **Couche décalée** (`.sheet::before`) : `--sheet-back`, translation (-7 px, -7 px), rotation -1,6°. Utilisée uniquement sur le panneau principal du popup et l'en-tête des réglages.
- **Texte** : `--text-1` (titres, commandes, avertissements), `--text-2` (descriptions), `--text-3` (inactif seulement).
- **Accent** : `--accent` #2f6bff (clair) / #5b8cff (sombre). **Irisation** `--iris` : clair = couleur transmise (bleu, cyan, turquoise, violet) ; sombre = couleur réfléchie (violet, bleu, cyan, turquoise), d'après la fiche 6.
- **États** : `--ok`, `--warn`, `--err`, `--info` et leurs fonds ; toujours avec une icône et un texte.
- **Rayons** : 6, 9, 12, 18, 24, pilule. **Espacements** : grille de 4 px. **Ombres** : 3 niveaux.
- **Typographie** : pile système (`-apple-system`, SF Pro, Segoe UI Variable, system-ui) ; `--mono` pour les données techniques (modèles, hôtes, compteurs, raccourcis). Tailles 11 à 26 px ; jamais moins de 11 px.
- **Mouvement** : 120 ms (retour de bouton), 200 ms (transitions), 320 ms (apparitions) ; courbe `cubic-bezier(.2,.8,.2,1)`.

## 4. Thèmes

- Réglage **Apparence : Système / Clair / Sombre** (`settings.theme`, défaut `system`).
- Clair = verre nacré, reflets cyan et bleu, violet mesuré. Sombre = bleu nuit et indigo, reflets violet, turquoise et cyan, contours lumineux mais non néon. Les deux jeux de valeurs sont écrits séparément.
- Pas de flash : `theme.js` (chargé dans `<head>`) applique le choix mémorisé dans `localStorage` avant l'affichage ; `ui.js` le resynchronise depuis `storage.local`.
- Le badge suit le même réglage (attribut `data-theme` sur l'hôte du shadow DOM).

## 5. Icônes

Une seule famille dessinée pour DevDocTrad (`src/ui.js`) : grille 24, trait 1,8, extrémités et jonctions rondes, contours seulement. L'icône « traduire » reprend les deux feuilles du logo. Toute icône d'action a un nom accessible. Aucun emoji.

## 6. Composants et états

Boutons (normal, survol plus clair et ombre plus marquée, focus anneau `--focus` 3 px, appui échelle 0,97, désactivé 45 %, chargement avec indicateur rotatif), bouton héros irisé (survol : le dégradé glisse, comme un changement d'angle du verre dichroïque ; une seule fois, pas de boucle), champs, liste déroulante, interrupteur, contrôle segmenté, pastilles d'état, barre de progression irisée, touches de clavier, listes groupées à filets (au lieu d'une carte par champ), notifications.

## 7. Surfaces

### 7.1 Popup (360 px, sans défilement)
En-tête (symbole, nom, hôte en police mono, bouton Réglages) → panneau « feuille » : pastille d'état + compteur, bouton héros « Traduire cette page », progression, segmenté Original / Traduction, Stop, message → panneau secondaire : clé (automatique ou précise), interrupteur « Traduire automatiquement ce site », note page sensible → état des clés (3 max + « et N autres »), lien Gérer → pied : raccourci en touches. États couverts : prête, aucune clé, en cours, traduite, original affiché, arrêtée, limite de page, erreur, page non traduisible.

### 7.2 Réglages
Barre latérale de navigation (matériau le plus opaque) avec 7 sections : Fournisseurs et clés, Traduction, Confidentialité et coûts, Sites, Glossaire, Données, Apparence. Contenu en listes groupées ; les clés restent des cartes (une carte = un fournisseur configuré). Avertissements de coût et de confidentialité visibles en texte, jamais seulement en info-bulle. Actions destructrices en rouge et confirmées. Sous 760 px de large, la barre latérale devient une rangée de navigation horizontale.

### 7.3 Badge sur les pages
Pilule compacte (≤ 320 px), verre discret sans halo ni irisation, symbole monochrome, texte de progression, barre fine, commandes en icônes avec noms accessibles (Stop, Original/Traduction, Réduire, Fermer). Réduit : pastille de 36 px. Aucune animation hormis la barre de progression. `aria-live="polite"`.

### 7.4 Notifications
Matériau flottant, icône d'état + texte + fermer ; succès 2,5 s, info 4 s, avertissement 7 s, erreur jusqu'à fermeture ; 3 au maximum à la fois ; liseré gauche coloré pour avertissement et erreur.

## 8. Accessibilité

Contraste du texte principal ≥ 4,5:1 sur les deux thèmes (texte sur verre posé sur fond le plus clair et le plus sombre) ; focus visible partout ; navigation clavier complète ; états jamais signalés par la couleur seule ; `prefers-reduced-motion` (animations réduites à 1 ms, indicateur fixe) ; `prefers-reduced-transparency` (surfaces opaques).

## 9. Compatibilité et performance

Chrome ≥ 120, Edge, Brave, Firefox ≥ 140 : `backdrop-filter` disponible, repli opaque malgré tout. Flou limité à 3 panneaux par écran ; pas d'animation continue en dehors du chargement ; aucune ressource distante (polices système, icônes en SVG intégré).

## 10. Logo

Trois pistes dessinées en SVG (`design/logo/piste-*.svg`) et comparées aux tailles réelles (128, 48, 32, 16 px) sur barres d'outils claire et sombre : `design/logo/comparaison-logos.png`.

| Critère | A. Feuilles décalées | B. Page à travers un prisme | C. Page pliée en couches |
|---|---|---|---|
| Reconnaissance | Forte : deux pages | Forte à 128 px | Moyenne |
| Originalité | Bonne (décalage + verre) | Très bonne | Faible : proche d'une icône de fichier générique |
| Rapport au produit | Source + traduction superposées | Transformation | Document |
| Lisible à 16 px | Oui (silhouette « deux feuilles ») | Non (bouillie de traits) | Oui, mais générique |
| Animation possible | Décalage des feuilles | Lumière dans le prisme | Pliage |
| Cohérence avec l'interface | Donne le motif « feuille décalée » | Difficile à réutiliser | Faible |

**Retenue : A**, affinée. Fichiers :

- `design/logo/devdoctrad-symbol.svg` : master vectoriel (feuille arrière indigo pleine, feuille avant en verre prismatique bleu, cyan, turquoise, violet, reflet spéculaire, trois lignes de texte) ;
- `design/logo/devdoctrad-symbol-small.svg` : version dessinée pour 16 et 32 px (deux lignes, sans contour ni reflet) ;
- `design/logo/devdoctrad-mono.svg` : version monochrome (`currentColor`) ;
- `design/logo/devdoctrad-logotype-light.svg` et `-dark.svg` : symbole + nom ;
- exports PNG : `node tools/export_logo.js` produit `src/icons/icon-16/32/48/128.png`, `store/icon-128.png` (96 px d'image + 16 px de marge transparente, format du Chrome Web Store), les images du site et `design/logo/devdoctrad-symbol-1024.png`.

Contrôle à 16 px : `design/logo/check-small.png` (agrandissement sans lissage à droite) : les deux feuilles et deux lignes restent distinctes.
