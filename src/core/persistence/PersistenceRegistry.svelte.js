import { APP_KEY } from '@/core/config/appKey.js'
import { BinaryPersister } from '@/core/persistence/BinaryPersister.svelte.js'
import { JsonPersister } from '@/core/persistence/JsonPersister.svelte.js'
import { LocalStoragePersister, MemoryPersister } from '@/core/persistence/PersisterInterface.js'

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

/**
 * Registre centralisé pour la gestion des persisters de l'application.
 * Source unique de vérité pour les namespaces et la création de persisters.
 * 
 * @class PersistenceRegistry
 * 
 * @example
 * // Créer un persister JSON pour un namespace
 * const jsonPersister = persistenceRegistry.createPersister('myTool', 'json')
 * await jsonPersister.save('config', { theme: 'dark' })
 * 
 * @example
 * // Utiliser l'API directe pour les blobs
 * await persistenceRegistry.saveBlob('documents', 'file-1', pdfBlob, {
 *   filename: 'rapport.pdf',
 *   mimeType: 'application/pdf',
 *   tags: ['important', '2025']
 * })
 * const doc = await persistenceRegistry.loadBlob('documents', 'file-1')
 * 
 * @example
 * // Export/Import d'un namespace complet
 * const archive = await persistenceRegistry.exportNamespace('documents') // ZIP Blob
 * await persistenceRegistry.importNamespace('documents', archive, { mode: 'replace' })
 */
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

    /**
     * Enregistre manuellement un persister pour un namespace.
     * 
     * @param {string} namespace - Namespace du persister
     * @param {PersisterInterface} persister - Instance du persister
     * @returns {PersisterInterface} Le persister enregistré
     * @throws {Error} Si le namespace est vide ou le persister invalide
     */
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

    /**
     * Crée ou récupère un persister pour un namespace donné.
     * Si le persister existe déjà, le retourne. Sinon, en crée un nouveau.
     * 
     * @param {string} namespace - Namespace du persister
     * @param {'json'|'binary'|'localstorage'|'memory'} [type] - Type de persister (défaut: 'json')
     * @param {Object} [options] - Options de configuration du persister
     * @param {string} [options.tenantId] - ID du tenant (pour BinaryPersister uniquement)
     * @param {string} [options.storeName] - Nom du store IndexedDB (pour JsonPersister)
     * @param {'block'|'localstorage'|'memory'} [options.fallbackStrategy] - Stratégie de fallback si IndexedDB indisponible
     * @returns {PersisterInterface} Instance du persister
     * @throws {Error} Si le type est inconnu
     * 
     * @example
     * // Créer un persister JSON avec fallback localStorage
     * const persister = persistenceRegistry.createPersister('myTool', 'json', {
     *   fallbackStrategy: 'localstorage'
     * })
     * 
     * @example
     * // Créer un persister Binary multi-tenant
     * const persister = persistenceRegistry.createPersister('documents', 'binary', {
     *   tenantId: 'org-123'
     * })
     */
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

    /**
     * Récupère un persister existant ou en crée un par défaut.
     * 
     * @param {string} namespace - Namespace du persister
     * @returns {PersisterInterface} Instance du persister
     */
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

    /**
     * Retourne le type d'un namespace enregistré.
     * 
     * @param {string} namespace - Namespace à inspecter
     * @returns {'json'|'binary'|'localstorage'|'memory'|null} Type du persister ou null si inexistant
     */
    getNamespaceType(namespace) {
        const mapKey = this._getMapKey(namespace)
        const persister = this.persisters.get(mapKey)
        
        if (!persister) {
            return null
        }

        // Identifier le type par introspection du persister
        if (persister instanceof BinaryPersister) {
            return 'binary'
        }
        if (persister instanceof JsonPersister) {
            return 'json'
        }
        if (persister instanceof LocalStoragePersister) {
            return 'localstorage'
        }
        if (persister instanceof MemoryPersister) {
            return 'memory'
        }

        // Fallback : inspecter le constructor.name
        const constructorName = persister.constructor?.name
        if (constructorName === 'BinaryPersister') return 'binary'
        if (constructorName === 'JsonPersister') return 'json'
        if (constructorName === 'LocalStoragePersister') return 'localstorage'
        if (constructorName === 'MemoryPersister') return 'memory'

        return null
    }

    /**
     * Retourne tous les namespaces avec leurs métadonnées (type).
     * 
     * @returns {Array<{namespace: string, type: string}>} Liste des namespaces avec leurs types
     * 
     * @example
     * const namespaces = persistenceRegistry.getAllNamespacesWithMetadata()
     * // [
     * //   { namespace: 'user-layout', type: 'json' },
     * //   { namespace: 'documents', type: 'binary' }
     * // ]
     */
    getAllNamespacesWithMetadata() {
        const result = []
        
        for (const [mapKey, persister] of this.persisters.entries()) {
            // Extraire le namespace original (sans prefix)
            const namespace = this.namespacePrefix
                ? mapKey.replace(`${this.namespacePrefix}::`, '')
                : mapKey

            let type = null

            // Identifier le type par introspection
            if (persister instanceof BinaryPersister) {
                type = 'binary'
            } else if (persister instanceof JsonPersister) {
                type = 'json'
            } else if (persister instanceof LocalStoragePersister) {
                type = 'localstorage'
            } else if (persister instanceof MemoryPersister) {
                type = 'memory'
            } else {
                // Fallback : inspecter le constructor.name
                const constructorName = persister.constructor?.name
                if (constructorName === 'BinaryPersister') type = 'binary'
                else if (constructorName === 'JsonPersister') type = 'json'
                else if (constructorName === 'LocalStoragePersister') type = 'localstorage'
                else if (constructorName === 'MemoryPersister') type = 'memory'
            }

            if (type) {
                result.push({ namespace, type })
            }
        }

        return result
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

    /**
     * Sauvegarde un blob binaire dans le namespace.
     * Le namespace doit être de type 'binary' ou une erreur sera levée.
     * 
     * @param {string} namespace - Namespace où stocker le blob
     * @param {string} blobId - Identifiant unique du blob
     * @param {Blob|ArrayBuffer|TypedArray|string} data - Données à sauvegarder
     * @param {Object} [metadata] - Métadonnées du blob
     * @param {string} [metadata.filename] - Nom du fichier
     * @param {string} [metadata.mimeType] - Type MIME
     * @param {string[]} [metadata.tags] - Tags pour recherche
     * @param {Object} [metadata.custom] - Données custom JSON
     * @returns {Promise<Object>} Métadonnées du blob sauvegardé
     * @throws {Error} Si le namespace ne supporte pas les blobs
     * 
     * @example
     * await persistenceRegistry.saveBlob('documents', 'rapport-2025', pdfBlob, {
     *   filename: 'rapport-annuel.pdf',
     *   mimeType: 'application/pdf',
     *   tags: ['important', 'finance'],
     *   custom: { year: 2025, department: 'IT' }
     * })
     */
    async saveBlob(namespace, blobId, data, metadata = {}) {
        const persister = this.getPersister(namespace)
        if (!persister.supportsBinary) {
            throw new Error(`Namespace "${namespace}" does not support binary storage (use type: 'binary')`)
        }
        return persister.saveBlob(blobId, data, metadata)
    }

    /**
     * Charge un blob binaire depuis le namespace.
     * 
     * @param {string} namespace - Namespace contenant le blob
     * @param {string} blobId - Identifiant du blob
     * @param {Object} [options] - Options de chargement
     * @param {'blob'|'arrayBuffer'} [options.as='blob'] - Format de retour
     * @returns {Promise<Object|null>} Objet avec {data, ...metadata} ou null si inexistant
     */
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

    /**
     * Exporte un namespace complet (JSON ou ZIP selon le type).
     * 
     * @param {string} namespace - Namespace à exporter
     * @returns {Promise<Object|Blob>} Objet JSON (pour 'json') ou Blob ZIP (pour 'binary')
     * @throws {Error} Si le namespace ne supporte pas l'export
     * 
     * @example
     * // Export JSON
     * const jsonData = await persistenceRegistry.exportNamespace('myTool')
     * // Format: { format: 'svelte-ide-json-store', entries: [...] }
     * 
     * @example
     * // Export Binary (ZIP)
     * const zipBlob = await persistenceRegistry.exportNamespace('documents')
     * const url = URL.createObjectURL(zipBlob)
     * // Télécharger ou sauvegarder
     */
    async exportNamespace(namespace) {
        const persister = this.getPersister(namespace)
        if (!persister.supportsExport) {
            throw new Error(`Namespace "${namespace}" does not support export`)
        }
        return persister.export()
    }

    /**
     * Importe des données dans un namespace.
     * 
     * @param {string} namespace - Namespace cible
     * @param {Object|Blob} data - Données à importer (JSON ou ZIP)
     * @param {Object} [options] - Options d'import
     * @param {'merge'|'replace'} [options.mode='merge'] - Mode d'import
     * @param {boolean} [options.preserveTimestamps=true] - Préserver les timestamps (binary uniquement)
     * @returns {Promise<Object>} Résultat de l'import {importedCount, skippedCount, mode}
     * @throws {Error} Si le namespace ne supporte pas l'import
     */
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

/**
 * Instance singleton du registre de persistance.
 * Point d'entrée principal pour toute persistance de données dans l'application.
 * 
 * @type {PersistenceRegistry}
 * @example
 * import { persistenceRegistry } from 'svelte-ide'
 * 
 * // JSON storage
 * await persistenceRegistry.save('myTool', 'config', { theme: 'dark' })
 * 
 * // Binary storage
 * await persistenceRegistry.saveBlob('documents', 'file-1', pdfBlob)
 */
export const persistenceRegistry = new PersistenceRegistry()
