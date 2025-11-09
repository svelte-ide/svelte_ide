import { binaryStorageService } from '@/core/persistence/BinaryStorageService.svelte.js'
import { PersisterInterface } from '@/core/persistence/PersisterInterface.js'

export class BinaryPersister extends PersisterInterface {
  constructor(namespace, options = {}) {
    super(namespace)
    this.tenantId = options.tenantId || 'default'
  }

  get supportsBinary() {
    return true
  }

  get supportsExport() {
    return true
  }

  async save(key) {
    throw new Error(`BinaryPersister: Use saveBlob() instead of save("${key ?? ''}")`)
  }

  async load(blobId, defaultValue = null) {
    if (!blobId) {
      return defaultValue
    }
    const metadata = await this.listBlobs()
    return metadata.find(entry => entry.blobId === blobId) || defaultValue
  }

  async remove(blobId) {
    if (!blobId) {
      return false
    }
    return this.deleteBlob(blobId)
  }

  async clear() {
    return binaryStorageService.clearNamespace(this.namespace, {
      tenantId: this.tenantId
    })
  }

  async exists(blobId) {
    if (!blobId) {
      return false
    }
    const metadata = await this.load(blobId)
    return Boolean(metadata)
  }

  async saveBlob(blobId, data, metadata = {}) {
    if (!blobId) {
      throw new Error('BinaryPersister: blobId is required for saveBlob()')
    }
    return binaryStorageService.saveBlob(this.namespace, blobId, data, {
      tenantId: this.tenantId,
      metadata
    })
  }

  async loadBlob(blobId, options = {}) {
    if (!blobId) {
      return null
    }
    return binaryStorageService.loadBlob(this.namespace, blobId, {
      tenantId: this.tenantId,
      ...options
    })
  }

  async deleteBlob(blobId) {
    if (!blobId) {
      return false
    }
    return binaryStorageService.deleteBlob(this.namespace, blobId, {
      tenantId: this.tenantId
    })
  }

  async listBlobs(options = {}) {
    return binaryStorageService.listBlobs(this.namespace, {
      tenantId: this.tenantId,
      ...options
    })
  }

  async export() {
    return binaryStorageService.exportStore(this.namespace, {
      tenantId: this.tenantId
    })
  }

  async import(zipBlob, options = {}) {
    return binaryStorageService.importStore(this.namespace, zipBlob, {
      tenantId: this.tenantId,
      mode: options.mode || 'merge',
      preserveTimestamps: options.preserveTimestamps !== false
    })
  }
}
