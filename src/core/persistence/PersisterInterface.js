/**
 * Interface de base pour tous les persisters de l'application.
 * Définit le contrat commun pour la persistance de données (JSON et binaire).
 * 
 * @class PersisterInterface
 * @abstract
 * 
 * @property {string} namespace - Namespace du persister (ex: 'myTool', 'documents')
 * @property {boolean} supportsBinary - Indique si le persister supporte le stockage de blobs
 * @property {boolean} supportsExport - Indique si le persister supporte l'export/import
 * 
 * @example
 * // Créer un persister personnalisé
 * class CustomPersister extends PersisterInterface {
 *   constructor(namespace) {
 *     super(namespace)
 *   }
 * 
 *   get supportsBinary() { return true }
 *   get supportsExport() { return true }
 * 
 *   async save(key, data) { ... }
 *   async load(key, defaultValue) { ... }
 * }
 */
export class PersisterInterface {
    constructor(namespace) {
        if (!namespace || typeof namespace !== 'string') {
            throw new Error('PersisterInterface requires a namespace string')
        }
        this.namespace = namespace
    }

    async save(key, data) {
        throw new Error(`${this.constructor.name}.save() must be implemented`)
    }

    async load(key, defaultValue = null) {
        throw new Error(`${this.constructor.name}.load() must be implemented`)
    }

    async remove(key) {
        throw new Error(`${this.constructor.name}.remove() must be implemented`)
    }

    async clear() {
        throw new Error(`${this.constructor.name}.clear() must be implemented`)
    }

    async exists(key) {
        throw new Error(`${this.constructor.name}.exists() must be implemented`)
    }

    get supportsBinary() {
        return false
    }

    async saveBlob(blobId, data, metadata = {}) {
        if (!this.supportsBinary) {
            throw new Error(`${this.constructor.name} does not support binary storage`)
        }
    }

    async loadBlob(blobId, options = {}) {
        if (!this.supportsBinary) {
            return null
        }
    }

    async deleteBlob(blobId) {
        if (!this.supportsBinary) {
            return false
        }
    }

    async listBlobs(options = {}) {
        if (!this.supportsBinary) {
            return []
        }
    }

    get supportsExport() {
        return false
    }

    async export() {
        if (!this.supportsExport) {
            return null
        }
    }

    async import(data, options = {}) {
        if (!this.supportsExport) {
            return { importedCount: 0 }
        }
    }

    getFullKey(key) {
        return `${this.namespace}-${key}`
    }
}

/**
 * Persister utilisant localStorage pour la persistance.
 * Quota limité (~5-10 MB), pas de chiffrement, données non volatiles.
 * 
 * @class LocalStoragePersister
 * @extends PersisterInterface
 * 
 * @example
 * const persister = new LocalStoragePersister('myTool')
 * await persister.save('config', { theme: 'dark' })
 * const config = await persister.load('config', { theme: 'light' })
 */
export class LocalStoragePersister extends PersisterInterface {
    constructor(namespace) {
        super(namespace)
    }

    get supportsBinary() {
        return false
    }

    get supportsExport() {
        return false
    }

    save(key, data) {
        try {
            const fullKey = this.getFullKey(key)
            const serialized = JSON.stringify(data)
            localStorage.setItem(fullKey, serialized)
            return true
        } catch (error) {
            console.error(`LocalStoragePersister: Failed to save "${key}"`, error)
            return false
        }
    }

    load(key, defaultValue = null) {
        try {
            const fullKey = this.getFullKey(key)
            const serialized = localStorage.getItem(fullKey)
            if (serialized === null) {
                return defaultValue
            }
            return JSON.parse(serialized)
        } catch (error) {
            console.error(`LocalStoragePersister: Failed to load "${key}"`, error)
            return defaultValue
        }
    }

    remove(key) {
        try {
            const fullKey = this.getFullKey(key)
            localStorage.removeItem(fullKey)
            return true
        } catch (error) {
            console.error(`LocalStoragePersister: Failed to remove "${key}"`, error)
            return false
        }
    }

    clear() {
        try {
            const keys = []
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i)
                if (key && key.startsWith(`${this.namespace}-`)) {
                    keys.push(key)
                }
            }
            keys.forEach(key => localStorage.removeItem(key))
            return true
        } catch (error) {
            console.error(`LocalStoragePersister: Failed to clear namespace "${this.namespace}"`, error)
            return false
        }
    }

    exists(key) {
        const fullKey = this.getFullKey(key)
        return localStorage.getItem(fullKey) !== null
    }
}

/**
 * Persister en mémoire (RAM) pour persistance volatile.
 * Données perdues au rechargement de la page. Idéal pour tests et cache.
 * 
 * @class MemoryPersister
 * @extends PersisterInterface
 * 
 * @example
 * const persister = new MemoryPersister('cache')
 * await persister.save('temp', { data: 'volatile' })
 */
export class MemoryPersister extends PersisterInterface {
    constructor(namespace) {
        super(namespace)
        this.storage = new Map()
    }

    get supportsBinary() {
        return false
    }

    get supportsExport() {
        return false
    }

    save(key, data) {
        try {
            const fullKey = this.getFullKey(key)
            this.storage.set(fullKey, JSON.parse(JSON.stringify(data)))
            return true
        } catch (error) {
            console.error(`MemoryPersister: Failed to save "${key}"`, error)
            return false
        }
    }

    load(key, defaultValue = null) {
        const fullKey = this.getFullKey(key)
        if (!this.storage.has(fullKey)) {
            return defaultValue
        }
        try {
            const data = this.storage.get(fullKey)
            return JSON.parse(JSON.stringify(data))
        } catch (error) {
            console.error(`MemoryPersister: Failed to load "${key}"`, error)
            return defaultValue
        }
    }

    remove(key) {
        const fullKey = this.getFullKey(key)
        return this.storage.delete(fullKey)
    }

    clear() {
        const keysToDelete = []
        for (const key of this.storage.keys()) {
            if (key.startsWith(`${this.namespace}-`)) {
                keysToDelete.push(key)
            }
        }
        keysToDelete.forEach(key => this.storage.delete(key))
        return true
    }

    exists(key) {
        const fullKey = this.getFullKey(key)
        return this.storage.has(fullKey)
    }
}

/**
 * Persister simplifié pour StateProvider avec callbacks personnalisés.
 * Utilisé pour l'export/import de stores complexes.
 * 
 * @class SimplePersister
 * @extends PersisterInterface
 * 
 * @param {string} namespace - Namespace du persister
 * @param {Function} exportFn - Fonction async retournant les données à exporter
 * @param {Function} importFn - Fonction async recevant les données à importer
 * @param {Object} [defaults={}] - Valeurs par défaut
 * 
 * @example
 * const persister = new SimplePersister(
 *   'myStore',
 *   async () => ({ tabs: myStore.tabs }),
 *   async (data) => { myStore.tabs = data.tabs },
 *   { tabs: [] }
 * )
 */
export class SimplePersister extends PersisterInterface {
    constructor(namespace, exportFn, importFn, defaults = {}) {
        super(namespace || 'simple-persister')
        this.exportFn = exportFn
        this.importFn = importFn
        this.defaults = defaults
    }

    get supportsExport() {
        return true
    }

    async export() {
        if (typeof this.exportFn === 'function') {
            return await this.exportFn()
        }
        return this.getDefaults()
    }

    async import(data, options = {}) {
        const sanitizedData = this.sanitize(data)
        if (typeof this.importFn === 'function') {
            await this.importFn(sanitizedData, options)
        }
    }

    getDefaults() {
        return { ...this.defaults }
    }

    validate(data) {
        if (!data || typeof data !== 'object') {
            return false
        }
        return true
    }

    sanitize(data) {
        if (!this.validate(data)) {
            return this.getDefaults()
        }
        return data
    }
}
