class EventBusService {
  constructor() {
    this.listeners = {}
    this.debugMode = false
  }

  publish(eventName, data) {
    if (this.debugMode) {
      console.log(
        `%c[EventBus] %c${eventName}`,
        'color: #ff7f50; font-weight: bold;',
        'color: #87ceeb;',
        data
      )
    }

    if (!this.listeners[eventName]) {
      return
    }
    this.listeners[eventName].forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Erreur dans un callback d'événement pour '${eventName}':`, error)
      }
    })
  }

  /**
   * S'abonne à un événement.
   * @param {string} eventName - Le nom de l'événement.
   * @param {function} callback - La fonction à appeler lorsque l'événement est publié.
   * @returns {function} Une fonction pour se désabonner.
   */
  subscribe(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = []
    }
    this.listeners[eventName].push(callback)

    // Retourne une fonction de désabonnement
    return () => {
      this.unsubscribe(eventName, callback)
    }
  }

  /**
   * Se désabonne d'un événement.
   * @param {string} eventName - Le nom de l'événement.
   * @param {function} callback - La fonction de callback à supprimer.
   */
  unsubscribe(eventName, callback) {
    if (!this.listeners[eventName]) {
      return
    }
    this.listeners[eventName] = this.listeners[eventName].filter(
      listener => listener !== callback
    )
  }
}

export const eventBus = new EventBusService()
