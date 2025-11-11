import { eventBus } from '@/core/EventBusService.svelte.js'
import DocumentViewerTab from './DocumentViewerTab.svelte'
import { TOOL_ID, VIEWER_RESOURCE_ID } from './constants.js'

class DocumentLibraryRestorationService {
  constructor() {
    this.stateRestored = false
    this.pendingHydrations = []

    eventBus.subscribe('document-library:state-restored', payload => {
      console.debug('DocumentLibraryRestorationService: state restored event', payload)
      this.stateRestored = true
      const queued = [...this.pendingHydrations]
      this.pendingHydrations = []
      queued.forEach(event => {
        void this.handleHydrate(event)
      })
    })

    eventBus.subscribe('tab:hydrate', hydrateEvent => {
      const descriptor = hydrateEvent?.descriptor
      if (!descriptor || descriptor.toolId !== TOOL_ID) return
      if (descriptor.resourceId !== VIEWER_RESOURCE_ID) return

      if (this.stateRestored) {
        void this.handleHydrate(hydrateEvent)
      } else {
        this.pendingHydrations.push(hydrateEvent)
      }
    })
  }

  async handleHydrate(hydrateEvent) {
    try {
      hydrateEvent.hydrateCallback(DocumentViewerTab, {})
    } catch (error) {
      console.error('DocumentLibrary: erreur hydratation', error)
      hydrateEvent.hydrateCallback(DocumentViewerTab, {})
    }
  }
}

export const documentLibraryRestorationService = new DocumentLibraryRestorationService()
