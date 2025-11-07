import { LocalStoragePersister, MemoryPersister } from '@/core/PersisterInterface.js'
import { IndexedDBPersister } from '@/core/persistence/IndexedDBPersister.svelte.js'
import { APP_KEY } from '@/core/config/appKey.js'

const ALLOWED_TYPES = ['localstorage', 'memory', 'indexeddb']
const DEFAULT_TYPE = (() => {
    const envValue = import.meta?.env?.VITE_PERSISTENCE_DEFAULT_TYPE
    if (envValue && ALLOWED_TYPES.includes(envValue.toLowerCase())) {
        return envValue.toLowerCase()
    }
    return 'indexeddb'
})()

export class PersistenceRegistry {
    constructor() {
        this.persisters = new Map()
        this.namespacePrefix = null
        this.defaultPersisterOptions = {}
        this.setNamespacePrefix(APP_KEY)
        this.setDefaultPersisterType(DEFAULT_TYPE)
    }

    setNamespacePrefix(prefix) {
        if (prefix && typeof prefix !== 'string') {
            throw new Error('Namespace prefix must be a string')
        }
        if (this.persisters.size > 0) {
            console.warn('Namespace prefix set after persisters were created; existing persisters keep their current namespace')
        }
        this.namespacePrefix = prefix && prefix.length > 0 ? prefix : null
    }

    _getMapKey(namespace) {
        return this.namespacePrefix ? `${this.namespacePrefix}::${namespace}` : namespace
    }

    _getEffectiveNamespace(namespace) {
        return this.namespacePrefix ? `${this.namespacePrefix}:${namespace}` : namespace
    }

    registerPersister(namespace, persister) {
        if (!namespace) {
            throw new Error('Namespace is required')
        }
        if (!persister || typeof persister.save !== 'function') {
            throw new Error('Persister must implement the PersisterInterface')
        }
        
        const mapKey = this._getMapKey(namespace)
        this.persisters.set(mapKey, persister)
        return persister
    }

    createPersister(namespace, type = this.defaultPersisterType, options = {}) {
        const mapKey = this._getMapKey(namespace)
        if (this.persisters.has(mapKey)) {
            return this.persisters.get(mapKey)
        }

        const effectiveType = type || this.defaultPersisterType
        const mergedOptions = { ...this.defaultPersisterOptions, ...options }
        let persister
        switch (effectiveType) {
            case 'localStorage':
                persister = new LocalStoragePersister(this._getEffectiveNamespace(namespace))
                break
            case 'memory':
                persister = new MemoryPersister(this._getEffectiveNamespace(namespace))
                break
            case 'indexeddb':
            case 'indexedDB':
                persister = new IndexedDBPersister(this._getEffectiveNamespace(namespace), mergedOptions)
                break
            default:
                throw new Error(`Unknown persister type: ${type}`)
        }

        this.registerPersister(namespace, persister)
        return persister
    }

    getPersister(namespace) {
        const mapKey = this._getMapKey(namespace)
        if (!this.persisters.has(mapKey)) {
            return this.createPersister(namespace)
        }
        return this.persisters.get(mapKey)
    }

    removePersister(namespace) {
        const mapKey = this._getMapKey(namespace)
        return this.persisters.delete(mapKey)
    }

    clearAll() {
        this.persisters.forEach(persister => {
            try {
                persister.clear()
            } catch (error) {
                console.error(`Failed to clear persister:`, error)
            }
        })
    }

    getRegisteredNamespaces() {
        return Array.from(this.persisters.keys())
    }

    save(namespace, key, data) {
        const persister = this.getPersister(namespace)
        return persister.save(key, data)
    }

    load(namespace, key, defaultValue = null) {
        const persister = this.getPersister(namespace)
        return persister.load(key, defaultValue)
    }

    remove(namespace, key) {
        const persister = this.getPersister(namespace)
        return persister.remove(key)
    }

    exists(namespace, key) {
        const persister = this.getPersister(namespace)
        return persister.exists(key)
    }

    setDefaultPersisterType(type) {
        if (!type) {
            throw new Error('Invalid persister type: undefined')
        }
        const normalized = typeof type === 'string' ? type.toLowerCase() : ''
        if (!ALLOWED_TYPES.includes(normalized)) {
            throw new Error(`Invalid persister type: ${type}`)
        }
        if (normalized === 'indexeddb') {
            this.defaultPersisterType = 'indexedDB'
        } else if (normalized === 'localstorage') {
            this.defaultPersisterType = 'localStorage'
        } else {
            this.defaultPersisterType = 'memory'
        }
    }

    setDefaultPersisterOptions(options = {}) {
        if (!options || typeof options !== 'object') {
            this.defaultPersisterOptions = {}
            return
        }
        this.defaultPersisterOptions = { ...options }
    }
}

export const persistenceRegistry = new PersistenceRegistry()
