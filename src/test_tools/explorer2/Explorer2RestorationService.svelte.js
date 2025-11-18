import { eventBus } from '@svelte-ide/core/EventBusService.svelte.js'
import FileViewer from './FileViewer.svelte'
import { getFileContentV2 } from './fileService.svelte.js'

class Explorer2RestorationService {
  constructor() {
    this.init()
  }

  init() {
    eventBus.subscribe('tab:hydrate', (hydrateEvent) => {
      if (hydrateEvent.descriptor.type === 'file-editor' && 
          hydrateEvent.descriptor.resourceId.startsWith('V2:')) {
        this.handleHydrate(hydrateEvent)
      }
    })
  }

  handleHydrate(hydrateEvent) {
    const { descriptor, tabId, hydrateCallback, userId } = hydrateEvent
    
    try {
      const realFileName = descriptor.resourceId.replace('V2: ', '')
      const content = getFileContentV2(realFileName)

      hydrateCallback(FileViewer, {
        content: content,
        fileName: realFileName
      })

    } catch (error) {
      logger.error('Erreur hydratation fichier V2:', error)
    }
  }
}

export const explorer2RestorationService = new Explorer2RestorationService()
