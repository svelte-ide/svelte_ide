import { stateProviderService } from '@/core/StateProviderService.svelte.js'
import { persistenceRegistry } from '@/core/persistence/PersistenceRegistry.svelte.js'

const DEFAULT_STATE = {
  selectedItem: null,
  recentFiles: []
}
const MAX_RECENTS = 8

function normalizeFileName(name) {
  if (!name || typeof name !== 'string') {
    return null
  }
  return name.trim()
}

class ExplorerPersistenceService {
  constructor() {
    this.state = $state({
      ...DEFAULT_STATE,
      loaded: false
    })
    this.persister = persistenceRegistry.createPersister('tool-explorer', 'json', {
      storeName: 'tool-explorer'
    })

    stateProviderService.registerProvider('tool-explorer', this)
    this._loadInitialState()
  }

  async _loadInitialState() {
    try {
      const stored = await this.persister.load('state', DEFAULT_STATE)
      this.state = {
        ...DEFAULT_STATE,
        ...stored,
        loaded: true
      }
    } catch (error) {
      console.warn('ExplorerPersistence: failed to restore state, fallback to defaults', error)
      this.state = {
        ...DEFAULT_STATE,
        loaded: true
      }
    }
  }

  async _persist() {
    try {
      await this.persister.save('state', this.saveState())
    } catch (error) {
      console.warn('ExplorerPersistence: failed to persist state', error)
    }
  }

  _computeRecents(nextItem) {
    const normalized = normalizeFileName(nextItem)
    if (!normalized) {
      return [...this.state.recentFiles]
    }

    const withoutItem = this.state.recentFiles.filter(entry => entry !== normalized)
    const updated = [normalized, ...withoutItem]
    return updated.slice(0, MAX_RECENTS)
  }

  async setSelectedItem(itemName) {
    const normalized = normalizeFileName(itemName)
    if (this.state.selectedItem === normalized) {
      return
    }

    this.state = {
      ...this.state,
      selectedItem: normalized,
      recentFiles: this._computeRecents(normalized)
    }

    await this._persist()
  }

  saveState() {
    return {
      selectedItem: this.state.selectedItem,
      recentFiles: this.state.recentFiles
    }
  }

  async restoreState(restoredState) {
    const normalized = {
      ...DEFAULT_STATE,
      ...(restoredState ?? {})
    }
    this.state = {
      ...normalized,
      loaded: true
    }
    await this._persist()
  }
}

export const explorerPersistence = new ExplorerPersistenceService()
