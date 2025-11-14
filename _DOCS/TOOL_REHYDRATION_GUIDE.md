# Guide de Réhydratation pour Développeurs d'Outils

Ce guide explique comment implémenter la réhydratation des onglets pour vos outils personnalisés dans svelte-ide.

## Qu'est-ce que la Réhydratation ?

La réhydratation permet de **restaurer automatiquement les onglets ouverts** lorsqu'un utilisateur recharge la page ou revient à l'application. Cela inclut :

- Les fichiers ouverts dans des onglets
- Le contenu modifié (non sauvegardé)
- L'état de l'outil (sélection, scrolling, etc.)

## Architecture de la Réhydratation

```
1. Sauvegarde (à chaque changement)
   └─> ideStore.saveUserLayout()
       └─> stateProviderService.saveAllStatesAsync()
           └─> VotreOutilPersistenceService.saveState()

2. Restauration (au chargement de la page)
   └─> ideStore.restoreUserLayout()
       ├─> Publier 'tab:hydrate' pour chaque onglet
       └─> stateProviderService.restoreAllStates()
           └─> VotreOutilPersistenceService.restoreState()
               └─> Publier 'votre-outil:state-restored'

3. Hydratation des onglets
   └─> VotreOutilRestorationService écoute 'tab:hydrate'
       ├─> Si état restauré → Hydrater immédiatement
       └─> Sinon → Mettre en file d'attente
           └─> Traiter après 'votre-outil:state-restored'
```

## Implémentation Étape par Étape

### Étape 1 : Service de Persistance

Créez un service qui gère la sauvegarde et restauration de l'état de votre outil.

**Fichier** : `src/tools/mon-outil/MonOutilPersistenceService.svelte.js`

```javascript
import { eventBus } from '@svelte-ide/core/EventBusService.svelte.js'
import { stateProviderService } from '@svelte-ide/core/StateProviderService.svelte.js'
import { persistenceRegistry } from '@svelte-ide/core/persistence/PersistenceRegistry.svelte.js'

const DEFAULT_STATE = {
  selectedItem: null,
  recentItems: []
}

class MonOutilPersistenceService {
  constructor() {
    // État par défaut avec loaded=true
    this.state = $state({
      ...DEFAULT_STATE,
      loaded: true
    })
    
    // Créer un persister pour IndexedDB
    this.persister = persistenceRegistry.createPersister('tool-mon-outil', 'json', {
      storeName: 'tool-mon-outil'
    })

    // S'enregistrer auprès du StateProviderService
    stateProviderService.registerProvider('tool-mon-outil', this)
    
    this.hasRestoredOnce = false
  }

  async _persist() {
    try {
      await this.persister.save('state', this.saveState())
    } catch (error) {
      console.warn('MonOutilPersistence: failed to persist state', error)
    }
  }

  // Méthode appelée à chaque sauvegarde
  saveState() {
    return {
      selectedItem: this.state.selectedItem,
      recentItems: this.state.recentItems,
      // Ajoutez ici tous les contenus de fichiers/données à persister
      fileContents: monOutilStore.getAllContents(),
      fileOriginalContents: monOutilStore.getAllOriginalContents()
    }
  }

  // Méthode appelée lors de la restauration
  async restoreState(restoredState) {
    if (!restoredState) {
      restoredState = {}
    }
    
    const normalized = {
      ...DEFAULT_STATE,
      ...restoredState
    }
    
    this.state = {
      ...normalized,
      loaded: true
    }
    
    // Restaurer les contenus dans votre store local
    if (restoredState.fileContents || restoredState.fileOriginalContents) {
      monOutilStore.restoreAllContents(
        restoredState.fileContents ?? {},
        restoredState.fileOriginalContents ?? {}
      )
    }
    
    await this._persist()
    this.hasRestoredOnce = true
    
    // CRITIQUE : Publier l'événement de restauration
    eventBus.publish('mon-outil:state-restored', { 
      state: this.state,
      hasRestoredContent: !!(restoredState.fileContents)
    })
  }

  // Méthodes publiques pour modifier l'état
  async setSelectedItem(itemName) {
    this.state.selectedItem = itemName
    await this._persist()
  }
}

export const monOutilPersistence = new MonOutilPersistenceService()
```

### Étape 2 : Service de Restauration (Hydratation)

Créez un service qui écoute les événements `tab:hydrate` et hydrate les onglets.

**Fichier** : `src/tools/mon-outil/MonOutilRestorationService.svelte.js`

```javascript
import { eventBus } from '@svelte-ide/core/EventBusService.svelte.js'
import { monOutilStore } from './monOutilStore.svelte.js'
import { getFileContent } from './monOutilFileService.svelte.js'
import MonOutilViewer from './MonOutilViewer.svelte'

class MonOutilRestorationService {
  constructor() {
    this.stateRestored = false
    this.pendingHydrations = []
    
    // Écouter l'événement de restauration d'état
    eventBus.subscribe('mon-outil:state-restored', ({ hasRestoredContent }) => {
      this.stateRestored = true
      
      // Traiter toutes les hydratations en attente
      const pending = [...this.pendingHydrations]
      this.pendingHydrations = []
      
      pending.forEach(hydrationFn => {
        try {
          hydrationFn()
        } catch (error) {
          console.error('MonOutil: erreur lors de l\'hydratation différée', error)
        }
      })
    })
    
    // Écouter les événements d'hydratation de tabs
    eventBus.subscribe('tab:hydrate', (hydrateEvent) => {
      if (hydrateEvent.descriptor.type === 'file-editor' && 
          hydrateEvent.descriptor.toolId === 'mon-outil') {
        
        if (this.stateRestored) {
          // État déjà restauré, hydrater immédiatement
          void this.handleHydrate(hydrateEvent)
        } else {
          // État pas encore restauré, mettre en file d'attente
          this.pendingHydrations.push(() => this.handleHydrate(hydrateEvent))
        }
      }
    })
  }

  async handleHydrate(hydrateEvent) {
    const { descriptor, tabId, hydrateCallback, userId } = hydrateEvent
    const fileName = descriptor.resourceId
    
    try {
      // Essayer d'abord d'utiliser le contenu en cache
      let content = monOutilStore.getFileContent(fileName)
      
      if (content === null) {
        // Fallback : charger depuis le service de fichiers
        content = await getFileContent(fileName)
      }

      // Appeler le callback pour hydrater le tab
      hydrateCallback(MonOutilViewer, {
        content: content,
        fileName: fileName
      })
      
    } catch (error) {
      console.error('MonOutil: erreur hydratation fichier', error)
      
      // Hydrater quand même avec un contenu vide pour éviter un tab cassé
      hydrateCallback(MonOutilViewer, {
        content: '',
        fileName: fileName
      })
    }
  }
}

export const monOutilRestorationService = new MonOutilRestorationService()
```

### Étape 3 : Store Local (Optionnel mais Recommandé)

Créez un store local pour gérer les contenus en mémoire.

**Fichier** : `src/tools/mon-outil/monOutilStore.svelte.js`

```javascript
const fileContents = $state({})
const fileOriginalContents = $state({})

function hasValue(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key)
}

export const monOutilStore = {
  getFileContent(fileName) {
    if (!fileName) return null
    return hasValue(fileContents, fileName) ? fileContents[fileName] : null
  },

  setFileContent(fileName, content) {
    if (!fileName) return
    fileContents[fileName] = content
  },

  getFileOriginalContent(fileName) {
    if (!fileName) return null
    return hasValue(fileOriginalContents, fileName) ? fileOriginalContents[fileName] : null
  },

  setFileOriginalContent(fileName, content) {
    if (!fileName) return
    fileOriginalContents[fileName] = content
  },

  clearFileState(fileName) {
    if (!fileName) return
    delete fileContents[fileName]
    delete fileOriginalContents[fileName]
  },

  // Méthodes pour la persistance globale
  getAllContents() {
    return { ...fileContents }
  },

  getAllOriginalContents() {
    return { ...fileOriginalContents }
  },

  restoreAllContents(contents = {}, originalContents = {}) {
    Object.keys(fileContents).forEach(key => delete fileContents[key])
    Object.keys(fileOriginalContents).forEach(key => delete fileOriginalContents[key])
    
    Object.assign(fileContents, contents)
    Object.assign(fileOriginalContents, originalContents)
  }
}
```

### Étape 4 : Enregistrement des Services

Importez vos services dans le point d'entrée de votre outil.

**Fichier** : `src/tools/mon-outil/index.svelte.js`

```javascript
import { Tool } from '@svelte-ide/core/Tool.svelte.js'
import MonOutilWrapper from './MonOutilWrapper.svelte'
import './MonOutilPersistenceService.svelte.js'
import './MonOutilRestorationService.svelte.js'

class MonOutilTool extends Tool {
  constructor() {
    super('Mon Outil', '🔧', 'topLeft', 'mon-outil')
  }

  initialize() {
    this.setComponent(MonOutilWrapper, { toolId: this.id })
  }

  destroy() {
    super.destroy()
  }
}

export default {
  register(toolManager) {
    const monOutil = new MonOutilTool()
    toolManager.registerTool(monOutil)
  }
}
```

### Étape 5 : Ouverture de Fichiers avec Descripteur

Quand votre outil ouvre un fichier dans un onglet, utilisez un **descripteur** pour permettre la réhydratation.

```javascript
// Dans votre composant ou service
async function openFileInIDE(fileName) {
  const content = await getFileContent(fileName)
  
  // Stocker le contenu dans le store local
  monOutilStore.setFileContent(fileName, content)
  monOutilStore.setFileOriginalContent(fileName, content)

  // Ouvrir l'onglet avec un descripteur
  const tab = ideStore.openFile({
    fileName,
    content,
    component: MonOutilViewer,
    icon: '📄',
    toolId: 'mon-outil',
    scrollMode: SCROLL_MODES.tool
  })

  // Ajouter les callbacks de sauvegarde
  tab.onSave = async () => {
    try {
      const latestContent = monOutilStore.getFileContent(fileName) ?? content
      await saveFileContent(fileName, latestContent)
      monOutilStore.setFileOriginalContent(fileName, latestContent)
      tab.originalContent = latestContent
      tab.content = latestContent
      
      ideStore.addNotification(
        'Fichier sauvegardé',
        `Les modifications de "${fileName}" ont été enregistrées.`,
        'success',
        'mon-outil'
      )
      return true
    } catch (error) {
      console.error('MonOutil: sauvegarde impossible', error)
      ideStore.addNotification(
        'Erreur de sauvegarde',
        error?.message || 'Impossible d\'enregistrer ce fichier.',
        'error',
        'mon-outil'
      )
      return false
    }
  }

  return tab
}
```

## Checklist de Validation

Avant de déployer votre outil avec réhydratation, vérifiez :

- [ ] ✅ `PersistenceService` implémente `saveState()` et `restoreState()`
- [ ] ✅ `PersistenceService` est enregistré avec `stateProviderService.registerProvider()`
- [ ] ✅ `PersistenceService` publie `'votre-outil:state-restored'` dans `restoreState()`
- [ ] ✅ `RestorationService` écoute `'tab:hydrate'` avec filtre sur `toolId`
- [ ] ✅ `RestorationService` écoute `'votre-outil:state-restored'`
- [ ] ✅ `RestorationService` gère une file d'attente pour les hydratations prématurées
- [ ] ✅ Les deux services sont importés dans `index.svelte.js`
- [ ] ✅ Les onglets sont ouverts avec un `descriptor` contenant `type`, `resourceId`, `toolId`
- [ ] ✅ Le composant viewer reçoit les props `content` et `fileName`
- [ ] ✅ Le store local persiste les contenus modifiés

## Test Manuel

1. **Ouvrir un fichier** : Double-cliquez sur un fichier dans votre outil
2. **Modifier le contenu** : Faites des changements dans l'éditeur
3. **Recharger la page** : Appuyez sur F5
4. **Vérifier** :
   - ✅ L'onglet se rouvre automatiquement
   - ✅ Le contenu modifié est restauré
   - ✅ Aucune erreur dans la console

## Logs de Débogage

Pour activer les logs de débogage, ajoutez des `console.log()` dans vos services :

```javascript
// Dans PersistenceService.restoreState()
console.log('[MonOutil] restoreState called', {
  hasData: !!restoredState,
  hasFileContents: !!(restoredState?.fileContents)
})

// Dans RestorationService.handleHydrate()
console.log('[MonOutil] handleHydrate', {
  fileName,
  hasCache: content !== null,
  contentLength: content?.length ?? 0
})
```

Vous pouvez aussi activer le mode debug de l'EventBus :

```javascript
// Dans la console du navigateur
eventBus.setDebugMode(true)
```

## Problèmes Courants

### L'onglet ne se rouvre pas

**Cause** : Le `descriptor` n'est pas défini ou mal formé.

**Solution** : Vérifiez que `ideStore.openFile()` est appelé avec un `toolId` correct.

### L'onglet est vide ("Contenu a implementer")

**Cause** : Le `hydrateCallback` n'est pas appelé ou les props ne sont pas passées.

**Solution** : 
- Vérifiez que `RestorationService` écoute bien `'tab:hydrate'`
- Vérifiez que le filtre `toolId` correspond
- Vérifiez que le viewer reçoit `content` et `fileName` comme props

### Le contenu modifié n'est pas restauré

**Cause** : Le store local n'est pas persisté dans `saveState()`.

**Solution** : Ajoutez `fileContents` dans le retour de `saveState()` et restaurez-le dans `restoreState()`.

### Boucle infinie ou "Maximum update depth exceeded"

**Cause** : `$effect` qui lit et modifie la même variable.

**Solution** : Utilisez des gardes (`if (value !== newValue)`) avant les modifications.

## Exemples de Référence

Pour des exemples concrets, consultez :

- **Explorer 1** : `src/test_tools/explorer/`
  - Pattern complet avec cache de contenu
  - Gestion des fichiers binaires
  
- **Transactions** : `src/test_tools/transactions/` (si implémenté)
  - Persistance d'état complexe
  - Restauration de sélections multiples

## Support et Questions

Pour toute question ou problème :

1. Consultez `_DOCS/EXPLORER_REHYDRATION_FIX.md` pour l'architecture détaillée
2. Consultez `_DOCS/REHYDRATION_SUCCESS.md` pour la validation
3. Activez les logs de debug pour voir le flux d'événements
4. Vérifiez que vos services sont bien instanciés au démarrage

---

**Rappel** : Cette architecture respecte strictement le principe de séparation IDE/Outils. Aucune modification du cœur n'est nécessaire pour implémenter la réhydratation dans vos outils personnalisés.
