import { indexedDBService, persistenceRegistry } from 'svelte-ide'

class DocumentPersistenceService {
  constructor() {
    this.binaryPersister = null
    this.treePersister = null
    this.backendResponsesPersister = null
    this.metaPersister = null
    this.initialized = false
    this.storesReady = false
    this._preparePromise = null
  }

  initialize() {
    if (this.initialized) {
      return
    }

    this.binaryPersister = persistenceRegistry.createPersister('documents', 'binary')
    this.treePersister = persistenceRegistry.createPersister('document-library-tree', 'json')
    this.backendResponsesPersister = persistenceRegistry.createPersister('document-backend-responses', 'json')
    this.metaPersister = persistenceRegistry.createPersister('document-library-meta', 'json')
    this.initialized = true
  }

  _assertInitialized() {
    if (!this.initialized) {
      throw new Error('DocumentPersistenceService is not initialized')
    }
  }

  async prepare() {
    if (this.storesReady) {
      return
    }
    if (!this._preparePromise) {
      this._preparePromise = this._ensureStoresReady()
    }
    await this._preparePromise
  }

  async _ensureStoresReady() {
    this.initialize()
    if (this.storesReady) {
      return
    }
    const storeNames = [
      this.treePersister?.storeName,
      this.backendResponsesPersister?.storeName,
      this.metaPersister?.storeName
    ].filter(Boolean)

    for (const storeName of storeNames) {
      await indexedDBService.ensureStore(storeName)
    }

    this.storesReady = true
  }

  getBinaryPersister() {
    this._assertInitialized()
    return this.binaryPersister
  }

  getTreePersister() {
    this._assertInitialized()
    return this.treePersister
  }

  getBackendResponsesPersister() {
    this._assertInitialized()
    return this.backendResponsesPersister
  }

  getMetaPersister() {
    this._assertInitialized()
    return this.metaPersister
  }
}

export const documentPersistenceService = new DocumentPersistenceService()
