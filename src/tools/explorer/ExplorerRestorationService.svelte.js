import { eventBus } from '@/core/EventBusService.svelte.js'
import { getFileContent } from './fileService.svelte.js'
import FileViewer from './FileViewer.svelte'

class ExplorerRestorationService {
  constructor() {
    this.init()
  }

  init() {
    // L'outil s'enregistre pour l'hydratation des tabs
    eventBus.subscribe('tab:hydrate', (hydrateEvent) => {
      if (hydrateEvent.descriptor.type === 'file-editor') {
        this.handleHydrate(hydrateEvent)
      }
    })
    
    console.log('ExplorerRestorationService initialise et pret pour hydratation')
  }

  handleHydrate(hydrateEvent) {
    const { descriptor, tabId, hydrateCallback, userId } = hydrateEvent
    
    try {
      console.log(`Hydratation fichier ${descriptor.resourceId} pour ${userId}`)
      
      // Récupérer le contenu du fichier
      const content = getFileContent(descriptor.resourceId)
      
      // Utiliser le callback pour injecter le component et les données
      hydrateCallback(FileViewer, {
        content: content
      })
      
      console.log(`Fichier ${descriptor.resourceId} hydrate avec succes`)
      
    } catch (error) {
      console.error('Erreur hydratation fichier:', error)
    }
  }
}

export const explorerRestorationService = new ExplorerRestorationService()
