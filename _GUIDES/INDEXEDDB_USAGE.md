# IndexedDB Chiffrée : Guide d’Intégration & Migration

Ce document explique comment utiliser la persistance IndexedDB chiffrée introduite dans Sprint 3, migrer les anciens états `localStorage` et configurer les fallbacks.

---

## 1. Pourquoi IndexedDB ?

| Critère | localStorage | IndexedDB chiffrée |
| --- | --- | --- |
| Capacité | 5-10 MB | quota disque (~50 %) |
| Sécurité | texte clair | AES-GCM via `TokenCipher` |
| Async | ❌ | ✅ |
| Granularité | clé/valeur | Stores + indexes |
| Multi-stores | ❌ | ✅ (`ensureStore`) |

---

## 2. API de base

```js
import { indexedDBService } from 'svelte-ide'

await indexedDBService.initialize(['default', 'mon-store'])

await indexedDBService.save('mon-store', 'user-settings', { theme: 'dark' })
const data = await indexedDBService.load('mon-store', 'user-settings', { theme: 'light' })
await indexedDBService.delete('mon-store', 'user-settings')
```

### Persister réutilisable

```js
import { IndexedDBPersister } from 'svelte-ide'

const persister = new IndexedDBPersister('tool-explorer', {
  storeName: 'tool-explorer',
  fallbackStrategy: 'block'
})

await persister.save('state', { selectedItem: 'demo.js' })
const restored = await persister.load('state')
```

---

## 3. Migration localStorage → IndexedDB

### Migration automatique du core

Le framework **n'effectue PLUS de migration automatique** pour garder le comportement prévisible.

### Migration layout utilisateur

`ideStore` applique un versionning de schéma (`LAYOUT_SCHEMA_VERSION = 2`) pour garantir la compatibilité ascendante. La méthode `_migrateLayoutData()` normalise les anciennes entrées à la lecture.

### Script de migration optionnel

Pour migrer manuellement des données legacy (environnements très anciens), un script utilitaire est disponible :

```js
import migrateExplorerLocalStorage from '@svelte-ide/scripts/migrateExplorerLocalStorage.js'
await migrateExplorerLocalStorage()
// Console: "Migration terminée { migrated: 5, skipped: 120 }"
```

**Recommandation** : Pour nouveaux projets, ignorer la migration. Pour projets existants, exécuter le script une fois en production puis le retirer.

---

## 4. Stratégies de fallback

Configuration via `indexedDBService.setFallbackStrategy()` ou `.env` :

| Valeur | Effet |
| --- | --- |
| `block` (défaut) | Erreur bloquante si IndexedDB absent (recommandé pour données sensibles) |
| `localStorage` | Persister non chiffré avec quota limité (warning console) |
| `memory` | Persistance temporaire en RAM (données perdues au refresh) |

**Configuration développeur** :
```javascript
// Exemple 1 : Outil avec données sensibles → pas de fallback
const persister = new IndexedDBPersister('confidential-data', {
  storeName: 'confidential',
  fallbackStrategy: 'block'  // Bloque si IndexedDB absent
})

// Exemple 2 : Outil avec peu de données → fallback localStorage OK
const persister = new IndexedDBPersister('ui-preferences', {
  storeName: 'preferences',
  fallbackStrategy: 'localStorage'  // Accepte fallback non chiffré
})

// Exemple 3 : Configuration globale
indexedDBService.setFallbackStrategy('block')
```

**Variables d'environnement** :
```bash
VITE_INDEXEDDB_FALLBACK_STRATEGY=block  # block | localstorage | memory
```

---

## 5. Versionning Layout

- `LAYOUT_SCHEMA_VERSION = 2`.
- `ideStore.saveUserLayout()` enregistre cette version.
- `ideStore.restoreUserLayout()` passe par `_migrateLayoutData()` pour convertir les versions `< 2` (ajoute `states`, timestamp, etc.).
- Pattern à réutiliser côté outils : stocker `schemaVersion` + fonction de migration.

---

## 6. `stateProviderService` + IndexedDB

- `saveAllStatesAsync()` / `restoreAllStates()` acceptent désormais des promesses.
- `ideStore.saveUserLayout()` attend `stateProviderService.saveAllStatesAsync()` pour sérialiser les outils asynchrones.
- Exemple d'intégration outil : `ExplorerPersistenceService` enregistre `selectedItem` & `recentFiles`.

---

## 7. Checklist pour intégrer un outil

1. Créer un `IndexedDBPersister` dédié (`namespace`, `storeName`).
2. Enregistrer un provider dans `stateProviderService` si l'outil doit être restauré au login.
3. Choisir une stratégie de fallback appropriée (`block` pour données sensibles, `localStorage` pour UI).
4. Documenter les fallbacks supportés (env `VITE_INDEXEDDB_FALLBACK_STRATEGY`).
5. Ajouter un test manuel (console `window.indexedDBService`) pour vérifier `save -> reload -> load`.

---

## 8. Scénarios de test

1. **Login → ouverture → reload** : la disposition et les onglets Explorer reviennent.
2. **Fallback** : forcer `indexedDBService.setFallbackStrategy('memory')` et confirmer la warning console + perte au reload.
3. **Transactions v2** : créer quelques entrées, exporter JSON, relancer le navigateur → données intactes.
