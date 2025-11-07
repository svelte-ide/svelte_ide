import { LocalStoragePersister, MemoryPersister, PersisterInterface } from '@/core/PersisterInterface.js'
import { indexedDBService } from '@/core/persistence/IndexedDBService.svelte.js'

const ENV_FALLBACK = (import.meta.env.VITE_INDEXEDDB_FALLBACK_STRATEGY || 'block').toLowerCase()
const ALLOWED_STRATEGIES = ['block', 'localstorage', 'memory']

function sanitizeStoreName(namespace) {
  return `persister_${namespace.replace(/[^a-z0-9_-]/gi, '_')}`
}

function createFallbackPersister(namespace, strategy) {
  const normalized = strategy.toLowerCase()
  
  if (!ALLOWED_STRATEGIES.includes(normalized)) {
    console.error(`IndexedDBPersister: Stratégie inconnue "${strategy}", utilisation de 'block'`)
    throw new Error(`IndexedDB is required but not available for namespace "${namespace}"`)
  }
  
  switch (normalized) {
    case 'block':
      console.error(`IndexedDBPersister: IndexedDB requis mais indisponible pour "${namespace}"`)
      throw new Error(`IndexedDB is required but not available for namespace "${namespace}"`)
    
    case 'localstorage':
      console.warn(`IndexedDBPersister: Fallback vers localStorage pour "${namespace}" (non chiffré, quota limité)`)
      return new LocalStoragePersister(namespace)
    
    case 'memory':
      console.warn(`IndexedDBPersister: Fallback vers mémoire pour "${namespace}" (données perdues au reload)`)
      return new MemoryPersister(namespace)
    
    default:
      throw new Error(`IndexedDB is required but not available for namespace "${namespace}"`)
  }
}

export class IndexedDBPersister extends PersisterInterface {
  constructor(namespace, options = {}) {
    super(namespace)
    this.storeName = options.storeName || sanitizeStoreName(namespace)
    const globalStrategy = indexedDBService.getFallbackStrategy?.() || ENV_FALLBACK
    this.fallbackStrategy = options.fallbackStrategy?.toLowerCase() || globalStrategy
    this.fallbackPersister = null
    this.initialized = false

    // Détection précoce si IndexedDB absent
    if (typeof indexedDB === 'undefined') {
      this.fallbackPersister = createFallbackPersister(this.namespace, this.fallbackStrategy)
    }
  }

  async _ensureReady() {
    if (this.fallbackPersister) return false
    if (this.initialized) return true

    try {
      await indexedDBService.initialize()
      if (!indexedDBService.hasStore(this.storeName)) {
        await indexedDBService.ensureStore(this.storeName)
      }
      this.initialized = true
      return true
    } catch (error) {
      console.error(`IndexedDBPersister: Échec initialisation store "${this.storeName}"`, error)
      this.fallbackPersister = createFallbackPersister(this.namespace, this.fallbackStrategy)
      return false
    }
  }

  async save(key, data) {
    if (!key) {
      console.warn('IndexedDBPersister: save() called without a key')
      return false
    }

    // Utiliser fallback si configuré
    if (this.fallbackPersister) {
      return this.fallbackPersister.save(key, data)
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.save(key, data)
    }

    try {
      const fullKey = this.getFullKey(key)
      const success = await indexedDBService.save(this.storeName, fullKey, data)
      return Boolean(success)
    } catch (error) {
      console.error(`IndexedDBPersister: Échec save "${key}"`, error)
      return false
    }
  }

  async load(key, defaultValue = null) {
    if (!key) {
      return defaultValue
    }

    if (this.fallbackPersister) {
      return this.fallbackPersister.load(key, defaultValue)
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.load(key, defaultValue)
    }

    try {
      const fullKey = this.getFullKey(key)
      const data = await indexedDBService.load(this.storeName, fullKey, defaultValue)
      return data ?? defaultValue
    } catch (error) {
      console.error(`IndexedDBPersister: Échec load "${key}"`, error)
      return defaultValue
    }
  }

  async remove(key) {
    if (!key) {
      return false
    }

    if (this.fallbackPersister) {
      return this.fallbackPersister.remove(key)
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.remove(key)
    }

    try {
      const fullKey = this.getFullKey(key)
      const success = await indexedDBService.delete(this.storeName, fullKey)
      return Boolean(success)
    } catch (error) {
      console.error(`IndexedDBPersister: Échec remove "${key}"`, error)
      return false
    }
  }

  async clear() {
    if (this.fallbackPersister) {
      return this.fallbackPersister.clear()
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.clear()
    }

    try {
      const success = await indexedDBService.clear(this.storeName)
      return Boolean(success)
    } catch (error) {
      console.error(`IndexedDBPersister: Échec clear "${this.storeName}"`, error)
      return false
    }
  }

  async exists(key) {
    if (!key) {
      return false
    }

    if (this.fallbackPersister) {
      return this.fallbackPersister.exists(key)
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.exists(key)
    }

    try {
      const fullKey = this.getFullKey(key)
      const value = await indexedDBService.load(this.storeName, fullKey, null)
      return value !== null && value !== undefined
    } catch (error) {
      console.error(`IndexedDBPersister: Échec exists "${key}"`, error)
      return false
    }
  }
}
