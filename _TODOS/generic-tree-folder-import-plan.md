---
title: Import hiérarchique des dossiers glissés-déposés
version: 1.0
date_created: 2025-11-14
last_updated: 2025-11-14
---
# Plan de mise en œuvre : Importer une structure de dossiers via drag and drop
Permettre au composant `GenericElementTree` de reconstruire automatiquement l’arborescence complète (dossiers et fichiers) lorsque l’utilisateur dépose une structure provenant du système de fichiers ou via l’upload manuel.

## Architecture et conception
- Étendre la gestion des drops pour lire `DataTransferItemList` (ou File System Access API) plutôt que seulement `FileList`, en identifiant les entrées de type dossier (ex. `webkitGetAsEntry()`).
- Introduire un parseur récursif qui produit un arbre intermédiaire (dossiers, fichiers et métadonnées) avant de créer les nœuds Svelte. Ce parseur doit être asynchrone pour respecter les API navigateur.
- Ajouter une API d’import dédiée (ex. `importFileTree`) qui prend l’arbre intermédiaire et crée les dossiers via `createFolder`, puis insère les fichiers au bon endroit, en conservant la hiérarchie et en évitant les ID dupliqués.
- Revoir la signature de `onFilesSelected` (ou fournir un nouvel événement) pour exposer la structure hiérarchique au parent, tout en gardant une compatibilité raisonnable avec les usages existants.
- Activer l’attribut `webkitdirectory` sur l’input de fallback, gérer un feature flag pour éviter les régressions sur les navigateurs non supportés, et documenter la limitation côté utilisateurs.

## Tâches
- [ ] Cartographier les environnements cibles (Chrome, Edge, Firefox, Safari) et valider la meilleure API disponible pour chaque.
- [ ] Implémenter un utilitaire `collectDroppedEntries(event.dataTransfer.items)` qui retourne un arbre `{ name, kind: 'folder'|'file', file?: File, children?: [] }`.
- [ ] Ajouter `importFileTree` (ou équivalent) qui consomme l’arbre intermédiaire et crée les dossiers via le store interne (en veillant à marquer les dossiers nouveaux comme développés).
- [ ] Mettre à jour `handleFolderDrop`, `handleDrop` et `handleFileInput` pour utiliser les nouveaux utilitaires, gérer les erreurs (quota, accès refusé) et informer l’utilisateur si une partie du drop échoue.
- [ ] Étendre `onFilesSelected` (ou introduire `onFileTreeImported`) pour transmettre à l’extérieur l’arbre complet importé, avec documentation dans `_GUIDES/SVELTE5.md`/README si nécessaire.
- [ ] Couvrir la fonctionnalité par des tests (unitaires sur le parseur, tests d’intégration Svelte ou Playwright) et ajouter une notice dans `_DOCS` / changelog.

## Questions ouvertes
1. Doit-on conserver l’ordre original des fichiers/dossiers ou appliquer toujours le tri alphabétique actuel ?
2. Souhaite-t-on exposer les `FileSystemFileHandle` bruts (pour des ré-uploads ultérieurs) ou uniquement des objets `File` ?
3. En cas de structure partiellement bloquée (permissions, symlinks), faut-il rejeter l’ensemble du drop ou importer ce qui est accessible avec un rapport d’erreurs ?
