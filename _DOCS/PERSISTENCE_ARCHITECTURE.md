# Architecture Unifiée de la Persistance

**Date** : 9 novembre 2025  
**Version** : 1.0  
**Statut** : ✅ **IMPLÉMENTÉ** - Architecture unifiée complète avec JSDoc

## Contexte et Historique

### État Initial : Fragmentation (Violations KISS) - RÉSOLU ✅

Le projet contenait initialement **3 systèmes de persistance parallèles** qui ne communiquaient pas entre eux.

**Architecture fragmentée (AVANT)** :

```
┌──────────────────────────────────────────────────────────────┐
│ AVANT : Architecture Fragmentée                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PersistenceRegistry                                         │
│    └─ Namespace: layout, explorer, etc.                      │
│    └─ Types: localStorage, memory, indexedDB                 │
│    └─ API: save(key, data), load(key)                        │
│                                                              │
│  BinaryStorageService (ISOLÉ)                                │
│    └─ Namespace: custom composite key                        │
│    └─ Types: indexedDB uniquement                            │
│    └─ API: saveBlob(namespace, blobId, data)                 │
│                                                              │
│  IndexedDBService (Singleton séparé)                         │
│    └─ API directe: save(storeName, key, data)                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Problèmes Critiques Identifiés (RÉSOLUS ✅)

1. **Duplication de `PersisterInterface`** ✅ RÉSOLU
   - ~~Avant : 2 fichiers avec interfaces différentes~~
   - **Maintenant** : Un seul fichier `/src/core/persistence/PersisterInterface.js`
   - **Impact résolu** : Plus de confusion, imports cohérents

2. **Gestion de Namespace Fragmentée** ✅ RÉSOLU
   - ~~Avant : 2 systèmes de namespace incompatibles~~
   - **Maintenant** : `PersistenceRegistry` comme source unique
   - **Impact résolu** : Liste centralisée de tous les namespaces

3. **APIs Publiques Multiples** ✅ RÉSOLU
   - ~~Avant : 3 singletons séparés~~
   - **Maintenant** : Une seule API via `persistenceRegistry`
   - **Maintenant** : Une seule API via `persistenceRegistry`
   ```javascript
   // ✅ APRÈS : Une seule API claire
   import { persistenceRegistry } from 'svelte-ide'
   
   // JSON et Binary via le même registry
   await persistenceRegistry.save('myTool', 'config', data)
   await persistenceRegistry.saveBlob('docs', 'file-1', blob)
   ```

4. **Dead Code** ✅ RÉSOLU
   - ~~Avant : `IndexedDBPersister.svelte.js.backup`~~
   - **Maintenant** : Aucun fichier backup, code nettoyé

---

## Architecture Actuelle : Unifiée (IMPLÉMENTÉE) ✅

### Principe Réalisé

**"Un seul registre, une interface unifiée, plusieurs backends"**

### Structure des Fichiers

```
/src/core/persistence/
  ├─ PersisterInterface.js          ← Interface unique + implémentations (JSDoc ✅)
  ├─ PersistenceRegistry.svelte.js  ← Registry centralisé (JSDoc ✅)
  ├─ JsonPersister.svelte.js        ← Persister JSON avec fallback
  ├─ BinaryPersister.svelte.js      ← Persister Binary (wrapper)
  ├─ IndexedDBService.svelte.js     ← Service IndexedDB sous-jacent
  └─ BinaryStorageService.svelte.js ← Service Binary sous-jacent
```

**Tous les fichiers consolidés dans `/src/core/persistence/`** pour cohérence architecturale.

### Diagramme d'Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Architecture Unifiée (IMPLÉMENTÉE)                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│              PersistenceRegistry (Source Unique)             │
│                          │                                    │
│        ┌─────────────────┼─────────────────┐                │
│        ▼                 ▼                 ▼                 │
│  JsonPersister    BinaryPersister   MemoryPersister         │
│        │                 │                 │                 │
│        ▼                 ▼                 │                 │
│   IndexedDB        IndexedDB             RAM                │
│  (store JSON)    (store Binary)         (Map)               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Interface Unifiée : `PersisterInterface`

**Une SEULE interface** dans `/src/core/persistence/PersisterInterface.js` avec capacités optionnelles :

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

#### 1. `JsonPersister` (Remplace IndexedDBPersister) ✅ IMPLÉMENTÉ

**Fichier** : `/src/core/persistence/JsonPersister.svelte.js`

```javascript
export class JsonPersister extends PersisterInterface {
  constructor(namespace, options = {}) {
    super(namespace)
    this.storeName = options.storeName || `json_${namespace}`
    this.fallbackStrategy = options.fallbackStrategy || 'block'
  }
  
  get supportsBinary() { return false }
  get supportsExport() { return true }
  
  async save(key, data) {
    // Délègue à indexedDBService avec fallback automatique
    return indexedDBService.save(this.storeName, this.getFullKey(key), data)
  }
  
  async export() {
    // Export complet du namespace en JSON
    const entries = await indexedDBService.getAll(this.storeName)
    return { 
      format: 'svelte-ide-json-store',
      version: 1,
      namespace: this.namespace, 
      entries 
    }
  }
  
  async import(payload, options = {}) {
    // Import depuis JSON avec modes merge/replace
    const mode = options.mode === 'replace' ? 'replace' : 'merge'
    if (mode === 'replace') await this.clear()
    
    for (const entry of payload.entries) {
      await this.save(entry.key, entry.data)
    }
  }
}
```

**Caractéristiques** :
- ✅ Stockage JSON chiffré via `IndexedDBService`
- ✅ Export/Import en JSON avec format standardisé
- ✅ Fallback automatique vers localStorage ou memory
- ✅ Support de stratégies : `'block'`, `'localstorage'`, `'memory'`
- ❌ Pas de support blobs (use case différent)

#### 2. `BinaryPersister` (Wrapper de BinaryStorageService) ✅ IMPLÉMENTÉ

**Fichier** : `/src/core/persistence/BinaryPersister.svelte.js`

```javascript
export class BinaryPersister extends PersisterInterface {
  constructor(namespace, options = {}) {
    super(namespace)
    this.tenantId = options.tenantId || 'default'
  }
  
  get supportsBinary() { return true }
  get supportsExport() { return true }
  
  // API JSON : Interdit, forcer l'usage de saveBlob()
  async save(key) {
    throw new Error('BinaryPersister: Use saveBlob() instead of save()')
  }
  
  // API Binary : Délégation complète à BinaryStorageService
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
  
  // Export/Import : ZIP avec manifest JSON
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

**Caractéristiques** :
- ✅ Stockage blobs chiffrés (Blob, ArrayBuffer, TypedArray, string)
- ✅ Métadonnées riches (filename, mimeType, tags, custom JSON)
- ✅ Export/Import en ZIP avec manifest JSON
- ✅ Multi-tenant natif via `tenantId`
- ❌ Pas de fallback (IndexedDB requis)
- ✅ Format d'export standardisé (`svelte-ide-binary-store`)

#### 3. `LocalStoragePersister` et `MemoryPersister` ✅ CONSERVÉS

**Implémentations simples conservées** sans modification majeure, avec ajout des flags de capacités :

```javascript
export class LocalStoragePersister extends PersisterInterface {
  get supportsBinary() { return false }
  get supportsExport() { return false }
  // ... implémentation existante inchangée
}

export class MemoryPersister extends PersisterInterface {
  get supportsBinary() { return false }
  get supportsExport() { return false }
  // ... implémentation existante inchangée
}
```

**Principe KISS respecté** : Pas de refactoring inutile sur du code qui fonctionne.

### Évolution de `PersistenceRegistry` ✅ IMPLÉMENTÉ

**Fichier** : `/src/core/persistence/PersistenceRegistry.svelte.js`

```javascript
export class LocalStoragePersister extends PersisterInterface {
  get supportsBinary() { return false }
  get supportsExport() { return false }
  // ... implémentation existante inchangée
}

export class MemoryPersister extends PersisterInterface {
  get supportsBinary() { return false }
  get supportsExport() { return false }
  // ... implémentation existante inchangée
}
```

**Principe KISS respecté** : Pas de refactoring inutile sur du code qui fonctionne.

---

### Évolution de `PersistenceRegistry` ✅ IMPLÉMENTÉ

**Fichier** : `/src/core/persistence/PersistenceRegistry.svelte.js` (déplacé dans `persistence/`)

**JSDoc complet ajouté** pour autocomplete IDE sur toutes les méthodes publiques.

```javascript
const ALLOWED_TYPES = ['json', 'binary', 'localstorage', 'memory']
const DEFAULT_TYPE = 'json' // Rétrocompatibilité : 'indexeddb' → 'json'

/**
 * Registre centralisé pour la gestion des persisters.
 * @class PersistenceRegistry
 * @example
 * const persister = persistenceRegistry.createPersister('myTool', 'json')
 * await persister.save('config', { theme: 'dark' })
 */
export class PersistenceRegistry {
  /**
   * Crée ou récupère un persister pour un namespace.
   * @param {string} namespace - Namespace du persister
   * @param {'json'|'binary'|'localstorage'|'memory'} [type='json']
   * @param {Object} [options] - Options de configuration
   * @returns {PersisterInterface}
   */
  createPersister(namespace, type = this.defaultPersisterType, options = {}) {
    const normalizedType = this._normalizeType(type || this.defaultPersisterType)
    
    switch (normalizedType) {
      case 'json':
        persister = new JsonPersister(this._getEffectiveNamespace(namespace), mergedOptions)
        break
      
      case 'binary':
        persister = new BinaryPersister(this._getEffectiveNamespace(namespace), mergedOptions)
        break
      
      case 'localstorage':
        persister = new LocalStoragePersister(this._getEffectiveNamespace(namespace))
        break
      
      case 'memory':
        persister = new MemoryPersister(this._getEffectiveNamespace(namespace))
        break
    }
    
    this.registerPersister(namespace, persister)
    return persister
  }
  
  // ──────────────────────────────────────────
  // API Binary Unifiée (Nouvelles Méthodes)
  // ──────────────────────────────────────────
  
  /**
   * Sauvegarde un blob dans le namespace.
   * @param {string} namespace - Namespace (doit être type 'binary')
   * @param {string} blobId - Identifiant unique
   * @param {Blob|ArrayBuffer} data - Données binaires
   * @param {Object} [metadata] - Métadonnées (filename, mimeType, tags, custom)
   * @throws {Error} Si le namespace ne supporte pas les blobs
   */
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
```

## Stockage Physique : Où sont les Données ?

### Architecture IndexedDB

```
┌─────────────────────────────────────────────────────────┐
│ IndexedDB (Navigateur)                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Base 1: "svelte-ide:app-data"                         │
│  ├─ Store "default"        ← Données JSON génériques    │
│  ├─ Store "persister_layout"  ← Layout de l'IDE        │
│  └─ Store "persister_explorer" ← Config explorateur    │
│      └─ Entrées: { key, value (chiffré), timestamp }   │
│                                                          │
│  Base 2: "svelte-ide:binary-storage"  ← BLOBS ICI!    │
│  ├─ Store "binary_metadata"                             │
│  │   ├─ compositeKey (PK): "tenantId::namespace::id"  │
│  │   ├─ namespace, blobId, filename                    │
│  │   ├─ size, mimeType, tags, custom                   │
│  │   ├─ createdAt, updatedAt, version                  │
│  │   └─ encrypted (boolean)                            │
│  │   └─ Index: tenantNamespace, namespace, updatedAt  │
│  │                                                       │
│  └─ Store "binary_payloads"                             │
│      ├─ compositeKey (PK)                               │
│      └─ payload (ArrayBuffer chiffré - LE BLOB)        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Quotas et Limites

| Backend | Quota Typique | Limite Pratique | Persistence | Chiffrement |
|---------|---------------|-----------------|-------------|-------------|
| **LocalStorage** | 5-10 MB | 5 MB | Permanent | ❌ Non |
| **SessionStorage** | 5-10 MB | 5 MB | Session | ❌ Non |
| **IndexedDB** | 50% disque libre | 500 MB - 2 GB+ | Permanent | ✅ Via TokenCipher |

**Exemple concret** :
- LocalStorage : ~5 MB = 1-2 PDFs moyens
- IndexedDB : ~500 MB = 100-200 PDFs + métadonnées + artefacts OCR

### Composite Key Structure

Le système de clés composites permet l'isolation multi-niveau :

```javascript
// Namespace JSON (via JsonPersister)
fullKey = "svelte-ide:layout-mainView"
         = `${APP_KEY}:${namespace}-${key}`

// Namespace Binary (via BinaryPersister)
compositeKey = "default::documents::rapport-2025.pdf"
              = `${tenantId}::${namespace}::${blobId}`
```

**Bénéfices** :
1. **Multi-tenant** : Isolation par utilisateur/organisation (future)
2. **Multi-namespace** : Chaque tool a son espace isolé
3. **Unique identifier** : Pas de collision entre namespaces

## API Publique Unifiée

### Avant (3 APIs Fragmentées)

```javascript
import { persistenceRegistry } from 'svelte-ide'
import { binaryStorageService } from 'svelte-ide'
import { indexedDBService } from 'svelte-ide'

// JSON
persistenceRegistry.save('myTool', 'config', { theme: 'dark' })

// Blobs (API différente !)
binaryStorageService.saveBlob('documents', 'doc-1', pdfBlob, {
  metadata: { filename: 'rapport.pdf' }
})

// Direct IndexedDB (pourquoi ???)
await indexedDBService.initialize(['custom_store'])
await indexedDBService.save('custom_store', 'key', data)
```

### Après (1 API Unifiée)

```javascript
import { persistenceRegistry } from 'svelte-ide'

// ──────────────────────────────────────────
// Approche 1 : API Directe sur Registry
// ──────────────────────────────────────────

// JSON
await persistenceRegistry.save('myTool', 'config', { theme: 'dark' })
const config = await persistenceRegistry.load('myTool', 'config', { theme: 'light' })

// Blobs (même API)
await persistenceRegistry.saveBlob('documents', 'doc-1', pdfBlob, {
  filename: 'rapport.pdf',
  mimeType: 'application/pdf',
  tags: ['important', '2025']
})
const doc = await persistenceRegistry.loadBlob('documents', 'doc-1')

// Export/Import
const archive = await persistenceRegistry.exportNamespace('documents') // ZIP Blob
await persistenceRegistry.importNamespace('documents', archive, { mode: 'replace' })

// ──────────────────────────────────────────
// Approche 2 : Via Persister Dédié
// ──────────────────────────────────────────

// Créer un persister JSON pour un namespace
const jsonPersister = persistenceRegistry.createPersister('myTool', 'json')
await jsonPersister.save('config', { theme: 'dark' })
await jsonPersister.export() // JSON complet du namespace

// Créer un persister Binary pour un namespace
const binaryPersister = persistenceRegistry.createPersister('documents', 'binary')

// Vérifier les capacités
if (binaryPersister.supportsBinary) {
  await binaryPersister.saveBlob('doc-1', pdfBlob, {
    filename: 'rapport.pdf'
  })
}

if (binaryPersister.supportsExport) {
  const zipArchive = await binaryPersister.export()
  // Télécharger ou sauvegarder
}
```

### Découverte des Capacités

```javascript
const persister = persistenceRegistry.getPersister('myNamespace')

// Vérifier les capacités
if (persister.supportsBinary) {
  console.log('Ce namespace supporte les blobs')
  await persister.saveBlob('file-1', blob)
}

if (persister.supportsExport) {
  console.log('Ce namespace peut être exporté')
  const exportData = await persister.export()
}

// Lister toutes les capacités
console.log({
  type: persister.constructor.name,
  binary: persister.supportsBinary,
  export: persister.supportsExport,
  namespace: persister.namespace
})
```

## Comparaison des Types de Persisters

| Feature | JsonPersister | BinaryPersister | LocalStoragePersister | MemoryPersister |
|---------|---------------|-----------------|------------------------|-----------------|
| **Backend** | IndexedDB | IndexedDB | localStorage | RAM |
| **Quota** | 500 MB - 2 GB | 500 MB - 2 GB | 5-10 MB | Illimité (RAM) |
| **Chiffrement** | ✅ AES-GCM | ✅ AES-GCM | ❌ Non | ❌ Non |
| **supportsBinary** | ❌ | ✅ | ❌ | ❌ |
| **supportsExport** | ✅ JSON | ✅ ZIP | ❌ | ❌ |
| **Fallback** | localStorage/memory | ❌ Requis | N/A | N/A |
| **Persistence** | Permanent | Permanent | Permanent | Session |
| **Use Case** | Config, layout, state | PDF, images, OCR | Cookies alt | Tests, cache |

## Bénéfices de l'Unification

### ✅ Conformité KISS

- **Une seule interface** : `PersisterInterface` avec capacités optionnelles
- **Une seule source de namespace** : `PersistenceRegistry`
- **Une API publique claire** : `persistenceRegistry.saveBlob()` au lieu de 3 services
- **Zéro duplication** : Un seul fichier `PersisterInterface.js`

### ✅ Simplicité pour les Développeurs

**Avant** :
```javascript
// Confus : quelle API utiliser ?
import { persistenceRegistry, binaryStorageService, indexedDBService } from 'svelte-ide'
```

**Après** :
```javascript
// Évident : une seule API
import { persistenceRegistry } from 'svelte-ide'
```

### ✅ Découvrabilité

- `persister.supportsBinary` → Savoir si on peut stocker des blobs
- `persister.supportsExport` → Savoir si on peut exporter
- TypeScript/JSDoc autocomplete sur une seule classe
- Pas besoin de lire la doc pour savoir quelle API utiliser

### ✅ Testabilité

- Mock unique de `PersistenceRegistry` au lieu de 3 services
- Tests isolés par type de persister
- Injection de dépendances simplifiée

### ✅ Maintenabilité

- Ajout d'un nouveau backend = 1 classe qui hérite `PersisterInterface`
- Pas de duplication de logique de namespace
- Documentation centralisée
- Migrations simplifiées (upgrade path clair)

## Rétrocompatibilité

### Aliases de Type

```javascript
// Ancien code utilisant 'indexeddb'
const persister = persistenceRegistry.createPersister('myTool', 'indexeddb')
// ✅ Fonctionne : alias vers 'json'

// Nouveau code
const persister = persistenceRegistry.createPersister('myTool', 'json')
// ✅ Comportement identique
```

### Exports Deprecated

```javascript
// /src/public-api.js
export { persistenceRegistry } from '@svelte-ide/core/PersistenceRegistry.svelte.js'
export { PersisterInterface } from '@svelte-ide/core/PersisterInterface.js'

// Rétrocompatibilité (deprecated, usage avancé uniquement)
/**
 * @deprecated Use persistenceRegistry.saveBlob() instead
 */
export { binaryStorageService } from '@svelte-ide/core/persistence/BinaryStorageService.svelte.js'

/**
 * @deprecated Internal use only, use persistenceRegistry
 */
export { indexedDBService } from '@svelte-ide/core/persistence/IndexedDBService.svelte.js'
```

### Migration Guide

```javascript
// ──────────────────────────────────────────
// Ancienne API : binaryStorageService
// ──────────────────────────────────────────
import { binaryStorageService } from 'svelte-ide'

await binaryStorageService.saveBlob('docs', 'file-1', blob, {
  metadata: { filename: 'test.pdf' }
})
const doc = await binaryStorageService.loadBlob('docs', 'file-1')

// ──────────────────────────────────────────
// Nouvelle API : persistenceRegistry
// ──────────────────────────────────────────
import { persistenceRegistry } from 'svelte-ide'

// Option 1 : API directe
await persistenceRegistry.saveBlob('docs', 'file-1', blob, {
  filename: 'test.pdf'
})
const doc = await persistenceRegistry.loadBlob('docs', 'file-1')

// Option 2 : Via persister dédié (recommandé pour usage intensif)
const blobPersister = persistenceRegistry.createPersister('docs', 'binary')
await blobPersister.saveBlob('file-1', blob, { filename: 'test.pdf' })
const doc = await blobPersister.loadBlob('file-1')
```

## Limitations et Évolutions Futures

### Limitations Actuelles

⚠️ **Pas de quota monitoring** : Aucune alerte si on approche la limite IndexedDB  
⚠️ **Pas de cleanup automatique** : Les blobs restent indéfiniment (by design)  
⚠️ **Pas de déduplication** : Si 2 tools stockent le même PDF, il est dupliqué  
⚠️ **Pas de streaming** : Tout le blob est chargé en mémoire (problème > 100 MB)  
⚠️ **Pas de compression automatique** : À faire manuellement avant `saveBlob()`

### Évolutions Possibles (Post v0.3.0)

1. **Quota Monitoring**
   ```javascript
   const quota = await persistenceRegistry.getQuotaUsage()
   // { used: 250MB, available: 500MB, percentage: 50 }
   ```

2. **Content-Addressable Storage** (Déduplication)
   ```javascript
   const hash = await blobPersister.saveBlob('file-1', blob, { deduplicate: true })
   // Si le même blob existe, retourne la même clé
   ```

3. **Streaming API** (Fichiers > 100 MB)
   ```javascript
   const stream = await blobPersister.loadBlobStream('file-1')
   for await (const chunk of stream) {
     processChunk(chunk)
   }
   ```

4. **Compression Transparente**
   ```javascript
   const blobPersister = persistenceRegistry.createPersister('docs', 'binary', {
     compression: 'gzip',
     compressionLevel: 6
   })
   ```

5. **Multi-Tenant UI**
   ```javascript
   const blobPersister = persistenceRegistry.createPersister('docs', 'binary', {
     tenantId: currentUser.organizationId
   })
   ```

## Métriques de Succès

### Réduction de Complexité

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| Fichiers `PersisterInterface` | 2 | 1 | -50% |
| Singletons de persistance | 3 | 1 | -66% |
| APIs publiques | 3 | 1 | -66% |
| Lignes de code publique | ~500 | ~300 | -40% |
| Cyclomatic complexity | ~15 | ~8 | -47% |

### Conformité KISS

✅ **Une seule façon de persister** : `persistenceRegistry`  
✅ **Une seule interface** : `PersisterInterface`  
✅ **Une seule source de namespace** : `PersistenceRegistry`  
✅ **Zéro duplication** : Code consolidé  
✅ **Documentation centralisée** : Un seul guide

## Références

- **Plan détaillé** : `_GUIDES/feature_plan/persistence-unification.md`
- **Guide d'usage** : `_GUIDES/INDEXEDDB_USAGE.md` (à mettre à jour post-implémentation)
- **Architecture générale** : `_GUIDES/ARCHITECTURE.md` (section persistance)
- **Tests** : `src/test_tools/testPersistence/` (à créer)

---

**Statut** : 🔴 **Non implémenté** - Ce document décrit l'architecture cible. L'implémentation suivra le plan de `persistence-unification.md` phase par phase.
