import { APP_KEY } from '@svelte-ide/core/config/appKey.js'
import { BinaryPersister } from '@svelte-ide/core/persistence/BinaryPersister.svelte.js'
import { JsonPersister } from '@svelte-ide/core/persistence/JsonPersister.svelte.js'
import { LocalStoragePersister, MemoryPersister } from '@svelte-ide/core/persistence/PersisterInterface.js'

const ALLOWED_TYPES = ['json', 'binary', 'localstorage', 'memory']

function normalizeTypeValue(type) {
    if (!type || typeof type !== 'string') {
        return null
    }
    const normalized = type.toLowerCase()
    if (normalized === 'indexeddb') {
        return 'json'
    }
    if (ALLOWED_TYPES.includes(normalized)) {
        return normalized
    }
    return null
}

const DEFAULT_TYPE = (() => {
    const envValue = import.meta?.env?.VITE_PERSISTENCE_DEFAULT_TYPE
    const normalized = normalizeTypeValue(envValue)
    return normalized || 'json'
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

    _normalizeType(type) {
        const normalized = normalizeTypeValue(type)
        if (!normalized) {
            throw new Error(`Unknown persister type: ${type}`)
        }
        return normalized
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

        const normalizedType = this._normalizeType(type || this.defaultPersisterType)
        const mergedOptions = { ...this.defaultPersisterOptions, ...options }
        const effectiveNamespace = this._getEffectiveNamespace(namespace)
        let persister

        switch (normalizedType) {
            case 'json':
                persister = new JsonPersister(effectiveNamespace, mergedOptions)
                break
            case 'binary':
                persister = new BinaryPersister(effectiveNamespace, mergedOptions)
                break
            case 'localstorage':
                persister = new LocalStoragePersister(effectiveNamespace)
                break
            case 'memory':
                persister = new MemoryPersister(effectiveNamespace)
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
                console.error('Failed to clear persister:', error)
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

    async saveBlob(namespace, blobId, data, metadata = {}) {
        const persister = this.getPersister(namespace)
        if (!persister.supportsBinary) {
            throw new Error(`Namespace "${namespace}" does not support binary storage (use type: 'binary')`)
        }
        return persister.saveBlob(blobId, data, metadata)
    }

    async loadBlob(namespace, blobId, options = {}) {
        const persister = this.getPersister(namespace)
        if (!persister.supportsBinary) {
            return null
        }
        return persister.loadBlob(blobId, options)
    }

    async deleteBlob(namespace, blobId) {
        const persister = this.getPersister(namespace)
        if (!persister.supportsBinary) {
            return false
        }
        return persister.deleteBlob(blobId)
    }

    async listBlobs(namespace, options = {}) {
        const persister = this.getPersister(namespace)
        if (!persister.supportsBinary) {
            return []
        }
        return persister.listBlobs(options)
    }

    async exportNamespace(namespace) {
        const persister = this.getPersister(namespace)
        if (!persister.supportsExport) {
            throw new Error(`Namespace "${namespace}" does not support export`)
        }
        return persister.export()
    }

    async importNamespace(namespace, data, options = {}) {
        const persister = this.getPersister(namespace)
        if (!persister.supportsExport) {
            throw new Error(`Namespace "${namespace}" does not support import`)
        }
        return persister.import(data, options)
    }

    setDefaultPersisterType(type) {
        if (!type) {
            throw new Error('Invalid persister type: undefined')
        }
        this.defaultPersisterType = this._normalizeType(type)
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
