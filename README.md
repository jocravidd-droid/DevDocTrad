# DevDocTrad

Extension de navigateur (Chrome, Edge, Brave, Firefox) qui traduit en français, directement sur la page, la documentation technique et les sites pour programmeurs écrits en anglais ou dans une autre langue : documentation officielle, README et issues GitHub, Stack Overflow, forums, blogs techniques, pages de frameworks.

Pour tous ceux qui galèrent avec la doc en langue étrangère, sans sacrifier la précision :

- traduction fidèle phrase par phrase, sans résumé, sans omission, sans ajout ;
- code, commandes, noms de fonctions, API, chemins et URL jamais traduits ;
- mise en page conservée (liens, gras, `code` restent en place) ;
- termes techniques anglais gardés tels quels : l'extension traduit, elle n'explique pas ;
- bouton pour revenir à l'original à tout moment, ou affichage bilingue.

Coût : 0 euro. L'extension utilise les paliers gratuits de Gemini, Groq, Mistral et OpenRouter (avec vos propres clés), ou un modèle local via Ollama. Elle ne peut jamais utiliser une clé payante sans plafond réglé par l'utilisateur.

## État

Phase de conception. Le cahier des charges complet est dans [PLAN.md](PLAN.md). Publication prévue sur le Chrome Web Store et sur addons.mozilla.org une fois les tests passés.

## Licence

MIT : chacun peut reprendre, modifier et redistribuer ce code, y compris dans un autre projet, à condition de garder la mention de licence. Voir [LICENSE](LICENSE).

## Sécurité

Ne publiez jamais une clé d'API dans ce dépôt ni ailleurs sur GitHub. Les clés restent dans le stockage local du navigateur.
