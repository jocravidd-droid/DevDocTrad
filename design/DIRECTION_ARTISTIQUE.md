# DevDocTrad — Cahier des charges complet de direction artistique et d'expérience utilisateur

**Version :** 1.0  
**Date :** 21 novembre 2026  
**Statut :** direction artistique validée par l'utilisateur  
**Projet :** [jocravidd-droid/DevDocTrad](https://github.com/jocravidd-droid/DevDocTrad)

---

## 0. Instruction prioritaire à Claude

Tu dois agir comme un **directeur artistique, UX designer et intégrateur front-end rigoureux**, pas comme un générateur de dashboards.

L'utilisateur a déjà choisi une direction. Tu ne dois pas la remplacer par tes préférences ni improviser à partir d'un template. Tu dois rechercher des références réelles, les analyser, établir une direction artistique cohérente, la traduire en composants réels, puis vérifier visuellement le résultat.

**Le but n'est pas de mettre du flou et des dégradés sur l'interface existante. Le but est de concevoir une véritable identité de produit premium pour DevDocTrad.**

### Décisions non négociables

- Usage principal : popup compact ouvert depuis l'icône de l'extension dans la barre d'outils du navigateur.
- Le design concerne toute l'extension : popup, page de réglages, badge dans les pages web, notifications et icônes.
- Direction visuelle : mélange d'Apple Liquid Glass, d'effets holographiques/irisés et de futurisme maîtrisé.
- Identité : environ 70 % de références esthétiques Apple et 30 % de personnalité propre à DevDocTrad. Cette proportion est une orientation artistique, pas une règle mathématique.
- Couleurs adaptatives : palette et intensité lumineuse adaptées au thème clair ou sombre. Le thème du système est le choix initial ; l'utilisateur peut aussi choisir manuellement clair, sombre ou système.
- Intensité visuelle : effets de verre bien visibles et matériaux travaillés, avec des effets plus spectaculaires réservés aux éléments qui le méritent. Pas d'effet permanent qui fatigue ou gêne.
- Popup : organisation fonctionnelle en priorité, avec une présentation visuelle forte. Pas de grande zone décorative qui repousse les commandes utiles.
- Badge sur les pages web : très discret et uniquement fonctionnel, pour ne pas gêner la lecture.
- Logo : symbole original représentant des couches de documents transformées ou décalées, avec une matière de prisme irisé.
- Aucun emoji comme icône d'interface.
- Aucune fonctionnalité existante ne doit être supprimée ou modifiée pour faciliter le design.

---

## 1. Comprendre le produit avant de le dessiner

DevDocTrad est une extension de navigateur qui traduit en français les documentations techniques et les sites utilisés par les développeurs, directement sur la page. Le dépôt décrit notamment les documentations officielles, README et issues GitHub, Stack Overflow, forums, blogs techniques et pages de frameworks.

Le produit a une contrainte centrale : **traduire fidèlement sans endommager le contenu technique**.

Le dépôt et son `PLAN.md` décrivent notamment :

- traduction fidèle phrase par phrase, sans résumé, omission ou ajout ;
- conservation du code, des commandes, identifiants, noms de fonctions, API, chemins et URL ;
- conservation de la structure de la page, des liens, du gras et des éléments de code ;
- possibilité de revenir à l'original ou d'afficher un mode bilingue ;
- popup de déclenchement et de contrôle ;
- page de réglages pour les fournisseurs, clés, modèles, options, glossaire, sites automatiques et cache ;
- badge d'état dans les pages, isolé dans un Shadow DOM ;
- fournisseurs prévus dans le plan : Gemini, Groq, Mistral, OpenRouter et Ollama local ;
- navigateurs visés : Chrome, Edge, Brave et Firefox.

### Source fonctionnelle à respecter

Le document fonctionnel de référence est le `PLAN.md` du dépôt, version 2.1 datée du 21 novembre 2026 :

https://github.com/jocravidd-droid/DevDocTrad/blob/main/PLAN.md

**Cette directive de design ne remplace pas le plan fonctionnel.** Elle remplace uniquement l'ancienne direction visuelle décrite dans la section 7 du `PLAN.md`.

La section 7 actuelle décrit une interface sobre, sans décoration superflue et avec une seule couleur d'accent. Cette ancienne direction visuelle est désormais remplacée par la direction Liquid Glass définie dans ce document.

En revanche, toutes les exigences fonctionnelles, techniques, de confidentialité, de sécurité, de coût et de compatibilité du `PLAN.md` restent applicables.

### Règle de priorité en cas de contradiction

1. Pour le comportement, la traduction, les fournisseurs, les limites, les permissions, la sécurité, les tests et les navigateurs : suivre le `PLAN.md` actuel.
2. Pour l'apparence, les matériaux, les couleurs, la composition, le logo, les animations et les composants : suivre ce document.
3. Si une décision visuelle semble nécessiter une modification fonctionnelle ou architecturale, ne pas l'effectuer silencieusement. Chercher une solution visuelle qui respecte le plan. Si aucune solution n'est possible, présenter clairement le conflit avant de toucher au fonctionnement.

### Règles de traduction à ne pas déformer

Le `PLAN.md` version 2.1 demande une fidélité stricte : les termes techniques anglais déjà présents en anglais restent en anglais, sans explication ajoutée par défaut. L'option d'explication des termes est désactivée par défaut. Ne pas réintroduire une ancienne règle qui ajouterait systématiquement une traduction française entre parenthèses.

Le design ne doit jamais faire croire que l'extension réécrit, résume, explique ou modifie le code.

---

## 2. Direction artistique globale

### 2.1 Concept

**Apple Liquid Glass × Iridescent Prism × Developer Tool Premium.**

L'interface doit combiner :

- la qualité de matière, la profondeur et la retenue des interfaces Apple ;
- des reflets irisés et des variations de couleur inspirés du verre dichroïque/prismatique ;
- quelques accents futuristes lumineux, maîtrisés et précis ;
- la densité et la clarté fonctionnelle attendues d'un outil destiné aux développeurs.

L'ensemble doit donner envie d'ouvrir le popup, mais rester agréable quand l'utilisateur travaille longtemps dans une documentation.

### 2.2 Ce que l'interface doit transmettre

- Qualité et précision.
- Modernité et maîtrise technique.
- Confiance dans la préservation du texte.
- Fluidité et réactivité.
- Une identité reconnaissable, pas un thème générique.

### 2.3 Ce qu'elle ne doit pas devenir

- Un dashboard SaaS générique.
- Une interface cyberpunk remplie de néons.
- Une accumulation de cartes rondes et de dégradés violets.
- Une copie littérale de macOS ou d'une application Apple.
- Une maquette statique qui est jolie en capture mais pénible à utiliser.
- Une interface où chaque texte, panneau et bouton est flou ou transparent.

---

## 3. Références visuelles et recherches obligatoires

Claude ne doit pas se contenter d'écrire « style Apple » dans un prompt d'image. Il doit ouvrir et observer des références réelles, relever leurs principes et expliquer ce qu'il adapte.

### 3.1 Sources prioritaires

1. **Apple Human Interface Guidelines**  
   https://developer.apple.com/design/human-interface-guidelines/  
   Référence pour la hiérarchie, les contrôles, les matériaux, les interactions, l'accessibilité et la cohérence.

2. **Apple — Liquid Glass / Technology Overview**  
   https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass  
   Référence pour comprendre l'intention du matériau, les couches et la relation entre contenu et commandes.

3. **Apple macOS**  
   https://www.apple.com/macos/  
   Référence visuelle pour les fenêtres, panneaux, réglages, contrôles et surfaces translucides.

4. **Chrome Extensions — Documentation officielle**  
   https://developer.chrome.com/docs/extensions/  
   Référence technique pour comprendre les contraintes d'une extension et éviter les propositions d'interface irréalisables.

5. **MDN — `backdrop-filter`**  
   https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter  
   Référence technique parmi d'autres pour les effets de verre, avec des solutions de repli.

6. **Raycast**  
   https://www.raycast.com/  
   Référence secondaire pour la densité d'information, la finition et les interactions d'un outil destiné aux utilisateurs avancés. Ne pas copier son interface.

7. **Behance**  
   https://www.behance.net/  
   Source d'inspiration pour les matériaux irisés, les icônes 3D et les études d'identité visuelle. Les projets trouvés sont des références, pas des templates à reproduire.

### 3.2 Requêtes de recherche à employer

Effectuer plusieurs recherches ciblées, puis retenir uniquement les références qui présentent un vrai intérêt :

- `Apple Liquid Glass interface materials`
- `macOS Tahoe Control Center translucent panels`
- `visionOS glass material visual hierarchy`
- `iridescent dichroic glass material macro photography`
- `optical glass refraction 3D icon design`
- `premium macOS utility settings interface`
- `developer tool settings interface design`
- `browser extension popup interaction design`
- `compact extension popup UI hierarchy`
- `light and dark translucent glass interface`
- `iridescent folded paper glass app icon`

### 3.3 Références initiales fournies par l'utilisateur

Deux images ont été fournies dans la conversation :

- **Référence 1 :** symbole en forme de pomme en matériau brillant, avec des couches et reflets violet, bleu, cyan et turquoise. À retenir : la richesse chromatique, l'effet de matière liquide/prismatique, les reflets et la profondeur. À ne pas reprendre : la silhouette de la pomme, qui est une marque existante.
- **Référence 2 :** interface de conception avec panneaux flottants translucides, arrière-plan bleu lumineux, grandes surfaces vitrées, commandes et panneau latéral de réglages. À retenir : la composition en couches, les panneaux de verre et la sensation de profondeur. À adapter : la densité et la taille des composants à un popup Chrome compact.

### 3.4 Dossier de recherche à produire

Créer `DESIGN_RESEARCH.md` contenant au minimum 8 références réellement consultées et différentes.

Pour chaque référence, noter :

- nom et URL de la source ;
- capture d'écran ou image avec contexte ;
- ce qui est observé, sans inventer ;
- matériau, palette et composition ;
- détails d'interaction observés, uniquement si l'interaction a réellement été testée ou documentée ;
- le principe intéressant pour DevDocTrad ;
- ce qu'il ne faut pas copier ;
- comment adapter ce principe au popup, aux réglages, au badge ou aux notifications.

Ne jamais prétendre avoir consulté une interface si elle n'a pas été ouverte. Ne pas présenter une image générée par IA comme une capture d'une vraie application.

---

## 4. Système de matériaux Liquid Glass

Le verre doit être un véritable système de surfaces, pas un filtre unique appliqué à chaque élément.

### 4.1 Familles de matériaux

Créer quelques matériaux réutilisables avec des rôles distincts :

1. **Glass / Primary** : surface principale, lisible, transparence modérée, flou maîtrisé, contour lumineux discret.
2. **Glass / Secondary** : panneau secondaire plus discret, transparence un peu plus forte, contraste suffisant.
3. **Glass / Floating** : menus et éléments flottants, profondeur plus marquée, ombre douce.
4. **Glass / Control** : boutons, capsules et contrôles, surface plus nette avec états précis.
5. **Iridescent Accent** : accent prismatique réservé au logo, aux actions majeures et à quelques détails clés.
6. **Solid Fallback** : version opaque ou semi-opaque quand le flou n'est pas disponible ou coûte trop cher.

Les noms sont conceptuels ; Claude peut les adapter à la structure de code existante.

### 4.2 Effets autorisés

- transparence variable ;
- flou d'arrière-plan modéré ;
- contour lumineux fin ;
- reflets spéculaires ;
- léger dégradé interne ;
- variations de teinte selon la lumière ;
- ombres douces pour séparer les plans ;
- réfraction simulée ou distorsion très discrète uniquement si elle est techniquement pertinente ;
- profondeur obtenue par plusieurs couches clairement hiérarchisées.

### 4.3 Règles d'utilisation

- Ne pas appliquer le même matériau à tous les composants.
- Garder les surfaces de lecture plus stables et plus contrastées.
- Ne pas placer du texte essentiel sur un reflet lumineux ou un fond trop changeant.
- Utiliser les reflets comme accent, pas comme texture permanente.
- Ne pas exagérer le flou : le fond doit rester suffisamment identifiable pour donner de la profondeur, sans brouiller l'interface.
- Prévoir un rendu de repli lisible si `backdrop-filter` ou certaines propriétés ne sont pas disponibles.

---

## 5. Palette et thèmes

### 5.1 Palette de marque

Palette d'identité à explorer :

- bleu profond ;
- bleu électrique ;
- cyan ;
- turquoise ;
- violet ;
- reflets irisés entre ces teintes ;
- blanc nacré pour les zones lumineuses.

L'utilisateur a demandé une palette adaptative : ne pas figer toute l'interface sur un seul dégradé bleu-violet.

### 5.2 Thème clair

Direction souhaitée :

- surfaces blanc nacré/translucides ;
- reflets cyan et bleu clair ;
- accents violets mesurés ;
- ombres douces mais suffisamment visibles ;
- texte sombre très lisible ;
- contours subtils pour distinguer les surfaces.

### 5.3 Thème sombre

Direction souhaitée :

- surfaces bleu nuit ou indigo profond ;
- reflets cyan, turquoise et violet ;
- contours plus lumineux mais non néon ;
- texte clair avec contraste mesuré ;
- ombres et séparations adaptées au fond sombre.

### 5.4 Comportement du thème

- Valeur initiale : suivre le thème du système (`prefers-color-scheme`).
- Ajouter un choix manuel : Système / Clair / Sombre.
- Les deux thèmes doivent être conçus séparément, pas obtenus par inversion automatique de quelques couleurs.
- Vérifier les contrastes, les états hover/focus/disabled, les notifications et les textes sur toutes les surfaces.
- Le changement de thème doit être instantané ou accompagné d'une transition légère, sans flash blanc/noir.

### 5.5 Design tokens

Créer une source de vérité centralisée pour les tokens : couleurs, matériaux, bordures, ombres, rayons, espacements, typographie, niveaux de profondeur et durées d'animation.

Éviter les valeurs différentes codées au hasard dans chaque composant. Le système doit rester modifiable globalement.

---

## 6. Logo et identité de marque

### 6.1 Décision validée

**Concept retenu : document transformé + matière de prisme irisé.**

Le symbole doit évoquer deux ou plusieurs couches de documents qui se croisent, se décalent ou se transforment visuellement. Les couches représentent la source, la traduction et la conservation de la structure.

La matière évoque un prisme en verre irisé : reflets bleus, violets, cyan et turquoise, transparence maîtrisée, réfraction et profondeur 3D subtile.

### 6.2 Ce qu'il faut éviter

- une pomme ou une silhouette de logo Apple ;
- deux bulles de dialogue ordinaires ;
- deux lettres ou deux drapeaux juxtaposés ;
- un globe terrestre générique ;
- une feuille de document banale avec un simple dégradé ;
- un logo trop détaillé qui devient illisible à petite taille ;
- un symbole dont la reconnaissance dépend exclusivement des reflets et effets 3D.

### 6.3 Méthode de création

Préparer au moins trois pistes originales basées sur le concept retenu :

- deux feuilles/couches qui se décalent ;
- une feuille dont les couches semblent traverser un prisme ;
- une forme de page pliée ou superposée avec un espace négatif distinctif.

Comparer les propositions avec des critères : reconnaissance, originalité, rapport au produit, lisibilité à petite taille, possibilité d'animation et cohérence avec l'interface.

L'utilisateur a validé le concept général, pas une forme finale précise : choisir une piste seulement après comparaison visuelle, sans prétendre que le logo est validé avant cela.

### 6.4 Livrables du logo

- master vectoriel (SVG) ;
- exports PNG 16 × 16, 32 × 32, 48 × 48 et 128 × 128, conformément aux tailles prévues dans le projet ;
- versions sur fond clair et fond sombre si nécessaire ;
- version monochrome ou simplifiée pour les contextes de très petite taille ;
- symbole seul et version avec logotype « DevDocTrad ».

Tester réellement l'icône à 16 × 16 pixels : sa silhouette doit rester identifiable même sans les effets irisés.

---

## 7. Architecture des interfaces

Le design s'applique à toute l'extension, mais la densité et le niveau de décoration doivent dépendre du contexte.

| Surface | Priorité | Intensité visuelle |
|---|---|---|
| Popup | Action immédiate et état de traduction | Forte, mais compacte et fonctionnelle |
| Réglages | Organisation, compréhension et contrôle | Moyenne à forte, surfaces de verre structurées |
| Badge sur la page | État et commandes essentielles | Très faible, fonctionnel |
| Notifications | Retour immédiat | Faible à moyenne, selon l'importance |
| Icônes | Reconnaissance de la marque | Forte qualité de matière, silhouette simple |

### 7.1 Popup Chrome

L'utilisateur a choisi le popup ouvert depuis l'icône de l'extension. Il doit être compact, immédiatement compréhensible et fonctionnel.

**Disposition recommandée :**

1. En-tête de marque : symbole, nom DevDocTrad, nom d'hôte ou domaine actuel.
2. État de la page : prête, traduisible, déjà traduite, traduction en cours, arrêtée, indisponible ou erreur.
3. Action principale : « Traduire cette page ».
4. Progression : progression claire pendant la traduction, sans animation décorative permanente.
5. Contrôle de langue d'affichage : original / traduction, conformément aux fonctionnalités du plan.
6. Bouton Stop lorsque la traduction est active.
7. Choix de clé : automatique ou clé précise, comme défini dans le `PLAN.md`.
8. Contrôle « Traduire automatiquement ce site ».
9. État utile des clés : disponible, en pause, délai éventuel et compteurs prévus par le plan.
10. Rappel du raccourci clavier.
11. Lien vers les réglages.

**Principes de composition :**

- La commande principale doit être immédiatement identifiable.
- L'en-tête donne la personnalité de la marque sans devenir une bannière géante.
- Les contrôles secondaires peuvent être regroupés dans des panneaux/capsules de verre.
- Éviter les grandes illustrations décoratives qui réduisent l'espace utile.
- Aucun écran vide inutile : afficher un état explicatif et une prochaine action pertinente.
- Ne pas supprimer ou inventer de commande par rapport au `PLAN.md`.

### 7.2 Page de réglages

La page de réglages doit être plus spacieuse que le popup et permettre une navigation claire entre les catégories prévues par le plan.

Organiser les éléments sans créer une longue suite de cartes identiques.

Catégories à retrouver, selon les fonctions existantes :

- Fournisseurs et clés API : cartes de configuration, clés masquées, statut, modèles, limites, ordre et actions Tester/Supprimer.
- Ollama : adresse, modèle, test et informations de disponibilité.
- Traduction : langue cible, mode remplacer/bilingue, options prévues.
- Confidentialité et coûts : informations de transmission, statut gratuit/local/payant, plafonds et consommation.
- Traduction automatique : liste des sites autorisés et gestion des autorisations.
- Pages sensibles : motifs supplémentaires prévus par le plan.
- Glossaire personnel : liste, import et export.
- Cache et données : taille, vider le cache.
- Apparence : système/clair/sombre.

L'organisation visuelle doit distinguer clairement les groupes : navigation latérale ou navigation par sections selon ce qui fonctionne le mieux dans l'architecture existante. Ne pas imposer une navigation latérale si elle réduit excessivement l'espace sur la taille réellement utilisée.

**Règles pour les réglages techniques :**

- Les avertissements de confidentialité et de coût doivent être lisibles, jamais cachés dans un tooltip uniquement.
- Les états de fournisseur doivent être explicites.
- Une clé masquée doit rester masquée par défaut.
- Les actions destructrices comme Supprimer ou Vider le cache doivent être distinctes et confirmées si nécessaire.
- Les listes de modèles doivent rester lisibles même lorsqu'elles sont longues.
- Ne pas utiliser des cartes décoratives pour chaque simple champ.

### 7.3 Badge sur les pages web

Le `PLAN.md` prévoit un badge d'état fixé en bas à droite, isolé dans un Shadow DOM, réductible et accessible au clavier. L'utilisateur demande qu'il reste **très discret et uniquement fonctionnel**.

Il doit pouvoir afficher, selon l'état :

- progression des unités traduites ;
- bouton Stop ;
- bascule Original / Traduction ;
- erreur ou état nécessaire ;
- nombre d'unités laissées dans la langue originale, si prévu.

Règles de présentation :

- surface compacte et neutre ;
- verre discret, sans halo décoratif ;
- contraste suffisant ;
- ne pas masquer de façon permanente les boutons ou le texte du site ;
- possibilité de réduire le badge ;
- support clavier et annonce accessible de la progression ;
- aucune animation spectaculaire sur une page de documentation.

Le badge ne doit pas appliquer le style Liquid Glass au contenu de la page elle-même.

### 7.4 Notifications

Concevoir des notifications de succès, information, progression, avertissement et erreur.

- dimensions modestes ;
- apparition/disparition fluide ;
- icône cohérente et non emoji ;
- message direct ;
- contraste et hiérarchie clairs ;
- pas de popup intrusif pour chaque action ;
- durée d'affichage adaptée à l'importance ;
- ne pas faire disparaître trop vite un message d'erreur important.

Les notifications doivent rester cohérentes avec les matériaux et la palette, mais ne pas toutes recevoir un gros effet irisé.

---

## 8. Typographie, icônes et micro-détails

### 8.1 Typographie

Choisir une police système ou une pile typographique compatible avec les navigateurs et les contraintes du projet. Ne pas ajouter de dépendance distante ou de chargement de police externe sans justification.

La hiérarchie doit distinguer :

- nom du produit et titres ;
- libellés des commandes ;
- texte courant ;
- informations secondaires ;
- statuts et avertissements ;
- données techniques comme les modèles et limites.

Ne pas réduire excessivement la taille du texte pour faire rentrer tous les réglages.

### 8.2 Icônes

- Choisir une seule famille d'icônes cohérente.
- Conserver la même épaisseur de trait et le même langage de forme.
- Utiliser des icônes dont le sens est évident.
- Ne pas mélanger emoji, icônes pleines, contours fins et pictogrammes 3D sans système cohérent.
- Toute icône d'action doit avoir un libellé accessible ou un nom accessible.

### 8.3 États des composants

Chaque composant interactif doit posséder des états cohérents :

- default ;
- hover ;
- focus-visible ;
- active/pressed ;
- selected ;
- disabled ;
- loading ;
- success ;
- warning ;
- error.

Ne pas compter uniquement sur la couleur pour indiquer un état.

---

## 9. Interactions et animations

L'interface doit sembler réactive, précise et vivante, sans mouvement constant.

### 9.1 Interactions retenues

- ouverture du popup avec transition fluide et légère impression de profondeur ;
- boutons avec retour visuel immédiat ;
- léger effet lumineux au survol ;
- effet d'enfoncement au clic ;
- transitions propres entre sections ;
- apparition légère des panneaux et menus ;
- progression de traduction animée de façon intelligible ;
- distinction visuelle nette entre chargement, succès, avertissement et erreur ;
- changement de thème sans flash ;
- retours visuels cohérents pour les actions effectuées.

### 9.2 Mouvement de souris

Ne pas mettre en place de mouvement permanent des panneaux qui suivent la souris. Dans un petit popup Chrome, cela risque de distraire et de faire perdre en confort.

Un très léger changement de reflet au survol peut être étudié uniquement s'il est fluide, utile, peu coûteux et désactivable avec `prefers-reduced-motion`.

### 9.3 Durées et réduction des animations

- Les animations doivent être courtes et cohérentes.
- Éviter les rebonds exagérés, les rotations inutiles et les transitions longues.
- Respecter `prefers-reduced-motion`.
- Ne pas animer en boucle un élément qui ne nécessite pas l'attention.
- L'état doit rester compréhensible même lorsque l'animation est désactivée.

---

## 10. Anti-design générique : erreurs à bannir

Claude doit contrôler activement les erreurs ci-dessous avant de considérer l'interface terminée.

### 10.1 Les clichés de dashboard IA

À éviter :

- grille de cartes toutes identiques ;
- grande bannière avec un titre générique ;
- énorme espace vide sans fonction ;
- carte blanche avec petite icône colorée, titre et description répétée partout ;
- bouton bleu standard au milieu d'un écran blanc ;
- sections qui ressemblent à un template SaaS de générateur d'interface.

### 10.2 Le faux Liquid Glass

À éviter :

- `backdrop-filter: blur(...)` ajouté partout ;
- mêmes bordures translucides sur tous les éléments ;
- opacité tellement basse que le texte devient illisible ;
- reflets arbitraires sans cohérence de lumière ;
- effet de verre sans séparation claire entre les plans ;
- gros halo coloré derrière chaque bouton.

### 10.3 Le faux futurisme

À éviter :

- néons cyan/violet sur chaque bordure ;
- lignes de circuit imprimé décoratives ;
- HUD de science-fiction sans rapport avec l'usage ;
- animations permanentes ;
- grille de petits indicateurs ou de chiffres qui ne servent à rien ;
- textures spatiales ou cyberpunk ajoutées pour remplir les espaces.

### 10.4 Les raccourcis de logo et d'icônes

À éviter :

- emoji ;
- icône de traduction générique ;
- globe, drapeaux ou bulles de dialogue sans originalité ;
- pictogrammes de styles différents ;
- effets 3D qui rendent le symbole illisible à 16 px.

### 10.5 Les maquettes qui trompent

- Ne jamais présenter une image générée par IA comme un écran déjà implémenté.
- Ne pas valider uniquement une capture de maquette statique.
- Tester les vrais composants avec de vrais états et de vraies tailles.
- Un écran est incomplet si les boutons sont décoratifs, si les transitions ne fonctionnent pas ou si les états d'erreur n'existent pas.

---

## 11. Contraintes techniques à préserver

Cette directive est visuelle ; elle n'autorise pas une refonte technique libre.

Le `PLAN.md` actuel prévoit notamment :

- Manifest V3 ;
- compatibilité Chromium et Firefox avec deux paquets ;
- JavaScript classique et pas de bibliothèque externe, selon l'architecture spécifiée ;
- code de page séparé de l'interface de l'extension ;
- badge isolé dans un Shadow DOM ;
- appels vers les fournisseurs depuis le background ;
- stockage local des clés et réglages ;
- permissions minimales ;
- absence de code distant et de `eval` ;
- tests automatisés et manuels.

**Ne pas introduire React, Vue, Svelte, Tailwind, shadcn ou un kit d'interface si cela modifie l'architecture prévue ou introduit une dépendance non approuvée.** Le plan demande une implémentation sans bibliothèque externe. Si la structure réelle du dépôt a évolué, inspecter le code avant de décider quoi que ce soit ; ne pas supposer.

### 11.1 Performance

- Limiter les zones utilisant le flou d'arrière-plan.
- Éviter les filtres empilés et les grandes surfaces animées.
- Préférer des transitions ciblées à l'animation de propriétés coûteuses.
- Ne pas faire tourner des animations lorsque le popup est fermé ou que le badge est réduit.
- Prévoir un rendu de repli si les effets de verre ne sont pas supportés.
- Vérifier le comportement sur des machines modestes.

### 11.2 Isolation et sécurité

- Ne pas injecter le style visuel de l'extension dans le site hôte en dehors du badge prévu.
- Garder le Shadow DOM du badge.
- Ne pas exposer les clés API à la page.
- Ne jamais envoyer de données au réseau pour simplement rendre un effet visuel.
- Ne pas ajouter de télémétrie ou de chargement distant.
- Ne pas modifier la logique de traduction pour des raisons de mise en page.

### 11.3 Compatibilité

Tester au minimum Chrome, Edge, Brave et Firefox, conformément au périmètre du projet. Vérifier les différences de rendu du flou et des transitions et prévoir une solution de repli.

---

## 12. Méthode de travail obligatoire pour Claude

### Étape 1 — Audit du projet

- Lire intégralement `README.md` et `PLAN.md`.
- Examiner l'arborescence et le code réellement existant.
- Identifier les composants d'interface, styles, points d'entrée, manifestes et contraintes.
- Noter les fonctions et états déjà existants.
- Ne modifier aucun fichier avant cet audit.

### Étape 2 — Recherche visuelle

- Consulter les références de la section 3.
- Effectuer les recherches ciblées.
- Constituer `DESIGN_RESEARCH.md` avec au moins 8 références réellement observées.
- Séparer clairement les observations, les interprétations et les propositions.

### Étape 3 — Trois pistes artistiques

Proposer trois directions visuelles distinctes, toutes compatibles avec les décisions de ce document. Pour chacune :

- moodboard réel et références ;
- palette ;
- matériaux ;
- traitement du logo ;
- exemple de popup ;
- exemple de réglages ;
- exemple de badge ;
- avantages et risques d'utilisation.

Ne pas proposer trois variantes identiques avec seulement des couleurs différentes.

### Étape 4 — Choix de la direction

Sélectionner la piste qui sert le mieux DevDocTrad, et non celle qui paraît la plus spectaculaire.

Justifier le choix selon : identité, lisibilité, pertinence pour un outil développeur, cohérence avec les captures fournies, performances et facilité d'utilisation.

### Étape 5 — Spécification de design

Créer `DESIGN_SPEC.md` contenant :

- principes de marque ;
- palette claire et sombre ;
- tokens de matériaux ;
- typographie ;
- espacements et rayons ;
- ombres et profondeur ;
- composants ;
- états ;
- animations ;
- règles d'accessibilité ;
- règles responsive et de compatibilité.

### Étape 6 — Prototypes concrets

Produire des prototypes de vrais composants à la taille réelle du popup et de la page de réglages. Préparer également une maquette fonctionnelle du badge et des notifications.

Les prototypes doivent utiliser les technologies du projet. Ils ne doivent pas être de simples images qui ne peuvent pas être comparées au rendu final.

### Étape 7 — Implémentation progressive

- Implémenter les tokens et composants partagés.
- Refaire le popup.
- Refaire la page de réglages.
- Adapter le badge sans le rendre décoratif.
- Adapter les notifications.
- Intégrer le logo et ses exports.
- Tester après chaque partie.

Ne pas effectuer une réécriture globale si une modification ciblée suffit.

### Étape 8 — Contrôle visuel réel

Pour chaque surface :

- ouvrir l'extension dans le navigateur ;
- réaliser des captures réelles ;
- comparer aux références ;
- repérer les défauts de hiérarchie, contraste, densité, alignement, espacements, matériaux et états ;
- corriger et refaire une capture.

Tester le thème clair et sombre, les petites tailles, les états de chargement, réussite, erreur, absence de clé, page non prise en charge, page déjà traduite et traduction en cours.

### Étape 9 — Rapport

Créer `DESIGN_QA.md` avec :

- navigateurs et tailles testés ;
- captures ou chemins vers les captures ;
- fonctionnalités vérifiées ;
- problèmes observés et corrections ;
- problèmes non résolus ;
- limitations non testées.

Ne jamais dire qu'un test a réussi s'il n'a pas été exécuté.

---

## 13. Grille de validation visuelle

Noter chaque critère de 0 à 5. Une note inférieure à 4 impose une correction avant validation finale.

| Critère | Question de validation |
|---|---|
| Identité | DevDocTrad est-il reconnaissable sans lire le nom ? |
| Originalité | L'interface évite-t-elle les templates SaaS et clichés IA ? |
| Qualité du verre | Les matériaux ont-ils de la profondeur sans être du simple flou ? |
| Hiérarchie | L'action principale est-elle évidente en quelques secondes ? |
| Lisibilité | Tous les textes restent-ils lisibles dans les deux thèmes ? |
| Cohérence | Popup, réglages, badge et notifications appartiennent-ils au même produit ? |
| Sobriété fonctionnelle | Le badge et les états de page restent-ils discrets ? |
| Interactions | Chaque action possède-t-elle un retour visuel pertinent ? |
| Performance | Les effets ne rendent-ils pas l'interface lente ? |
| Fidélité au projet | Toutes les fonctions et contraintes du `PLAN.md` sont-elles préservées ? |

Le résultat ne doit pas être validé parce que Claude le trouve « joli ». Il doit être validé à partir de captures, d'états réels et de critères observables.

---

## 14. Livrables attendus

À la fin de la phase de design, fournir :

1. `DESIGN_RESEARCH.md` — références et analyse ;
2. `DESIGN_SPEC.md` — système visuel complet ;
3. `DESIGN_QA.md` — tests et audit visuel ;
4. proposition du logo et fichiers source ;
5. exports du logo aux tailles requises ;
6. popup final ;
7. page de réglages finale ;
8. badge final ;
9. notifications finales ;
10. captures réelles en thème clair et sombre.

Le code fonctionnel, les tests, les manifestes et le comportement définis dans le `PLAN.md` doivent rester intacts.

---

## 15. Instruction finale à Claude

Ne cherche pas à impressionner en ajoutant le plus d'effets possible. Cherche à créer une interface qui a une vraie direction artistique, un langage visuel cohérent et une finition exceptionnelle.

**Le verre, la lumière, les reflets irisés et les animations sont au service de l'identité et de l'usage. Ils ne sont jamais une décoration qui prend le dessus sur la traduction et la lecture.**

Tu es responsable de l'exécution d'une direction artistique exigeante. Tu dois prouver tes choix par des références observées et des captures réelles, pas par des affirmations.
