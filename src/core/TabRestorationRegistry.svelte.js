import { eventBus } from '@/core/EventBusService.svelte.js'

class TabRestorationRegistry {
  constructor() {
    this.strategies = $state({})
  }

  registerStrategy(type, strategy) {
    this.strategies[type] = strategy
  }

  async restoreTab(descriptor) {
    // Utiliser l'EventBus pour demander la restauration
    return new Promise((resolve, reject) => {
      const restoreEvent = {
        descriptor,
        resolve,
        reject,
        handled: false
      }

      console.log("Envoi de l'evenement de restauration:", descriptor)
      
      // Publier l'evenement de restauration
      eventBus.publish('tab:restore-request', restoreEvent)

      // Si aucun outil n'a gere la restauration apres 2 secondes
      setTimeout(() => {
        if (!restoreEvent.handled) {
          console.warn(`Aucun outil ne peut restaurer le type: ${descriptor.type}`)
          resolve(this._createErrorTab(descriptor, new Error('Outil non trouve')))
        }
      }, 2000)
    })
  }

  _createErrorTab(descriptor, error) {
    return {
      id: `error-${Date.now()}`,
      title: `Erreur: ${descriptor.resourceId}`,
      component: () => ({
        render: () => `
          <div style="padding: 20px; color: #ff6b6b;">
            <h3>Erreur de Restauration</h3>
            <p>Impossible de restaurer: ${descriptor.resourceId}</p>
            <p>Type: ${descriptor.type}</p>
            <p>Erreur: ${error.message}</p>
            <button onclick="window.location.reload()">Recharger la page</button>
          </div>
        `
      }),
      closable: true,
      icon: 'X'
    }
  }
}

export const tabRestorationRegistry = new TabRestorationRegistry()

// Plus de strategies codees en dur dans l'IDE !
// Les outils s'enregistrent eux-memes via l'EventBus
