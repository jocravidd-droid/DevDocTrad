# Kit de fiche AMO : guide pas à pas

DevDocTrad est **déjà publiée** sur Firefox : https://addons.mozilla.org/fr/firefox/addon/devdoctrad/ (version 1.0.0). Ce kit sert à refaire proprement la fiche et à envoyer la version 1.2.0. Tout se fait à la main, depuis ton compte, sur la page d’édition :

https://addons.mozilla.org/fr/developers/addon/devdoctrad/edit

Durée : 20 à 30 minutes. Personne d’autre ne peut le faire à ta place (il faut être connecté à ton compte Mozilla).

## Ce qui ne va pas aujourd’hui (relevé sur l’API publique d’AMO)

| Problème | Correction dans ce kit |
|---|---|
| 2 images seulement, aux formats du Chrome Web Store (440 x 280 et 1400 x 560) : AMO les recadre en 1280 x 800, elles sont coupées et floues. | 8 captures exactement 1280 x 800, avec un titre lisible. |
| La description anglaise (en-US) contient le texte français. | Description anglaise en en-US, description française en fr. |
| Nom « DevDocTrad » seul : rien à chercher. | « DevDocTrad: Translator for Docs, Code & Videos » (et sa version française). |
| Aucun tag ; catégorie « Search Tools » qui ne correspond pas. | Tags `translate` et `youtube` ; catégories Language Support + Web Development. |
| Page d’accueil = GitHub ; site d’assistance seulement en anglais. | Page d’accueil `https://devdoctrad.vercel.app/`, assistance dans les deux langues. |
| Version 1.0.0 en ligne. | Envoi de `release/devdoctrad-firefox-1.2.0.zip`. |

## Contenu du kit

| Fichier | Rôle |
|---|---|
| [`fiche.md`](fiche.md) | Tous les textes à copier-coller, en anglais (en-US) et en français (fr). |
| `en/01-traduction.png` … `en/08-theme-sombre.png` | Les 8 captures **à envoyer sur AMO** (titres en anglais). |
| `fr/01-traduction.png` … `fr/08-theme-sombre.png` | Les mêmes captures avec titres en français, pour le site, les annonces ou si tu préfères des titres français sur AMO. |
| `../../tools/amo_shots.js` | Le script qui refait les 16 images : `pkill -f fake_ollama ; python3 build.py && node tools/amo_shots.js` |

**Important : sur AMO, les images sont communes à toutes les langues.** Seules les légendes se traduisent. La fiche est en anglais par défaut et la plupart des visiteurs lisent l’anglais : envoie le dossier `en/`. N’envoie pas les deux dossiers (16 images en double).

Les libellés d’AMO peuvent changer un peu avec le temps : cherche le libellé le plus proche. Les noms entre parenthèses sont ceux de l’interface anglaise d’AMO.

---

## Étape 1 : envoyer la version 1.2.0

Le fichier : `release/devdoctrad-firefox-1.2.0.zip` (dans le dépôt).

1. Ouvre https://addons.mozilla.org/fr/developers/addon/devdoctrad/edit et connecte-toi si AMO le demande.
2. Dans le menu de gauche, clique sur « Téléverser une nouvelle version » (Upload New Version).
3. Si AMO demande où distribuer la version, choisis « Sur ce site » (On this site).
4. Clique sur « Sélectionner un fichier… » (Select a file…) et choisis `release/devdoctrad-firefox-1.2.0.zip`.
5. Attends la validation automatique : elle doit indiquer 0 erreur. Les avertissements éventuels n’empêchent pas l’envoi.
6. Dans « Compatibilité » (Compatible with), laisse « Firefox » coché, et « Firefox pour Android » décoché.
7. Clique sur « Continuer » (Continue).
8. À « Devez-vous envoyer le code source ? » (Do you need to submit source code?), réponds « Non » (No), puis « Continuer ».
9. Dans « Notes de version » (Release notes), colle le bloc **en-US** de la section 9 de `fiche.md`. Si un sélecteur de langue est présent à côté du champ, choisis « Français » et colle le bloc **fr**.
10. Dans « Notes pour les relecteurs » (Notes to Reviewer), colle le bloc de la section 8 de `fiche.md`.
11. Clique sur « Envoyer la version » (Submit Version). La 1.2.0 part en validation ; la fiche reste en ligne pendant ce temps.

## Étape 2 : ajouter la langue française à la fiche

12. Reviens sur la page d’édition : menu de gauche, « Modifier la fiche produit » (Edit Product Page).
13. En haut de la page, ouvre le sélecteur « Gérer les langues de la fiche » / « Langue » (Manage Localizations / Localize for). La langue par défaut doit rester **English (US)**.
14. Ajoute « Français » (French). AMO affiche alors un onglet ou un menu pour passer d’une langue à l’autre. Les champs traduisibles (nom, résumé, description, page d’accueil, assistance, légendes, politique de confidentialité) ont une valeur par langue.

## Étape 3 : fiche anglaise (en-US)

Choisis la langue **English (US)** dans le sélecteur. Chaque bloc de la page a son bouton « Modifier » (Edit) puis « Enregistrer les modifications » (Save Changes) : enregistre chaque bloc avant de passer au suivant.

Bloc « Décrire le module » (Describe Add-on) :

15. « Nom » (Name) : colle le nom **en-US** de la section 1 de `fiche.md` (`DevDocTrad: Translator for Docs, Code & Videos`). Si AMO a déjà repris ce nom depuis la version 1.2.0, ne change rien.
16. « URL du module » (Add-on URL) : laisse `devdoctrad`. Ne la change jamais : les liens déjà partagés casseraient.
17. « Résumé » (Summary) : efface tout, colle le résumé **en-US** de la section 2.
18. « Description » : efface **tout** le texte français actuel, colle la description **en-US** de la section 3.1.
19. « Catégories » (Categories) : coche « Language Support » et « Web Development » ; décoche « Search Tools » et toute autre case.
20. « Tags » (si le champ est dans ce bloc, sinon dans « Détails supplémentaires ») : choisis `translate` puis `youtube` dans la liste proposée. AMO n’accepte que les tags de sa liste ; « translation » et « developer tools » n’y sont pas (voir la section 5 de `fiche.md`).
21. Enregistre.

Bloc « Détails supplémentaires » (Additional Details) :

22. « Page d’accueil » (Homepage) : `https://devdoctrad.vercel.app/`
23. Tags, s’ils sont ici : voir l’étape 20.
24. « URL de contribution » (Contributions URL) : laisse vide.
25. Enregistre.

Bloc « Assistance » (Support Information) :

26. « Site web d’assistance » (Support website) : `https://github.com/jocravidd-droid/DevDocTrad/issues`
27. « E-mail d’assistance » (Support email) : facultatif. Il est affiché publiquement sur la fiche ; vide-le si tu préfères recevoir les demandes seulement sur GitHub.
28. Enregistre.

Bloc « Détails techniques » (Technical Details) :

29. « Ce module est expérimental » (This add-on is experimental) : **décoché**.
30. « Ce module nécessite un paiement, un service non libre… » (This add-on requires payment, non-free services or software…) : **décoché**. L’extension et les clés gratuites ne coûtent rien.
31. Les autres champs (commentaires du développeur, identifiant) : rien à changer. Enregistre.

## Étape 4 : les images (bloc « Médias du module », Add-on Media)

32. Toujours sur « Modifier la fiche produit », bloc « Médias du module » (Add-on Media), clique sur « Modifier » (Edit).
33. L’icône vient du paquet : rien à faire.
34. **Supprime les 2 anciennes images** (440 x 280 et 1400 x 560) : sous chacune, clique sur « Supprimer » (Remove) ou coche la case de suppression.
35. Clique sur « Ajouter une capture d’écran » (Add a screenshot / Upload) et envoie les 8 images du dossier `store/amo/en/`, **une par une, dans l’ordre** :
    1. `01-traduction.png`
    2. `02-bilingue.png`
    3. `03-popup.png`
    4. `04-voix-videos.png`
    5. `05-russe.png`
    6. `06-cles.png`
    7. `07-glossaire.png`
    8. `08-theme-sombre.png`
36. Sous chaque image, colle sa légende anglaise (colonne « Caption (en-US) » de la section 4 de `fiche.md`).
37. Vérifie l’ordre : la première image est celle de la page traduite. Si l’ordre n’est pas bon, fais glisser les images (poignée à gauche ou en haut de chaque image).
38. Enregistre.

## Étape 5 : fiche française (fr)

Passe le sélecteur de langue sur **Français**. Les champs vides en français affichent sinon le texte anglais.

39. « Décrire le module » : nom **fr** (section 1), résumé **fr** (section 2), description **fr** (section 3.2). Enregistre.
40. « Détails supplémentaires » : page d’accueil `https://devdoctrad.vercel.app/`. Enregistre.
41. « Assistance » : site d’assistance `https://github.com/jocravidd-droid/DevDocTrad/issues`. Enregistre.
42. « Médias du module » : sous chaque image, colle la légende française (colonne « Légende (fr) » de la section 4). Enregistre.

## Étape 6 : licence et politique de confidentialité

43. Menu de gauche : « Gérer les auteurs et la licence » (Manage Authors & License). Vérifie que la licence est « MIT License ». Enregistre si tu as changé quelque chose.
44. Menu de gauche : « Gérer les politiques et le CLUF » (Manage Policies & EULA). Coche « Ce module a une politique de confidentialité » (This add-on has a Privacy Policy) si ce n’est pas fait.
45. En **English (US)**, colle le bloc 7.1 de `fiche.md`. Passe en **Français** et colle le bloc 7.2. Enregistre.
46. Pas de contrat de licence utilisateur (EULA) : laisse cette partie vide.

## Étape 7 : vérifier

47. Ouvre la fiche publique en anglais : https://addons.mozilla.org/en-US/firefox/addon/devdoctrad/ . Vérifie : nom, résumé, description en anglais, 8 images nettes dans l’ordre, légendes, tags.
48. Ouvre-la en français : https://addons.mozilla.org/fr/firefox/addon/devdoctrad/ . Vérifie le texte et les légendes en français.
49. Les changements de texte et d’images sont visibles en quelques minutes. La version 1.2.0 apparaît une fois validée (de quelques minutes à quelques jours ; tu reçois un e-mail).
50. Si un relecteur pose une question, réponds en anglais sur la page de la version, en t’appuyant sur la section 8 de `fiche.md`. N’envoie jamais une de tes clés d’API.

## Refaire les images

Depuis le dossier du dépôt (Node.js 20 ou plus, Playwright et Chromium installés, ffmpeg conseillé pour la vidéo de démo) :

```bash
pkill -f fake_ollama ; python3 build.py && node tools/amo_shots.js
```

Le script charge l’extension dans Chromium, traduit une page de démonstration avec un modèle local simulé (aucune vraie IA, aucune vraie clé, rien n’est envoyé sur Internet), puis compose chaque image en 1280 x 800 dans `store/amo/en/` et `store/amo/fr/`. Les titres des bandeaux se changent en haut de `tools/amo_shots.js` (tableau `SHOTS`).
