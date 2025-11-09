---
title: Actions génériques de menu Export/Import pour les outils
version: 1.0.0
date_created: 2025-01-25
last_updated: 2025-01-25
---
# Plan de mise en œuvre : Actions Export/Import de données par namespace

## Contexte et Objectifs

Permettre aux développeurs d'outils d'ajouter facilement des actions d'export/import à leurs menus pour sauvegarder et restaurer les données de leur namespace de persistance.

**Objectifs métier :**
- Permettre aux utilisateurs de sauvegarder leurs données localement (backup)
- Faciliter le transfert de données entre appareils/navigateurs
- Offrir une API publique simple et réutilisable

**Public cible :**
- Développeurs d'outils personnalisés
- Intégrateurs créant des applications métier

## Architecture et Conception

### 1. Vue d'ensemble

```
┌─────────────────────────────────────────────────────────┐
│                    Tool Menu (File)                      │
├─────────────────────────────────────────────────────────┤
│  Export Data...     → createExportAction()              │
│  Import Data...     → createImportAction()              │
└─────────────────────────────────────────────────────────┘
                            ↓
                   mainMenuService.registerMenuItem()
                            ↓
                   persistenceRegistry.exportNamespace()
                   persistenceRegistry.importNamespace()
                            ↓
                   JsonPersister/BinaryPersister
```

### 2. API publique proposée

#### 2.1 Fonctions d'action créées (action creators)

```javascript
/**
 * Crée une action de menu pour exporter un namespace.
 * 
 * @param {string} namespace - Le namespace à exporter (ex: 'tool-explorer')
 * @param {Object} options - Options d'export
 * @param {string} [options.filename] - Nom du fichier (défaut: namespace + timestamp)
 * @param {Function} [options.onSuccess] - Callback après export réussi
 * @param {Function} [options.onError] - Callback en cas d'erreur
 * @returns {Function} Handler de menu compatible MainMenuService
 * 
 * @example
 * ideStore.registerMenuItem('file', {
 *   id: 'export-data',
 *   label: 'Export Data...',
 *   action: createExportAction('my-tool', {
 *     filename: 'my-tool-backup.json'
 *   })
 * }, 'my-tool')
 */
export function createExportAction(namespace, options = {})

/**
 * Crée une action de menu pour importer un namespace.
 * 
 * @param {string} namespace - Le namespace à importer
 * @param {Object} options - Options d'import
 * @param {('merge'|'replace')} [options.mode='replace'] - Mode d'import
 * @param {Function} [options.onSuccess] - Callback après import réussi
 * @param {Function} [options.onError] - Callback en cas d'erreur
 * @param {boolean} [options.confirmReplace=true] - Demander confirmation si mode='replace'
 * @returns {Function} Handler de menu compatible MainMenuService
 * 
 * @example
 * ideStore.registerMenuItem('file', {
 *   id: 'import-data',
 *   label: 'Import Data...',
 *   action: createImportAction('my-tool', {
 *     mode: 'replace',
 *     onSuccess: () => ideStore.addNotification('Import réussi', 'success')
 *   })
 * }, 'my-tool')
 */
export function createImportAction(namespace, options = {})
```

#### 2.2 Helper optionnel (approche "tout-en-un")

```javascript
/**
 * Enregistre automatiquement un menu "Storage" avec Export/Import.
 * 
 * @param {Object} ideStore - Instance de ideStore
 * @param {string} toolId - ID de l'outil (utilisé comme ownerId)
 * @param {string} namespace - Namespace de persistance
 * @param {Object} [options] - Options de configuration
 * @param {string} [options.menuId='storage'] - ID du menu à créer/utiliser
 * @param {string} [options.menuLabel='Stockage'] - Label du menu
 * @param {number} [options.menuOrder=800] - Ordre du menu
 * @param {string} [options.exportLabel='Exporter les données...'] - Label de l'action export
 * @param {string} [options.importLabel='Importer les données...'] - Label de l'action import
 * @param {string} [options.filename] - Template de nom de fichier
 * 
 * @example
 * // Dans la méthode initialize() de votre outil :
 * registerStorageMenu(ideStore, this.id, 'my-tool', {
 *   menuLabel: 'Données',
 *   filename: 'my-tool-backup.json'
 * })
 */
export function registerStorageMenu(ideStore, toolId, namespace, options = {})
```

### 3. Implémentation technique

#### 3.1 Fichier : `/src/core/MenuActionsHelpers.svelte.js`

**Responsabilités :**
- Implémenter `createExportAction()` et `createImportAction()`
- Gérer le file picker (input type="file" dynamique)
- Gérer le download trigger (création de Blob + anchor temporaire)
- Intégrer avec `persistenceRegistry.exportNamespace()` / `importNamespace()`
- Gérer les erreurs et callbacks

**Structure :**

```javascript
import { persistenceRegistry } from './persistence/PersistenceRegistry.svelte.js'
import { modalService } from './ModalService.svelte.js'

// Utilitaires internes
function downloadFile(data, filename, mimeType) {
  const blob = data instanceof Blob ? data : new Blob([JSON.stringify(data, null, 2)], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function pickFile(accept = '*/*') {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = () => resolve({ file, data: reader.result })
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier'))
        
        // Détection du type de persister (JSON ou Binary)
        if (file.name.endsWith('.zip')) {
          reader.readAsArrayBuffer(file)
        } else {
          reader.readAsText(file)
        }
      } else {
        reject(new Error('Aucun fichier sélectionné'))
      }
    }
    input.click()
  })
}

// API publique
export function createExportAction(namespace, options = {}) {
  return async () => {
    const { filename, onSuccess, onError } = options
    
    try {
      const data = await persistenceRegistry.exportNamespace(namespace)
      
      // Déterminer le nom de fichier et le type MIME
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const isZip = data instanceof Blob && data.type.includes('zip')
      const defaultName = isZip 
        ? `${namespace}-${timestamp}.zip`
        : `${namespace}-${timestamp}.json`
      const finalFilename = filename ?? defaultName
      const mimeType = isZip ? 'application/zip' : 'application/json'
      
      downloadFile(data, finalFilename, mimeType)
      
      if (onSuccess) onSuccess({ filename: finalFilename, data })
    } catch (error) {
      console.error('Export failed:', error)
      if (onError) onError(error)
    }
  }
}

export function createImportAction(namespace, options = {}) {
  return async () => {
    const { 
      mode = 'replace', 
      onSuccess, 
      onError, 
      confirmReplace = true 
    } = options
    
    try {
      // Confirmation si mode 'replace'
      if (mode === 'replace' && confirmReplace) {
        const confirmed = await modalService.confirm(
          'Confirmer l\'import',
          'Cette action va remplacer toutes les données existantes. Continuer ?'
        )
        if (!confirmed) return
      }
      
      // Sélection du fichier
      const { file, data } = await pickFile('.json,.zip')
      
      // Import
      const parsedData = file.name.endsWith('.zip') 
        ? data // ArrayBuffer pour ZIP
        : JSON.parse(data) // Parse JSON
      
      await persistenceRegistry.importNamespace(namespace, parsedData, { mode })
      
      if (onSuccess) onSuccess({ filename: file.name })
    } catch (error) {
      console.error('Import failed:', error)
      if (onError) onError(error)
    }
  }
}
```

#### 3.2 Fichier : `/src/core/StorageMenuHelper.svelte.js`

```javascript
import { createExportAction, createImportAction } from './MenuActionsHelpers.svelte.js'

export function registerStorageMenu(ideStore, toolId, namespace, options = {}) {
  const {
    menuId = 'storage',
    menuLabel = 'Stockage',
    menuOrder = 800,
    exportLabel = 'Exporter les données...',
    importLabel = 'Importer les données...',
    filename
  } = options
  
  // Créer le menu s'il n'existe pas
  ideStore.registerMenu({ 
    id: menuId, 
    label: menuLabel, 
    order: menuOrder 
  }, toolId)
  
  // Enregistrer les actions
  ideStore.registerMenuItem(menuId, {
    id: `${toolId}-export`,
    label: exportLabel,
    order: 10,
    action: createExportAction(namespace, {
      filename,
      onSuccess: () => ideStore.addNotification(
        'Export réussi',
        `Les données de ${toolId} ont été exportées`,
        'success',
        toolId
      ),
      onError: (err) => ideStore.addNotification(
        'Erreur d\'export',
        err.message,
        'error',
        toolId
      )
    })
  }, toolId)
  
  ideStore.registerMenuItem(menuId, {
    id: `${toolId}-import`,
    label: importLabel,
    order: 20,
    action: createImportAction(namespace, {
      mode: 'replace',
      onSuccess: () => ideStore.addNotification(
        'Import réussi',
        `Les données de ${toolId} ont été importées`,
        'success',
        toolId
      ),
      onError: (err) => ideStore.addNotification(
        'Erreur d\'import',
        err.message,
        'error',
        toolId
      )
    })
  }, toolId)
}
```

### 4. Exports dans `public-api.js`

```javascript
// Helpers de menu pour export/import
export { createExportAction, createImportAction } from './core/MenuActionsHelpers.svelte.js'
export { registerStorageMenu } from './core/StorageMenuHelper.svelte.js'
```

## Tâches

### Phase 1 : Implémentation Core (Priorité HAUTE)
- [ ] Créer `/src/core/MenuActionsHelpers.svelte.js`
  - [ ] Implémenter `downloadFile()` utilitaire
  - [ ] Implémenter `pickFile()` utilitaire
  - [ ] Implémenter `createExportAction()`
  - [ ] Implémenter `createImportAction()`
  - [ ] Ajouter JSDoc complet
- [ ] Créer `/src/core/StorageMenuHelper.svelte.js`
  - [ ] Implémenter `registerStorageMenu()`
  - [ ] Ajouter JSDoc complet
- [ ] Mettre à jour `/src/public-api.js`
  - [ ] Exporter `createExportAction`, `createImportAction`
  - [ ] Exporter `registerStorageMenu`

### Phase 2 : Tests et Validation (Priorité HAUTE)
- [ ] Créer un outil de test dans `test_tools/storage_test/`
  - [ ] Utiliser `createExportAction()` manuellement
  - [ ] Utiliser `createImportAction()` manuellement
  - [ ] Tester avec `JsonPersister` (export JSON)
  - [ ] Tester avec `BinaryPersister` (export ZIP)
- [ ] Tester le helper `registerStorageMenu()`
  - [ ] Vérifier la création automatique du menu
  - [ ] Vérifier les callbacks de succès/erreur
  - [ ] Tester l'import avec mode 'merge' et 'replace'

### Phase 3 : Intégration dans un Outil Existant (Priorité MOYENNE)
- [ ] Ajouter export/import à l'outil `explorer`
  - [ ] Option A : Utiliser `registerStorageMenu()` (recommandé)
  - [ ] Option B : Créer menu "File" avec actions manuelles
- [ ] Documenter l'intégration dans un commentaire de l'outil

### Phase 4 : Documentation (Priorité MOYENNE)
- [ ] Créer `/src/_DOCS/EXPORT_IMPORT_MENU_GUIDE.md`
  - [ ] Expliquer les deux approches (action creators vs helper)
  - [ ] Montrer des exemples complets
  - [ ] Documenter les options disponibles
  - [ ] Ajouter des warnings (format de données, compatibilité)
- [ ] Mettre à jour `README.md`
  - [ ] Ajouter une section "Export/Import de données"
  - [ ] Lien vers la documentation détaillée

### Phase 5 : Améliorations (Priorité BASSE)
- [ ] Ajouter un indicateur de progression pour les gros exports
- [ ] Implémenter la validation du format de données avant import
- [ ] Ajouter un mode "dry-run" pour prévisualiser l'import
- [ ] Support du drag & drop pour l'import de fichiers

## Questions Ouvertes

### 1. Gestion des erreurs et UI de feedback
**Question :** Faut-il créer un composant modal dédié pour l'import/export ou utiliser uniquement les notifications ?

**Options :**
- **A) Notifications uniquement** (recommandé pour MVP)
  - ✅ Simple et cohérent avec le reste de l'IDE
  - ✅ Pas de nouvelle UI à créer
  - ❌ Moins visuel pour les opérations longues
  
- **B) Modal de progression**
  - ✅ Meilleur feedback pour les gros fichiers
  - ❌ Complexité supplémentaire
  - ❌ Nécessite un composant ProgressModal

**Décision recommandée :** Option A pour le MVP, Option B si besoin exprimé par les utilisateurs.

### 2. Validation et compatibilité des formats
**Question :** Comment gérer les imports de données incompatibles ou corrompues ?

**Scénarios :**
- Utilisateur importe un fichier JSON qui n'a pas la structure attendue
- Utilisateur importe un ZIP d'un autre namespace
- Utilisateur importe des données d'une ancienne version de l'outil

**Solutions possibles :**
1. **Validation stricte** : Rejeter tout import qui ne respecte pas un schéma
   - Nécessite de définir des schémas par namespace (complexe)
2. **Validation souple** : Importer ce qui est valide, ignorer le reste
   - Risque de données partielles
3. **Pas de validation** : Import brut, laisser l'outil gérer
   - Simple mais risqué

**Décision recommandée :** Option 3 pour le MVP (déléguer la validation à l'outil), documenter ce comportement clairement.

### 3. Nommage automatique des fichiers
**Question :** Quel format de timestamp et quelles règles de nommage pour les fichiers exportés ?

**Formats possibles :**
- `namespace-YYYY-MM-DD-HHmmss.json` (actuel dans le plan)
- `namespace-backup-YYYY-MM-DD.json` (plus court)
- `namespace.json` (simple, mais écrase les anciens)

**Considérations :**
- Éviter les caractères spéciaux (`:`, `/`, `\\`)
- Inclure assez d'infos pour identifier le fichier
- Permettre l'override via `options.filename`

**Décision recommandée :** `namespace-YYYY-MM-DD-HHmmss.json` par défaut, avec override possible.

## Annexes

### Exemple d'utilisation complète

```javascript
// Dans mon outil personnalisé : MyCustomTool.svelte.js

import { Tool } from 'svelte-ide'
import { createExportAction, createImportAction, registerStorageMenu } from 'svelte-ide'

class MyCustomTool extends Tool {
  constructor() {
    super('my-custom-tool', 'My Tool', '🔧', 'topLeft')
  }
  
  initialize(ideStore) {
    super.initialize(ideStore)
    
    // APPROCHE 1 : Helper tout-en-un (recommandé pour débutants)
    registerStorageMenu(ideStore, this.id, 'my-tool-data', {
      menuLabel: 'Données',
      filename: 'my-tool-backup.json'
    })
    
    // APPROCHE 2 : Actions manuelles (plus de contrôle)
    /*
    ideStore.registerMenu({ id: 'file', label: 'Fichier', order: 100 }, this.id)
    
    ideStore.registerMenuItem('file', {
      id: 'export-data',
      label: 'Export Data...',
      shortcut: 'Ctrl+E',
      order: 10,
      action: createExportAction('my-tool-data', {
        onSuccess: ({ filename }) => {
          ideStore.addNotification('Export réussi', `Sauvegardé dans ${filename}`, 'success', this.id)
        }
      })
    }, this.id)
    
    ideStore.registerMenuItem('file', {
      id: 'import-data',
      label: 'Import Data...',
      shortcut: 'Ctrl+I',
      order: 20,
      action: createImportAction('my-tool-data', {
        mode: 'merge',
        onSuccess: () => {
          ideStore.addNotification('Import réussi', 'Données importées', 'success', this.id)
          // Rafraîchir l'UI de l'outil si nécessaire
          this.refresh()
        }
      })
    }, this.id)
    */
  }
}
```

### Schéma de décision pour les intégrateurs

```
Avez-vous besoin d'actions export/import ?
├── OUI
│   ├── Besoin simple (export JSON, import avec confirmation) ?
│   │   └── Utiliser registerStorageMenu()
│   │       → 3 lignes de code dans initialize()
│   │
│   └── Besoin avancé (callbacks custom, UX spécifique) ?
│       └── Utiliser createExportAction() + createImportAction()
│           → Créer un menu manuel avec ideStore.registerMenuItem()
│
└── NON
    └── Rien à faire, votre outil n'utilise pas la persistance publique
```
