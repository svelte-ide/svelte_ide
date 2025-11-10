import { eventBus } from '@/core/EventBusService.svelte.js'
import { explorerStore } from './explorerStore.svelte.js'
import { getFileContent } from './fileService.svelte.js'
import FileViewer from './FileViewer.svelte'

class ExplorerRestorationService {
  constructor() {
    this.stateRestored = false
    this.pendingHydrations = []
    
    console.log('[ExplorerRestoration] Service initialized')
    
    // S'abonner à l'événement de restauration d'état
    eventBus.subscribe('explorer:state-restored', ({ hasRestoredContent }) => {
      console.log('[ExplorerRestoration] State restored event received', { hasRestoredContent })
      this.stateRestored = true
      
      // Traiter toutes les hydratations en attente
      const pending = [...this.pendingHydrations]
      this.pendingHydrations = []
      
      console.log('[ExplorerRestoration] Processing pending hydrations', { count: pending.length })
      
      pending.forEach(hydrationFn => {
        try {
          hydrationFn()
        } catch (error) {
          console.error('Explorer: erreur lors de l\'hydratation différée', error)
        }
      })
    })
    
    // S'abonner aux événements d'hydratation de tabs
    eventBus.subscribe('tab:hydrate', (hydrateEvent) => {
      console.log('[ExplorerRestoration] tab:hydrate received (all)', hydrateEvent.descriptor)
      
      if (hydrateEvent.descriptor.type === 'file-editor' && 
          hydrateEvent.descriptor.toolId === 'explorer') {
        
        console.log('[ExplorerRestoration] tab:hydrate matched for explorer', {
          fileName: hydrateEvent.descriptor.resourceId,
          stateRestored: this.stateRestored
        })
        
        if (this.stateRestored) {
          // État déjà restauré, hydrater immédiatement
          console.log('[ExplorerRestoration] Calling handleHydrate immediately')
          void this.handleHydrate(hydrateEvent)
        } else {
          // État pas encore restauré, mettre en file d'attente
          console.log('[ExplorerRestoration] Queueing hydration')
          this.pendingHydrations.push(() => this.handleHydrate(hydrateEvent))
        }
      }
    })
  }

  async handleHydrate(hydrateEvent) {
    console.log('[ExplorerRestoration] handleHydrate ENTERED', hydrateEvent.descriptor)
    
    const { descriptor, tabId, hydrateCallback, userId } = hydrateEvent
    const fileName = descriptor.resourceId
    
    console.log('[ExplorerRestoration] handleHydrate processing', { fileName })
    
    try {
      // Essayer d'abord d'utiliser le contenu en cache depuis explorerStore
      let content = explorerStore.getFileContent(fileName)
      
      console.log('[ExplorerRestoration] Cache lookup result', {
        fileName,
        hasCache: content !== null,
        contentPreview: content?.substring(0, 50) ?? 'null'
      })
      
      if (content === null) {
        // Fallback : charger depuis le service de fichiers
        console.log('[ExplorerRestoration] Loading from fileService')
        content = await getFileContent(fileName)
      }

      console.log('[ExplorerRestoration] About to call hydrateCallback', {
        hasCallback: !!hydrateCallback,
        contentLength: content?.length ?? 0
      })

      hydrateCallback(FileViewer, {
        content: content,
        fileName: fileName
      })
      
      console.log('[ExplorerRestoration] Hydration completed successfully')
      console.log('[ExplorerRestoration] Verifying tab was hydrated via ideStore')
      
      // Vérifier que le tab a bien été hydraté
      import('@/stores/ideStore.svelte.js').then(({ ideStore }) => {
        const tab = ideStore.tabs.find(t => t.fileName === fileName)
        console.log('[ExplorerRestoration] Tab verification', {
          found: !!tab,
          hasComponent: !!(tab?.component),
          contentLength: tab?.content?.length ?? 0
        })
      })
      
    } catch (error) {
      console.error('[ExplorerRestoration] ERROR during hydration', error)
      
      // Hydrater quand même avec un contenu vide pour éviter un tab cassé
      hydrateCallback(FileViewer, {
        content: '',
        fileName: fileName
      })
    }
  }
}

export const explorerRestorationService = new ExplorerRestorationService()
