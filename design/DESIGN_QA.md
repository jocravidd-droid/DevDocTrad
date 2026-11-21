# DevDocTrad — Contrôle visuel et fonctionnel (design)

Date : 21 novembre 2026. Étape 9 de `design/DIRECTION_ARTISTIQUE.md`.

## Ce qui a été testé, et comment

| Élément | Navigateur | Tailles | Thèmes | Méthode |
|---|---|---|---|---|
| Popup, 6 états (prête, en cours, traduite, original affiché, page non traduisible, aucune clé) | Chromium (Playwright, extension non empaquetée réelle) | 360 px de large, densité 2 | clair et sombre | `node tools/qa_shots.js`, captures dans `design/qa/popup-*.png` |
| Badge sur la page (en cours, traduit, réduit) | Chromium | page 1280 × 800 | clair et sombre | idem, `design/qa/badge-*.png` |
| Réglages, 7 sections + états vides + 720 px de large + focus clavier | Chromium | 1280 et 720 px | clair et sombre | script de l'agent de refonte, `design/qa/options-*.png` |
| Parcours complet (traduction, original exact, bilingue, automatique, russe, réglages, popup) | Chromium | 1280 × 800 | clair | `node tools/e2e.js` : **20/20 vérifications** |
| Logo de 16 à 1024 px | Chromium (rendu SVG) | 16, 32, 48, 128, 512, 1024 | barres claire et sombre | `design/logo/comparaison-logos.png`, `check-small.png` |
| Cohérence des tokens, icônes, textes FR/EN, absence d'emoji et de couleurs en dur | Node | — | — | `tests/design.test.js` (7 tests), dans `npm test` : **67/67** |

Captures pour les boutiques et le site régénérées avec l'interface finale : `store/screenshots/*.png` (1280 × 800), `store/promo-440x280.png`, `store/promo-1400x560.png`, `docs/assets/*.png`.

## Test avec une vraie IA (Groq, clé gratuite)

`tools/e2e_real.js` avec `openai/gpt-oss-120b` sur Groq, environ 25 requêtes au total sur la journée (limite gratuite : 1 000 par jour, 8 000 jetons par minute) :

- page de démo : 21 passages traduits en une requête, aucun échec, original restauré à l'identique ;
- vraie page MDN (`Window.alert()`) : 342 passages, 168 éléments `code`/`pre` identiques avant et après ;
- vrai README GitHub (`sindresorhus/is-online`) : 379 passages, 32 éléments de code identiques ;
- qualité : fidèle, sans résumé, typographie française correcte, identifiants (`window.alert()`, `navigator.onLine`, `Promise<boolean>`) intacts ;
- la clé n'apparaît dans aucun journal.

Défauts trouvés par ce test et corrigés : limites de Groq atteintes vite (réflexion du modèle réduite avec `reasoning_effort: low`, pause courte anticipée grâce aux en-têtes `x-ratelimit-*`) ; menus traduits avant l'article (le contenu principal passe maintenant en premier) ; limite de caractères par page qui ne pouvait pas descendre sous 150 000.

Clé Gemini fournie : projet Google en facturation prépayée à zéro (réponse 402), donc aucune traduction possible ; arrêt immédiat vérifié, aucun coût possible.

## Problèmes vus sur les captures et corrigés

| Surface | Problème observé | Correction |
|---|---|---|
| Popup | Le bouton Stop débordait à droite | Stop affiché seulement pendant une traduction ; segmenté compressible |
| Popup | La feuille décalée teintait tout le panneau en lavande (verre translucide) | La couche arrière n'est colorée qu'au coin haut-gauche, comme le logo |
| Popup | État « en cours » trop pâle en sombre (bouton désactivé à 45 %) | État `busy` qui garde l'irisation, curseur d'attente, indicateur rotatif |
| Popup | Icône et texte écartés dans le segmenté | Sélecteur CSS corrigé (`.seg label > span`) |
| Popup | Hauteur 616 px, défilement | Espacements resserrés : 555 px au maximum, sans défilement |
| Badge | Message coupé (« trad… ») | Fournisseur déplacé dans l'info-bulle ; message court |
| Réglages | « $ » supprimé par le système de traduction du navigateur | Signes doublés `$$` dans les textes concernés |
| Réglages | Pastilles de consommation affichées en bloc et en gris | Règle CSS partagée corrigée |
| Réglages | Rangée de navigation étroite qui coupait les mots sans signe de défilement | Fondu sur les bords |
| Réglages | Sauvegarde qui pouvait écraser un site ajouté depuis le popup | Relecture du stockage avant fusion |
| Captures boutiques | Commentaire de code traduit alors que l'option est désactivée par défaut | Captures refaites avec les réglages par défaut |

## Grille de validation (section 13 de la direction artistique)

Notes données par Claude à partir des captures, à confirmer par l'utilisateur.

| Critère | Note | Justification |
|---|---|---|
| Identité | 4 | Logo « feuilles décalées » et motif de feuille décalée repris dans le popup et l'en-tête des réglages ; reconnaissable sans le nom à 32 px et plus. |
| Originalité | 4 | Pas de grille de cartes identiques ; listes groupées ; une seule surface irisée par écran. Reste proche des conventions des réglages système (voulu). |
| Qualité du verre | 4 | 4 épaisseurs + repli opaque, fond « lumière » pour que le verre réfracte quelque chose ; pas de réfraction simulée (non pertinente techniquement). |
| Hiérarchie | 5 | Action principale évidente ; état en pastille juste au-dessus. |
| Lisibilité | 4 | Texte jamais posé sur le fond brut ; contraste mesuré à l'œil sur captures, **pas avec un outil de mesure de contraste**. |
| Cohérence | 4 | Mêmes tokens, icônes et matériaux partout ; badge volontairement plus neutre. |
| Sobriété fonctionnelle | 5 | Badge compact, sans irisation, réductible en pastille. |
| Interactions | 4 | Survol, appui, focus, chargement, succès, erreur présents ; transitions vérifiées en fonctionnement, pas filmées. |
| Performance | 4 | Flou limité à 2 ou 3 panneaux par écran, pas d'animation continue hors chargement. **Non mesuré** sur machine modeste. |
| Fidélité au projet | 5 | Aucune fonction retirée ; 67 tests unitaires et 20 vérifications de bout en bout passent. |

## Problèmes non résolus

- En-tête des réglages : un filet très fin de la feuille arrière reste visible sur le bord droit à travers le verre (vient du style partagé `.sheet`). Mineur.
- Raccourci clavier : Chromium sans interface n'attribue pas `Alt+Maj+T`, les captures montrent donc « aucun » ; l'affichage d'un raccourci attribué n'a pas été capturé.
- Les références Behance n'ont pas pu être consultées (page vide sans connexion).

## Non testé (à faire par l'utilisateur)

- **Firefox, Edge et Brave** : rien n'a été testé visuellement dans ces navigateurs ici (seulement Chromium). À vérifier : rendu du flou dans Firefox, popup dans Edge et Brave.
- Vrai popup ouvert depuis l'icône de la barre d'outils (les captures ouvrent `popup.html` dans un onglet, avec la même taille).
- Écran haute densité réel, machine modeste, réglage système « réduire la transparence » et « réduire les animations ».
- Lecteurs d'écran.
