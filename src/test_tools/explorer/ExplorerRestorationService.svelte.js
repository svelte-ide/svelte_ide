import { eventBus } from '@/core/EventBusService.svelte.js'
import { getFileContent } from './fileService.svelte.js'
import FileViewer from './FileViewer.svelte'

class ExplorerRestorationService {
  constructor() {
    this.init()
  }

  init() {
    eventBus.subscribe('tab:hydrate', (hydrateEvent) => {
      if (hydrateEvent.descriptor.type === 'file-editor' && 
          hydrateEvent.descriptor.toolId === 'explorer') {
        void this.handleHydrate(hydrateEvent)
      }
    })
  }

  async handleHydrate(hydrateEvent) {
    const { descriptor, tabId, hydrateCallback, userId } = hydrateEvent
    
    try {
      const content = await getFileContent(descriptor.resourceId)

      hydrateCallback(FileViewer, {
        content: content,
        fileName: descriptor.resourceId
      })
      
    } catch (error) {
      console.error('Erreur hydratation fichier:', error)
    }
  }
}

export const explorerRestorationService = new ExplorerRestorationService()
