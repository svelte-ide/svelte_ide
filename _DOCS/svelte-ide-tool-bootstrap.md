---
title: Recette Bootstrap d’un outil svelte-ide
date_created: 2025-02-14
last_updated: 2025-02-14
---
# Construire un tool fiable dans svelte-ide
Cette recette décrit la base à répliquer pour tout nouveau tool frontend-first : bootstrap sécurisé, initialisation persisters, hydratation déterministe et intégration panel/tab. Inspirée de la Document Library, elle sert de référence minimale.

## 1. Pipeline de démarrage à respecter
1. `authStore.initialize()` fournit utilisateur + clé de chiffrement.
2. `indexedDBService.readyForEncryption({ timeoutMs })` et `binaryStorageService.initialize()` confirment que la base est disponible.
3. `eventBus.publish('persistence:ready', { encrypted: true })` confirme que tous les services chiffrés sont actifs.
4. Seulement après ce signal : `toolManager.registerExternalTools()` et donc l’enregistrement de ton outil.
5. Hydratation IDE : `ideStore.restoreUserLayout()` → `hydration:before` → `stateProviderService.restoreAllStates()` → rafale `tab:hydrate` → `hydration:after`.

**Règle** : ton outil ne doit jamais lire/écrire IndexedDB ni créer ses panels avant l’étape 4.

## 2. Bootstrap type (`index.svelte.js`)
```js
import { Tool, eventBus, getAuthStore, indexedDBService } from 'svelte-ide'
import MyToolPanel from './MyToolPanel.svelte'
import './MyToolRestorationService.svelte.js'
import { myPersistenceService } from './persistenceService.js'

const READY_TIMEOUT = 8000

class MyTool extends Tool {
  constructor() {
    super('Mon Tool', '🛠️', 'topLeft', 'my-tool')
  }
  initialize() {
    this.setComponent(MyToolPanel)
  }
}

let bootstrapPromise

function waitForEncryptedPersistence() {
  const authStore = getAuthStore()
  if (authStore.isAuthenticated && authStore.hasEncryptionKey) return Promise.resolve()
  return new Promise(resolve => {
    const unsubscribe = eventBus.subscribe('persistence:ready', payload => {
      if (payload?.encrypted) {
        unsubscribe()
        resolve()
      }
    })
  })
}

async function bootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await waitForEncryptedPersistence()
      await indexedDBService.readyForEncryption({ timeoutMs: READY_TIMEOUT })
      await myPersistenceService.prepare() // crée/upgrade les stores
    })()
  }
  await bootstrapPromise
}

export default {
  async register(toolManager) {
    await bootstrap()
    toolManager.registerTool(new MyTool())
  }
}
```

Principes :
- **Bootstrap unique** partagé par tous les panels/tabs de l’outil.
- Attente explicite des signaux `persistence:ready` **et** `readyForEncryption`.
- Appel à `persistenceService.prepare()` pour que tous les stores existent avant toute hydratation.

## 3. Service de persistance
```js
import { indexedDBService, persistenceRegistry } from 'svelte-ide'

class MyPersistenceService {
  constructor() {
    this.initialized = false
    this.storesReady = false
  }

  initialize() {
    if (this.initialized) return
    this.metaPersister = persistenceRegistry.createPersister('my-tool-meta', 'json')
    this.dataPersister = persistenceRegistry.createPersister('my-tool-data', 'json')
    this.initialized = true
  }

  async prepare() {
    if (this.storesReady) return
    this.initialize()
    await indexedDBService.ensureStore(this.metaPersister.storeName)
    await indexedDBService.ensureStore(this.dataPersister.storeName)
    this.storesReady = true
  }
}

export const myPersistenceService = new MyPersistenceService()
```
- Pas de fallback mémoire/localStorage : en cas d’indispo, on échoue explicitement.
- `prepare()` est idempotent et peut être rappelé au besoin.

## 4. Panel : restauration et sauvegardes
```svelte
<script>
  import { onMount } from 'svelte'
  import { eventBus, ideStore } from 'svelte-ide'
  import { myPersistenceService } from './persistenceService.js'
  import { getActiveEntityId, setActiveEntity } from './stores/entityStore.svelte.js'

  let metaPersister = null
  let dataPersister = null
  let isRestoring = $state(true)
  let hydrationInProgress = $state(false)

  onMount(async () => {
    metaPersister = myPersistenceService.metaPersister
    dataPersister = myPersistenceService.dataPersister

    await restoreData()

    const unsubBefore = eventBus.subscribe('hydration:before', () => hydrationInProgress = true)
    const unsubAfter = eventBus.subscribe('hydration:after', () => hydrationInProgress = false)

    return () => {
      unsubBefore()
      unsubAfter()
    }
  })

  async function restoreData() {
    try {
      const meta = await metaPersister.load('meta')
      const snapshot = await dataPersister.load('snapshot')
      if (snapshot) {
        // hydrater ton store local
      }
      if (meta?.activeId) {
        setActiveEntity(meta.activeId)
      }
    } finally {
      isRestoring = false
      eventBus.publish('my-tool:state-restored')
    }
  }

  $effect(() => {
    if (!metaPersister || isRestoring) return
    const activeId = getActiveEntityId()
    if (!activeId) return
    metaPersister.save('meta', { activeId }).catch(err => console.error(err))
  })
</script>
```
- **Pas de mode dégradé** : si `restoreData` échoue, on logge et on laisse l’utilisateur réessayer, mais on n’écrit jamais dans un stockage non chiffré.
- Les sauvegardes sont bloquées tant que `isRestoring` ou `hydrationInProgress` sont vrais.

## 5. Hydratation des tabs (`RestorationService`)
```js
import { eventBus } from 'svelte-ide'
import ViewerTab from './ViewerTab.svelte'
import { TOOL_ID, VIEWER_RESOURCE_ID } from './constants.js'

class MyToolRestorationService {
  constructor() {
    this.stateRestored = false
    this.pendingHydrations = []

    eventBus.subscribe('my-tool:state-restored', () => {
      this.stateRestored = true
      this.pendingHydrations.splice(0).forEach(evt => this._hydrate(evt))
    })

    eventBus.subscribe('tab:hydrate', evt => {
      const descriptor = evt?.descriptor
      if (!descriptor) return
      if (descriptor.toolId !== TOOL_ID) return
      if (descriptor.resourceId !== VIEWER_RESOURCE_ID) return

      if (this.stateRestored) {
        this._hydrate(evt)
      } else {
        this.pendingHydrations.push(evt)
      }
    })
  }

  _hydrate(evt) {
    evt.hydrateCallback(ViewerTab, {})
  }
}

export const myToolRestorationService = new MyToolRestorationService()
```
- On attend `my-tool:state-restored` avant de connecter les tabs.
- Aucun payload “magique” : tout l’état vient des stores partagés (runification Svelte 5).

## 6. Checklist finale
- [ ] `index.svelte.js` attend `persistence:ready` + `readyForEncryption`.
- [ ] `persistenceService.prepare()` crée les stores avant tout usage.
- [ ] Panel refuse de s’exécuter si les persisters ne sont pas prêts (log + throw).
- [ ] Sauvegardes bloquées pendant restauration/hydratation.
- [ ] `RestorationService` met en file d’attente les `tab:hydrate` jusqu’à `*:state-restored`.
- [ ] Aucun fallback localStorage/mémoire pour les données sensibles.

En suivant cette recette, chaque nouveau tool respecte le contrat svelte-ide, garantit un bootstrap déterministe et évite les courses entre persistance et hydratation. Reprends ces sections comme squelette pour ton prochain outil.***
