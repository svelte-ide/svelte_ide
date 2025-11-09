---
title: Export/Import exhaustif de tous les namespaces
version: 0.3.0
date_created: 2025-11-09
last_updated: 2025-11-09
---
# Plan de mise en œuvre : Export/Import exhaustif de tous les namespaces

## Contexte et objectifs

Le système actuel d'export/import du menu "Sauvegarde" présente deux limitations critiques :

1. **Export incomplet** : Seul le namespace `'user-layout'` est exporté via `DEFAULT_STORAGE_BUNDLE`. Les namespaces métier créés par les tools (ex: `'documents'`, `'document-library-tree'`) ne sont pas inclus, causant des pertes de données lors du changement de navigateur/appareil.

2. **Nom de fichier générique** : Le fichier exporté s'appelle toujours `'svelte-ide-backup.zip'`, créant de la confusion pour les projets multiples utilisant le framework.

**Objectifs** :
- Exporter automatiquement **tous les namespaces** enregistrés dans `persistenceRegistry`
- Utiliser `APP_KEY` pour générer un nom de fichier contextualisé : `{APP_KEY}-backup-{timestamp}.zip`
- Restaurer tous les namespaces lors de l'import
- Supprimer le concept de bundle hardcodé pour le menu système

## Architecture et conception

### Principes directeurs

1. **Export exhaustif par défaut** : Le menu "Sauvegarde" doit capturer l'état complet de l'application sans configuration manuelle
2. **Découverte automatique** : Parcourir dynamiquement `persistenceRegistry` pour détecter tous les namespaces actifs
3. **Gestion multi-types** : Supporter les namespaces JSON et binary dans un seul export ZIP
4. **Pas de configuration requise** : Les tools n'ont rien à faire ; l'enregistrement d'un persister suffit

### Architecture proposée

```
┌─────────────────────────────────────────────────────┐
│ Menu "Sauvegarde → Exporter"                        │
│   createExportAllAction()                           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ exportAllNamespaces()                               │
│  1. persistenceRegistry.getAllNamespacesWithMetadata()│
│  2. Construire bundle dynamique                     │
│  3. exportBundle() existant                         │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ PersistenceRegistry (enrichi)                       │
│  - getRegisteredNamespaces() [existe]               │
│  - getNamespaceType(namespace) [nouveau]            │
│  - getAllNamespacesWithMetadata() [nouveau]         │
└─────────────────────────────────────────────────────┘
```

### Format du ZIP exporté

```
{APP_KEY}-backup-2025-11-09-143022.zip
├── __bundle__/
│   └── manifest.json          # Métadonnées du bundle
├── data/
│   ├── user-layout.json       # Namespace JSON
│   └── document-library-tree.json
└── files/
    └── documents/             # Namespace binary
        ├── file-123.pdf
        └── file-456.docx
```

### Modifications clés

**PersistenceRegistry** :
- Ajouter `getNamespaceType(namespace)` → retourne `'json'|'binary'|'localstorage'|'memory'`
- Ajouter `getAllNamespacesWithMetadata()` → retourne `[{ namespace, type }, ...]`

**MenuActionsHelpers** :
- `exportAllNamespaces()` : construit un bundle dynamique à partir de tous les namespaces
- `importAllNamespaces(archiveInput, options)` : restaure tous les namespaces du manifest
- `createExportAllAction(options)` : wrapper pour le menu
- `createImportAllAction(options)` : wrapper pour le menu

**ideStore** :
- Supprimer `DEFAULT_STORAGE_BUNDLE`
- Remplacer `createExportAction()` par `createExportAllAction()`
- Remplacer `createImportAction()` par `createImportAllAction()`
- Nom de fichier dynamique : `${APP_KEY}-backup-${timestamp}.zip`

**public-api** :
- Exporter les nouvelles fonctions pour permettre aux projets clients de créer leurs propres menus d'export complet

## Tâches

### Phase 1 : Métadonnées des namespaces
- [ ] **T1.1** : Ajouter `getNamespaceType(namespace)` à `PersistenceRegistry`
  - Retourner le type du persister (`'json'`, `'binary'`, `'localstorage'`, `'memory'`)
  - Gérer les namespaces inexistants (retourner `null` ou exception)
- [ ] **T1.2** : Ajouter `getAllNamespacesWithMetadata()` à `PersistenceRegistry`
  - Itérer sur `this.persisters`
  - Pour chaque namespace, extraire le type via introspection du persister
  - Retourner `[{ namespace, type }, ...]`
- [ ] **T1.3** : Tester les nouvelles méthodes avec différents types de persisters

### Phase 2 : Export exhaustif
- [ ] **T2.1** : Créer `exportAllNamespaces()` dans `MenuActionsHelpers.svelte.js`
  - Récupérer tous les namespaces via `persistenceRegistry.getAllNamespacesWithMetadata()`
  - Construire dynamiquement un objet `bundle` avec :
    - Entrées JSON : `{ type: 'json', namespace, path: 'data/{namespace}.json' }`
    - Entrées binary : `{ type: 'blob', namespace, basePath: 'files/{namespace}/' }`
  - Appeler `exportBundle(bundle)` existant
  - Générer le nom de fichier : `${APP_KEY}-backup-${formatTimestamp()}.zip`
- [ ] **T2.2** : Créer `createExportAllAction(options)` dans `MenuActionsHelpers.svelte.js`
  - Wrapper autour de `exportAllNamespaces()`
  - Gérer les callbacks `onSuccess(payload)` / `onError(error)`
  - Retourner une fonction async compatible avec `MainMenuService`
- [ ] **T2.3** : Tester l'export avec plusieurs namespaces (JSON + binary)

### Phase 3 : Import exhaustif
- [ ] **T3.1** : Créer `importAllNamespaces(archiveInput, options)` dans `MenuActionsHelpers.svelte.js`
  - Lire le manifest du ZIP
  - Pour chaque entrée du manifest :
    - Si `type: 'json'` → `persistenceRegistry.importNamespace(namespace, payload, { mode })`
    - Si `type: 'blob'` → restaurer via `importBundle()` existant
  - Supporter `options.mode` (`'replace'` par défaut, `'merge'` optionnel)
- [ ] **T3.2** : Créer `createImportAllAction(options)` dans `MenuActionsHelpers.svelte.js`
  - Wrapper autour de `importAllNamespaces()`
  - Gérer la confirmation si mode `'replace'` (via `modalService.confirm()`)
  - Gérer les callbacks `onSuccess(payload)` / `onError(error)`
- [ ] **T3.3** : Tester l'import avec validation du manifest

### Phase 4 : Intégration dans ideStore
- [ ] **T4.1** : Identifier où `DEFAULT_STORAGE_BUNDLE` est défini et utilisé
- [ ] **T4.2** : Remplacer l'appel à `registerStorageMenu()` dans `ideStore.svelte.js` :
  - Supprimer la prop `bundle: DEFAULT_STORAGE_BUNDLE`
  - Remplacer par des appels manuels à `registerMenuItem()` utilisant :
    - `action: createExportAllAction({ onSuccess, onError })`
    - `action: createImportAllAction({ mode: 'replace', onSuccess, onError })`
- [ ] **T4.3** : Supprimer complètement `DEFAULT_STORAGE_BUNDLE` si non utilisé ailleurs
- [ ] **T4.4** : Vérifier que le nom de fichier utilise bien `APP_KEY`

### Phase 5 : API publique
- [ ] **T5.1** : Exporter dans `src/public-api.js` :
  - `exportAllNamespaces`
  - `importAllNamespaces`
  - `createExportAllAction`
  - `createImportAllAction`
- [ ] **T5.2** : Mettre à jour les commentaires JSDoc pour documenter l'usage


## Questions ouvertes

### Q1 : Gestion des namespaces `memory` et `localstorage`
**Question** : Les namespaces de type `'memory'` (volatiles) et `'localstorage'` (hors IndexedDB) doivent-ils être inclus dans l'export ?

**Options** :
- **Option A** : Exclure automatiquement les types `'memory'` (logique : données volatiles)
- **Option B** : Inclure tous les types sauf si un flag `skipVolatile: true` est fourni
- **Option C** : Laisser le contrôle au développeur via une configuration par namespace

**Recommandation actuelle** : Option A (exclure `'memory'` par défaut, inclure `'localstorage'` et `'json'` et `'binary'`)

### Q2 : Performance avec un grand nombre de namespaces
**Question** : Si une application a 50+ namespaces avec des blobs volumineux, l'export peut prendre plusieurs secondes. Faut-il ajouter un indicateur de progression ?

**Options** :
- **Option A** : Ajouter une notification "Export en cours..." avec barre de progression
- **Option B** : Bloquer l'UI avec un spinner simple
- **Option C** : Laisser l'opération être asynchrone et afficher une notification à la fin

**Recommandation actuelle** : Option C pour MVP, Option A pour version ultérieure si nécessaire

### Q3 : Validation des namespaces lors de l'import
**Question** : Lors de l'import, si le ZIP contient un namespace inconnu (non enregistré dans l'app actuelle), que faire ?

**Options** :
- **Option A** : Ignorer silencieusement avec un warning dans la console
- **Option B** : Créer automatiquement un persister du type indiqué dans le manifest
- **Option C** : Afficher un dialogue listant les namespaces inconnus et demander confirmation

**Recommandation actuelle** : Option B (création automatique) pour éviter les pertes de données, avec un log d'avertissement
