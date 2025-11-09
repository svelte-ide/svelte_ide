---
title: Unification de la Persistance et Intégration BinaryStorage
version: 1.0
date_created: 2025-11-09
last_updated: 2025-11-09
---
# Plan de mise en œuvre : Unification de la Persistance

Nettoyer l'architecture de persistance actuelle pour respecter les principes KISS et intégrer complètement `BinaryStorageService` dans `PersistenceRegistry`. Éliminer les duplications, unifier les interfaces et fournir une API publique cohérente.

## État Actuel : Problèmes Identifiés

### 🔴 Violations KISS Critiques

1. **Duplication de `PersisterInterface`**
   - `/src/core/PersisterInterface.js` : Interface complète (`save/load/remove/clear/exists`)
   - `/src/core/persistence/PersisterInterface.js` : Interface différente (`export/import/getNamespace`)
   - **Impact** : Confusion sur quelle interface importer, risque d'erreurs de typage

2. **3 Systèmes de Persistance Parallèles**
   - `PersistenceRegistry` : JSON key-value via namespace
   - `BinaryStorageService` : Blobs chiffrés avec système de namespace propre (`tenantId::namespace::blobId`)
   - StateProvider Persisters : Export/Import de stores
   - **Impact** : Aucune source unique de vérité pour les namespaces

3. **`BinaryStorageService` Non Intégré**
   - N'utilise PAS `PersistenceRegistry`
   - Réinvente la gestion de namespace au lieu de s'appuyer sur l'existant
   - Singleton séparé (`binaryStorageService`) alors que `persistenceRegistry` existe
   - **Impact** : Impossible de lister tous les namespaces d'un seul endroit

4. **`IndexedDBService` : Duplication de Responsabilités**
   - Possède sa propre gestion de stores dynamiques
   - Singleton séparé de `persistenceRegistry`
   - **Impact** : Deux points d'entrée pour IndexedDB au lieu d'un

5. **Fichiers Morts**
   - `IndexedDBPersister.svelte.js.backup` : Dead code à supprimer
   - `/src/core/persistence/PersisterInterface.js` : Interface obsolète

### 🟡 Problèmes Secondaires

- Pas de documentation sur quand utiliser `PersistenceRegistry` vs `BinaryStorageService`
- Export/Import dans StateProvider utilise une interface différente de `PersistenceRegistry`
- Métadonnées des blobs (tags, custom) non indexées pour recherche globale

## Architecture et Conception

### Principe Directeur

**"Un seul registre, une interface unifiée, plusieurs backends"**

```
                    PersistenceRegistry (Source Unique)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  JsonPersister        BinaryPersister      MemoryPersister
        │                     │                     │
        ▼                     ▼                     │
   IndexedDB            IndexedDB                 RAM
  (store JSON)       (store Binary)              (Map)
```

### Interface Unifiée : `PersisterInterface`

**Une SEULE interface** dans `/src/core/PersisterInterface.js` :

```javascript
export class PersisterInterface {
  constructor(namespace) {
    this.namespace = namespace
  }

  // ──────────────────────────────────────────
  // API JSON (Toujours Implémentée)
  // ──────────────────────────────────────────
  async save(key, data) { throw new Error('Not implemented') }
  async load(key, defaultValue = null) { throw new Error('Not implemented') }
  async remove(key) { throw new Error('Not implemented') }
  async clear() { throw new Error('Not implemented') }
  async exists(key) { throw new Error('Not implemented') }

  // ──────────────────────────────────────────
  // API Binary (Optionnelle - par capability)
  // ──────────────────────────────────────────
  get supportsBinary() { return false }
  
  async saveBlob(blobId, data, metadata = {}) {
    if (!this.supportsBinary) {
      throw new Error(`${this.constructor.name} does not support binary storage`)
    }
  }
  
  async loadBlob(blobId, options = {}) {
    if (!this.supportsBinary) return null
  }
  
  async deleteBlob(blobId) {
    if (!this.supportsBinary) return false
  }
  
  async listBlobs(options = {}) {
    if (!this.supportsBinary) return []
  }

  // ──────────────────────────────────────────
  // API Export/Import (Optionnelle)
  // ──────────────────────────────────────────
  get supportsExport() { return false }
  
  async export() {
    if (!this.supportsExport) return null
  }
  
  async import(data, options = {}) {
    if (!this.supportsExport) return { importedCount: 0 }
  }
  
  // ──────────────────────────────────────────
  // Helpers (Implémentation par défaut)
  // ──────────────────────────────────────────
  getFullKey(key) {
    return `${this.namespace}-${key}`
  }
}
```

### Implémentations Concrètes

#### 1. `JsonPersister` (Remplace `IndexedDBPersister`)

```javascript
// /src/core/persistence/JsonPersister.svelte.js
import { PersisterInterface } from '@/core/PersisterInterface.js'
import { indexedDBService } from './IndexedDBService.svelte.js'

export class JsonPersister extends PersisterInterface {
  constructor(namespace, options = {}) {
    super(namespace)
    this.storeName = options.storeName || `json_${namespace}`
  }
  
  get supportsBinary() { return false }
  get supportsExport() { return true }
  
  async save(key, data) { /* délègue à indexedDBService */ }
  async load(key, defaultValue) { /* ... */ }
  async export() { /* export JSON complet du namespace */ }
  // ...
}
```

#### 2. `BinaryPersister` (Wrapper autour de `BinaryStorageService`)

```javascript
// /src/core/persistence/BinaryPersister.svelte.js
import { PersisterInterface } from '@/core/PersisterInterface.js'
import { binaryStorageService } from './BinaryStorageService.svelte.js'

export class BinaryPersister extends PersisterInterface {
  constructor(namespace, options = {}) {
    super(namespace)
    this.tenantId = options.tenantId || 'default'
  }
  
  get supportsBinary() { return true }
  get supportsExport() { return true }
  
  // ──────────────────────────────────────────
  // API JSON : Stub minimal (métadonnées)
  // ──────────────────────────────────────────
  async save(key, data) {
    // Sauvegarder métadonnées légères en JSON
    // Les vrais blobs passent par saveBlob()
    throw new Error('BinaryPersister: Use saveBlob() for binary data')
  }
  
  async load(key, defaultValue) {
    // Charger métadonnées uniquement
    const metadata = await binaryStorageService.listBlobs(this.namespace, {
      tenantId: this.tenantId
    })
    return metadata.find(m => m.blobId === key) || defaultValue
  }
  
  // ──────────────────────────────────────────
  // API Binary : Délégation complète
  // ──────────────────────────────────────────
  async saveBlob(blobId, data, metadata = {}) {
    return binaryStorageService.saveBlob(this.namespace, blobId, data, {
      tenantId: this.tenantId,
      metadata
    })
  }
  
  async loadBlob(blobId, options = {}) {
    return binaryStorageService.loadBlob(this.namespace, blobId, {
      tenantId: this.tenantId,
      ...options
    })
  }
  
  async deleteBlob(blobId) {
    return binaryStorageService.deleteBlob(this.namespace, blobId, {
      tenantId: this.tenantId
    })
  }
  
  async listBlobs(options = {}) {
    return binaryStorageService.listBlobs(this.namespace, {
      tenantId: this.tenantId,
      ...options
    })
  }
  
  async clear() {
    return binaryStorageService.clearNamespace(this.namespace, {
      tenantId: this.tenantId
    })
  }
  
  // ──────────────────────────────────────────
  // Export/Import : Délégation ZIP
  // ──────────────────────────────────────────
  async export() {
    return binaryStorageService.exportStore(this.namespace, {
      tenantId: this.tenantId
    })
  }
  
  async import(zipBlob, options = {}) {
    return binaryStorageService.importStore(this.namespace, zipBlob, {
      tenantId: this.tenantId,
      mode: options.mode || 'merge',
      preserveTimestamps: options.preserveTimestamps !== false
    })
  }
}
```

#### 3. `LocalStoragePersister` et `MemoryPersister` (Existants, OK)

Conservés tels quels, mais avec ajout des flags :
- `supportsBinary = false`
- `supportsExport = false`

### Évolution de `PersistenceRegistry`

```javascript
// /src/core/PersistenceRegistry.svelte.js
import { LocalStoragePersister, MemoryPersister } from '@/core/PersisterInterface.js'
import { JsonPersister } from '@/core/persistence/JsonPersister.svelte.js'
import { BinaryPersister } from '@/core/persistence/BinaryPersister.svelte.js'

const ALLOWED_TYPES = ['json', 'binary', 'localStorage', 'memory']
const DEFAULT_TYPE = (() => {
  const envValue = import.meta?.env?.VITE_PERSISTENCE_DEFAULT_TYPE
  if (envValue && ALLOWED_TYPES.includes(envValue.toLowerCase())) {
    return envValue.toLowerCase()
  }
  return 'json' // Au lieu de 'indexeddb'
})()

export class PersistenceRegistry {
  // ... code existant ...
  
  createPersister(namespace, type = this.defaultPersisterType, options = {}) {
    const mapKey = this._getMapKey(namespace)
    if (this.persisters.has(mapKey)) {
      return this.persisters.get(mapKey)
    }

    const effectiveType = type || this.defaultPersisterType
    const mergedOptions = { ...this.defaultPersisterOptions, ...options }
    let persister

    switch (effectiveType) {
      case 'json':
      case 'indexeddb':  // Rétrocompatibilité
      case 'indexedDB':
        persister = new JsonPersister(this._getEffectiveNamespace(namespace), mergedOptions)
        break
      
      case 'binary':
        persister = new BinaryPersister(this._getEffectiveNamespace(namespace), mergedOptions)
        break
      
      case 'localStorage':
        persister = new LocalStoragePersister(this._getEffectiveNamespace(namespace))
        break
      
      case 'memory':
        persister = new MemoryPersister(this._getEffectiveNamespace(namespace))
        break
      
      default:
        throw new Error(`Unknown persister type: ${type}`)
    }

    this.registerPersister(namespace, persister)
    return persister
  }
  
  // ──────────────────────────────────────────
  // Nouvelles Méthodes : API Binary Unifiée
  // ──────────────────────────────────────────
  async saveBlob(namespace, blobId, data, metadata = {}) {
    const persister = this.getPersister(namespace)
    if (!persister.supportsBinary) {
      throw new Error(`Namespace "${namespace}" does not support binary storage (use type: 'binary')`)
    }
    return persister.saveBlob(blobId, data, metadata)
  }
  
  async loadBlob(namespace, blobId, options = {}) {
    const persister = this.getPersister(namespace)
    if (!persister.supportsBinary) return null
    return persister.loadBlob(blobId, options)
  }
  
  async deleteBlob(namespace, blobId) {
    const persister = this.getPersister(namespace)
    if (!persister.supportsBinary) return false
    return persister.deleteBlob(blobId)
  }
  
  async listBlobs(namespace, options = {}) {
    const persister = this.getPersister(namespace)
    if (!persister.supportsBinary) return []
    return persister.listBlobs(options)
  }
  
  // ──────────────────────────────────────────
  // Export/Import Unifié
  // ──────────────────────────────────────────
  async exportNamespace(namespace) {
    const persister = this.getPersister(namespace)
    if (!persister.supportsExport) {
      throw new Error(`Namespace "${namespace}" does not support export`)
    }
    return persister.export()
  }
  
  async importNamespace(namespace, data, options = {}) {
    const persister = this.getPersister(namespace)
    if (!persister.supportsExport) {
      throw new Error(`Namespace "${namespace}" does not support import`)
    }
    return persister.import(data, options)
  }
}

export const persistenceRegistry = new PersistenceRegistry()
```

### API Publique Simplifiée

```javascript
// /src/public-api.js
export { persistenceRegistry, PersistenceRegistry } from '@/core/PersistenceRegistry.svelte.js'
export { PersisterInterface } from '@/core/PersisterInterface.js'

// Services sous-jacents (usage avancé uniquement)
export { indexedDBService } from '@/core/persistence/IndexedDBService.svelte.js'
export { binaryStorageService } from '@/core/persistence/BinaryStorageService.svelte.js'

// Implémentations concrètes (si besoin de personnalisation)
export { JsonPersister } from '@/core/persistence/JsonPersister.svelte.js'
export { BinaryPersister } from '@/core/persistence/BinaryPersister.svelte.js'
export { LocalStoragePersister, MemoryPersister } from '@/core/PersisterInterface.js'
```

### Usage Unifié pour les Tools

```javascript
// Tool qui stocke du JSON
import { persistenceRegistry } from 'svelte-ide'

const persister = persistenceRegistry.getPersister('myTool') // Type 'json' par défaut
await persister.save('config', { theme: 'dark' })
const config = await persister.load('config', { theme: 'light' })

// Tool qui stocke des blobs
const binaryPersister = persistenceRegistry.createPersister('myDocuments', 'binary')
await binaryPersister.saveBlob('doc-123', pdfBlob, {
  filename: 'rapport.pdf',
  mimeType: 'application/pdf',
  tags: ['important', '2025']
})
const doc = await binaryPersister.loadBlob('doc-123')

// Export complet d'un namespace (JSON ou Binary)
const archive = await persistenceRegistry.exportNamespace('myDocuments')
// archive = Blob ZIP avec manifest.json

// Import d'une archive
await persistenceRegistry.importNamespace('myDocuments', archive, { mode: 'replace' })
```

## Tâches

### Phase 1 : Nettoyage (1-2h)
- [x] **T1.1** : Analyser l'état actuel et documenter les violations KISS
- [ ] **T1.2** : Supprimer `/src/core/persistence/PersisterInterface.js` (interface obsolète)
- [ ] **T1.3** : Supprimer `IndexedDBPersister.svelte.js.backup`
- [ ] **T1.4** : Consolider TOUTE l'interface dans `/src/core/PersisterInterface.js`
  - Ajouter flags `supportsBinary`, `supportsExport`
  - Ajouter méthodes `saveBlob/loadBlob/listBlobs/deleteBlob` (stubs par défaut)
  - Ajouter méthodes `export/import` (stubs par défaut)

### Phase 2 : Création de JsonPersister (2h)
- [ ] **T2.1** : Créer `/src/core/persistence/JsonPersister.svelte.js`
  - Hérite de `PersisterInterface`
  - Implémente API JSON complète (délégation à `indexedDBService`)
  - Implémente `export()` : sérialisation JSON du store complet
  - Implémente `import(data)` : restauration depuis JSON
- [ ] **T2.2** : Migrer `IndexedDBPersister` → `JsonPersister`
  - Renommer le fichier
  - Ajuster l'implémentation (cleanup des méthodes inutiles)
  - Mettre à jour les imports dans `PersistenceRegistry`

### Phase 3 : Création de BinaryPersister (2h)
- [ ] **T3.1** : Créer `/src/core/persistence/BinaryPersister.svelte.js`
  - Hérite de `PersisterInterface`
  - `supportsBinary = true`, `supportsExport = true`
  - Délègue tout à `binaryStorageService`
  - Implémente `save/load` pour métadonnées légères uniquement
- [ ] **T3.2** : Ajouter gestion `tenantId` dans les options du constructor
- [ ] **T3.3** : Tester la rétrocompatibilité avec `BinaryStorageService` direct

### Phase 4 : Intégration dans PersistenceRegistry (1h)
- [ ] **T4.1** : Ajouter type `'binary'` dans `ALLOWED_TYPES`
- [ ] **T4.2** : Ajouter case `'binary'` dans `createPersister()`
- [ ] **T4.3** : Ajouter méthodes publiques :
  - `saveBlob(namespace, blobId, data, metadata)`
  - `loadBlob(namespace, blobId, options)`
  - `deleteBlob(namespace, blobId)`
  - `listBlobs(namespace, options)`
  - `exportNamespace(namespace)`
  - `importNamespace(namespace, data, options)`
- [ ] **T4.4** : Ajouter vérification `supportsBinary` avec message d'erreur explicite

### Phase 5 : Tests et Documentation (2h)
- [ ] **T5.1** : Créer `/src/test_tools/testPersistence/` avec démos :
  - Namespace JSON avec export/import
  - Namespace Binary avec blobs + export ZIP
  - Migration d'un namespace JSON → Binary
- [ ] **T5.2** : Documenter dans `_GUIDES/INDEXEDDB_USAGE.md` :
  - Tableau comparatif `json` vs `binary` vs `localStorage` vs `memory`
  - Exemples d'usage pour chaque type
  - Migration guide (ancien code → nouveau code)
- [ ] **T5.3** : Mettre à jour `_GUIDES/ARCHITECTURE.md` :
  - Supprimer mentions de l'ancienne architecture
  - Documenter la nouvelle architecture unifiée
  - Diagramme ASCII mis à jour
- [ ] **T5.4** : Créer CHANGELOG.md entrée pour version 0.3.0

### Phase 6 : Public API et Rétrocompatibilité (1h)
- [ ] **T6.1** : Mettre à jour `/src/public-api.js`
  - Exporter `JsonPersister`, `BinaryPersister`
  - Garder exports existants pour rétrocompatibilité
- [ ] **T6.2** : Ajouter aliases de rétrocompatibilité :
  ```javascript
  // Rétrocompatibilité (deprecated)
  export { JsonPersister as IndexedDBPersister } from '@/core/persistence/JsonPersister.svelte.js'
  ```
- [ ] **T6.3** : Tester que les tools existants (Explorer, Transactions) fonctionnent sans modification

### Phase 7 : Cleanup Final (30min)
- [ ] **T7.1** : Supprimer singleton `binaryStorageService` de l'API publique (interne uniquement)
- [ ] **T7.2** : Valider que tous les imports pointent vers `/src/core/PersisterInterface.js`
- [ ] **T7.3** : Supprimer variables d'environnement obsolètes (`VITE_PERSISTENCE_DEFAULT_TYPE=indexeddb` → `json`)
- [ ] **T7.4** : Mettre à jour `.env.example` avec nouveaux types

## Questions Ouvertes

### 1. Faut-il supporter la migration automatique `indexeddb` → `json` ?
**Contexte** : Ancien code utilise `type: 'indexeddb'`, nouveau code utilise `type: 'json'`.

**Options** :
- **A)** Alias transparent : `'indexeddb'` = `'json'` (recommandé, 0 breaking change)
- **B)** Deprecation warning + migration automatique
- **C)** Breaking change immédiat (à éviter)

**Décision** : **Option A** - Ajouter `case 'indexeddb': case 'indexedDB':` dans le switch.

### 2. Les StateProvider Persisters doivent-ils migrer vers la nouvelle interface ?
**Contexte** : Actuellement dans `/src/core/persistence/PersisterInterface.js` (à supprimer).

**Options** :
- **A)** Migrer `SimplePersister` vers la nouvelle `PersisterInterface` avec flags
- **B)** Garder une interface séparée pour StateProvider (violation KISS)
- **C)** Supprimer StateProvider Persisters (trop radical)

**Décision** : **Option A** - `SimplePersister extends PersisterInterface` avec `supportsExport = true`.

### 3. Quand supprimer `binaryStorageService` du singleton ?
**Contexte** : Actuellement exporté comme service standalone, mais devrait être interne.

**Options** :
- **A)** Garder pour rétrocompatibilité, documenter comme "advanced use only"
- **B)** Supprimer de `public-api.js` dès version 0.3.0 (breaking)
- **C)** Deprecation progressive sur 2 versions

**Décision** : **Option A** - Garder l'export mais marquer `@deprecated` dans JSDoc, recommander `persistenceRegistry.saveBlob()`.

---

## Bénéfices Attendus

### ✅ Conformité KISS
- **Une seule interface** : `PersisterInterface` unifié
- **Une seule source de namespace** : `PersistenceRegistry`
- **Une API publique claire** : `persistenceRegistry.saveBlob()` au lieu de `binaryStorageService.saveBlob()`

### ✅ Simplicité pour les Tools
```javascript
// Avant (confus)
import { persistenceRegistry } from 'svelte-ide'
import { binaryStorageService } from 'svelte-ide' // ??? Lequel choisir ???

// Après (évident)
import { persistenceRegistry } from 'svelte-ide'
const persister = persistenceRegistry.createPersister('myTool', 'binary')
await persister.saveBlob('doc-1', blob)
```

### ✅ Découvrabilité
- `persister.supportsBinary` → savoir si on peut stocker des blobs
- `persister.supportsExport` → savoir si on peut exporter
- TypeScript/JSDoc autocomplete sur une seule classe

### ✅ Testabilité
- Mock unique de `PersistenceRegistry` au lieu de 3 services
- Tests isolés par type de persister (JsonPersister, BinaryPersister, etc.)

### ✅ Maintenabilité
- Ajout d'un nouveau backend = 1 classe qui hérite `PersisterInterface`
- Pas de duplication de logique de namespace
- Documentation centralisée dans `INDEXEDDB_USAGE.md`

---

## Estimation Totale : 8-10 heures

| Phase | Durée | Priorité |
|-------|-------|----------|
| Phase 1 : Nettoyage | 1-2h | 🔴 Critique |
| Phase 2 : JsonPersister | 2h | 🔴 Critique |
| Phase 3 : BinaryPersister | 2h | 🔴 Critique |
| Phase 4 : PersistenceRegistry | 1h | 🔴 Critique |
| Phase 5 : Tests & Docs | 2h | 🟡 Important |
| Phase 6 : Public API | 1h | 🟡 Important |
| Phase 7 : Cleanup Final | 30min | 🟢 Nice-to-have |

**Total** : 9h30

---

## Validation de Conformité

### Checklist Avant Merge

- [ ] **Un seul `PersisterInterface.js`** (dans `/src/core/`)
- [ ] **Zéro fichier `.backup`** dans le repo
- [ ] **Tous les imports** pointent vers `/src/core/PersisterInterface.js`
- [ ] **`PersistenceRegistry`** peut créer des persisters `'binary'`
- [ ] **`binaryStorageService`** reste interne (non exporté ou deprecated)
- [ ] **Documentation** complète dans `INDEXEDDB_USAGE.md`
- [ ] **Tests** passent pour Explorer, Transactions, Console
- [ ] **CHANGELOG.md** mis à jour pour version 0.3.0

### Métriques de Succès

| Métrique | Avant | Après | Objectif |
|----------|-------|-------|----------|
| Fichiers `PersisterInterface` | 2 | 1 | ✅ -50% |
| Singletons de persistance | 3 | 1 | ✅ -66% |
| Lignes de code publique | ~500 | ~300 | ✅ -40% |
| APIs publiques | 3 | 1 | ✅ -66% |
| Complexity (cyclomatic) | ~15 | ~8 | ✅ -47% |

---

**Ce plan respecte strictement les principes KISS en éliminant les abstractions inutiles tout en préservant la flexibilité nécessaire.**
