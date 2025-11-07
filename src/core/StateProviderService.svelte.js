class StateProviderService {
  constructor() {
    this.providers = new Map()
  }

  registerProvider(key, provider) {
    if (!provider.saveState || !provider.restoreState) {
      throw new Error(`State provider for "${key}" must implement saveState() and restoreState() methods`)
    }
    this.providers.set(key, provider)
  }

  unregisterProvider(key) {
    this.providers.delete(key)
  }

  saveAllStates() {
    const states = {}
    for (const [key, provider] of this.providers) {
      try {
        states[key] = provider.saveState()
      } catch (error) {
        console.error(`Error saving state for provider "${key}":`, error)
      }
    }
    return states
  }

  async saveAllStatesAsync() {
    const states = {}
    for (const [key, provider] of this.providers) {
      try {
        const result = provider.saveState()
        states[key] = result instanceof Promise ? await result : result
      } catch (error) {
        console.error(`Error saving async state for provider "${key}":`, error)
      }
    }
    return states
  }

  async restoreAllStates(states) {
    if (!states) return

    for (const [key, provider] of this.providers) {
      try {
        if (states[key]) {
          const maybePromise = provider.restoreState(states[key])
          if (maybePromise instanceof Promise) {
            await maybePromise
          }
        }
      } catch (error) {
        console.error(`Error restoring state for provider "${key}":`, error)
      }
    }
  }

  getProvider(key) {
    return this.providers.get(key)
  }

  getAllProviders() {
    return Array.from(this.providers.keys())
  }
}

export const stateProviderService = new StateProviderService()
