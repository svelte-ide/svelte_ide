import { MODAL_CANCELLED_BY_X, modalService } from '@/core/ModalService.svelte.js'
import { persistenceRegistry } from '@/core/persistence/PersistenceRegistry.svelte.js'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

const DEFAULT_FILE_ACCEPT = '.json,.zip'
const FILE_PICKER_CANCELLED = 'FILE_PICKER_CANCELLED'
const DEFAULT_BUNDLE_MANIFEST_PATH = '__bundle__/manifest.json'
const BUNDLE_FORMAT = 'svelte-ide-bundle'

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`
}

function sanitizeFilename(filename, fallback) {
  if (typeof filename === 'string') {
    const trimmed = filename.trim()
    if (trimmed) {
      return trimmed
    }
  }
  return fallback
}

function ensureBlobPayload(data, mimeType = 'application/octet-stream') {
  if (data instanceof Blob) {
    return data
  }
  if (data instanceof ArrayBuffer) {
    return new Blob([data], { type: mimeType })
  }
  if (ArrayBuffer.isView(data)) {
    const view = data
    const slice = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
    return new Blob([slice], { type: mimeType })
  }
  if (typeof data === 'string') {
    return new Blob([data], { type: mimeType || 'text/plain' })
  }
  if (data === null || data === undefined) {
    throw new Error('Aucune donnée à exporter')
  }
  const serialized = JSON.stringify(data, null, 2)
  return new Blob([serialized], { type: mimeType || 'application/json' })
}

function sanitizeZipPath(path, fallback = 'data.json') {
  if (typeof path !== 'string') {
    return fallback
  }
  let normalized = path.trim().replace(/\\/g, '/')
  normalized = normalized.replace(/\/{2,}/g, '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  const safeSegments = []
  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      continue
    }
    safeSegments.push(segment)
  }
  const safePath = safeSegments.join('/')
  return safePath || fallback
}

function sanitizeZipDirectory(path, fallback = 'files/') {
  const sanitized = sanitizeZipPath(path, fallback)
  return sanitized.endsWith('/') ? sanitized : `${sanitized}/`
}

function uniqueZipFilename(filename, usedNames) {
  const fallback = 'file.bin'
  const sanitized = sanitizeZipPath(filename, fallback)
  const base = sanitized.split('/').pop() || fallback
  let candidate = base
  let counter = 1
  while (usedNames.has(candidate)) {
    const dotIndex = base.lastIndexOf('.')
    const stem = dotIndex !== -1 ? base.slice(0, dotIndex) : base
    const ext = dotIndex !== -1 ? base.slice(dotIndex) : ''
    candidate = `${stem}_${counter}${ext}`
    counter += 1
  }
  usedNames.add(candidate)
  return candidate
}

async function toUint8Array(input) {
  if (input instanceof Uint8Array) {
    return input
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength))
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }
  if (input instanceof Blob) {
    const buffer = await input.arrayBuffer()
    return new Uint8Array(buffer)
  }
  if (typeof input === 'string') {
    return strToU8(input)
  }
  throw new Error('Format d\'archive non supporté')
}

async function clearBlobNamespace(namespace) {
  if (!namespace) {
    return
  }
  let existing = []
  try {
    existing = await persistenceRegistry.listBlobs(namespace)
  } catch (error) {
    console.warn(`Impossible de lister les blobs pour "${namespace}"`, error)
    return
  }
  if (!Array.isArray(existing) || existing.length === 0) {
    return
  }
  await Promise.all(
    existing.map((blob) => {
      if (!blob?.blobId) {
        return Promise.resolve()
      }
      return persistenceRegistry.deleteBlob(namespace, blob.blobId)
    })
  )
}

function normalizeBundleDefinition(bundle, defaultNamespace) {
  const entriesSource = Array.isArray(bundle?.entries) ? [...bundle.entries] : []
  const includeDefault = bundle?.includeDefaultNamespace !== false
  if (includeDefault && defaultNamespace) {
    const hasDefault = entriesSource.some(
      (entry) => (entry?.type ?? 'json') === 'json' && entry?.namespace === defaultNamespace
    )
    if (!hasDefault) {
      entriesSource.unshift({ namespace: defaultNamespace, type: 'json' })
    }
  }

  const entries = []
  for (const rawEntry of entriesSource) {
    const namespace = typeof rawEntry?.namespace === 'string' ? rawEntry.namespace.trim() : defaultNamespace
    if (!namespace) {
      continue
    }
    const type = rawEntry?.type === 'blob' ? 'blob' : 'json'
    if (type === 'json') {
      const path = sanitizeZipPath(rawEntry?.path, `data/${namespace}.json`)
      entries.push({ type, namespace, path })
    } else {
      const basePath = sanitizeZipDirectory(rawEntry?.basePath || `files/${namespace}/`)
      entries.push({ type, namespace, basePath })
    }
  }

  if (entries.length === 0 && defaultNamespace) {
    entries.push({ type: 'json', namespace: defaultNamespace, path: `data/${defaultNamespace}.json` })
  }

  const manifestPath = sanitizeZipPath(bundle?.manifestPath, DEFAULT_BUNDLE_MANIFEST_PATH)
  return { entries, manifestPath }
}

async function exportBundle(bundle, defaultNamespace) {
  const { entries, manifestPath } = normalizeBundleDefinition(bundle, defaultNamespace)
  if (!entries.length) {
    throw new Error('exportBundle: aucun namespace défini')
  }

  const files = {}
  const manifest = {
    format: BUNDLE_FORMAT,
    version: 1,
    createdAt: new Date().toISOString(),
    entries: []
  }

  const filenameUsage = new Map()

  for (const entry of entries) {
    if (entry.type === 'json') {
      const data = await persistenceRegistry.exportNamespace(entry.namespace)
      if (!data) {
        continue
      }
      files[entry.path] = strToU8(JSON.stringify(data, null, 2))
      manifest.entries.push({
        type: 'json',
        namespace: entry.namespace,
        path: entry.path
      })
      continue
    }

    let metadataList = []
    try {
      metadataList = await persistenceRegistry.listBlobs(entry.namespace)
    } catch (error) {
      console.warn(`exportBundle: impossible de lister les blobs pour "${entry.namespace}"`, error)
      metadataList = []
    }

    const fileRefs = []
    const usedNames = filenameUsage.get(entry.basePath) || new Set()
    filenameUsage.set(entry.basePath, usedNames)

    for (const metadata of metadataList) {
      const blobId = metadata?.blobId
      if (!blobId) {
        continue
      }
      let blobRecord = null
      try {
        blobRecord = await persistenceRegistry.loadBlob(entry.namespace, blobId, { as: 'arrayBuffer' })
      } catch (error) {
        console.warn(`exportBundle: impossible de charger le blob "${blobId}"`, error)
        continue
      }
      if (!blobRecord || !blobRecord.data) {
        continue
      }
      const safeName = uniqueZipFilename(metadata.filename || blobRecord.filename || `${blobId}.bin`, usedNames)
      const filePath = `${entry.basePath}${safeName}`
      files[filePath] = new Uint8Array(blobRecord.data)
      fileRefs.push({
        blobId,
        path: filePath,
        filename: metadata.filename || blobRecord.filename || safeName,
        mimeType: metadata.mimeType || blobRecord.mimeType || 'application/octet-stream',
        size: metadata.size ?? blobRecord.size ?? blobRecord.data.byteLength ?? 0,
        metadata: {
          tags: metadata.tags ?? blobRecord.tags ?? null,
          custom: metadata.custom ?? blobRecord.custom ?? null,
          createdAt: metadata.createdAt ?? blobRecord.createdAt ?? null,
          updatedAt: metadata.updatedAt ?? blobRecord.updatedAt ?? null
        }
      })
    }

    manifest.entries.push({
      type: 'blob',
      namespace: entry.namespace,
      basePath: entry.basePath,
      files: fileRefs
    })
  }

  files[manifestPath] = strToU8(JSON.stringify(manifest, null, 2))
  const archive = zipSync(files, { level: typeof bundle?.compressionLevel === 'number' ? bundle.compressionLevel : 6 })
  return new Blob([archive], { type: 'application/zip' })
}

async function importBundle(bundle, archiveInput, { mode = 'replace', defaultNamespace = null } = {}) {
  const normalizedMode = mode === 'merge' ? 'merge' : 'replace'
  const { manifestPath } = normalizeBundleDefinition(bundle, defaultNamespace)
  const archiveBytes = await toUint8Array(archiveInput)
  const extracted = unzipSync(archiveBytes)
  const manifestRaw = extracted[manifestPath]
  if (!manifestRaw) {
    throw new Error('Archive invalide : manifest manquant')
  }

  let manifest
  try {
    manifest = JSON.parse(strFromU8(manifestRaw))
  } catch (error) {
    throw new Error('Archive invalide : manifest illisible')
  }

  const manifestEntries = Array.isArray(manifest?.entries) ? manifest.entries : []

  for (const entry of manifestEntries) {
    if (entry.type === 'json') {
      const payloadBytes = extracted[entry.path]
      if (!payloadBytes) {
        console.warn('importBundle: fichier JSON manquant', entry.path)
        continue
      }
      const payload = JSON.parse(strFromU8(payloadBytes))
      await persistenceRegistry.importNamespace(entry.namespace, payload, { mode: normalizedMode })
      continue
    }

    if (entry.type === 'blob') {
      if (normalizedMode === 'replace') {
        await clearBlobNamespace(entry.namespace)
      }
      const files = Array.isArray(entry.files) ? entry.files : []
      for (const fileRef of files) {
        const fileData = extracted[fileRef.path]
        if (!fileData) {
          console.warn('importBundle: fichier blob manquant', fileRef.path)
          continue
        }
        const blob = new Blob([fileData], { type: fileRef.mimeType || 'application/octet-stream' })
        const metadataOptions = {
          filename: fileRef.filename,
          mimeType: fileRef.mimeType,
          tags: fileRef.metadata?.tags,
          custom: fileRef.metadata?.custom,
          createdAt: fileRef.metadata?.createdAt,
          updatedAt: fileRef.metadata?.updatedAt
        }
        await persistenceRegistry.saveBlob(entry.namespace, fileRef.blobId, blob, metadataOptions)
      }
    }
  }
}

function triggerDownload(blob, filename) {
  if (typeof document === 'undefined') {
    throw new Error('Téléchargement impossible dans cet environnement')
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    anchor.remove()
  }, 0)
}

/**
 * Déclenche le téléchargement d'un fichier.
 *
 * @param {Blob|string|Object|ArrayBuffer} data - Données à télécharger
 * @param {string} filename - Nom de fichier
 * @param {string} [mimeType='application/octet-stream'] - Type MIME
 */
export function downloadFile(data, filename, mimeType = 'application/octet-stream') {
  const safeName = sanitizeFilename(filename, `export-${Date.now()}.bin`)
  const blob = ensureBlobPayload(data, mimeType)
  triggerDownload(blob, safeName)
}

/**
 * Ouvre un sélecteur de fichiers et retourne le fichier sélectionné.
 *
 * @param {string} [accept='.json,.zip'] - Formats acceptés
 * @returns {Promise<{file: File, data: string|ArrayBuffer}>}
 */
export function pickFile(accept = DEFAULT_FILE_ACCEPT) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      reject(new Error('Sélecteur de fichiers indisponible'))
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    if (typeof accept === 'string') {
      input.accept = accept
    }
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    let settled = false

    const cleanup = () => {
      input.value = ''
      input.remove()
    }

    const handleCancel = () => {
      if (settled) {
        return
      }
      settled = true
      window.removeEventListener('focus', focusHandler)
      cleanup()
      const cancelError = new Error('Aucun fichier sélectionné')
      cancelError.code = FILE_PICKER_CANCELLED
      reject(cancelError)
    }

    let cancelTimer = null

    const focusHandler = () => {
      window.removeEventListener('focus', focusHandler)
      cancelTimer = window.setTimeout(() => {
        if (settled) {
          return
        }
        const hasSelection = input.files && input.files.length > 0
        if (!hasSelection) {
          handleCancel()
        }
      }, 150)
    }

    window.addEventListener('focus', focusHandler)

    input.addEventListener('change', () => {
      if (cancelTimer) {
        clearTimeout(cancelTimer)
      }
      const file = input.files && input.files[0]
      if (!file) {
        return handleCancel()
      }

      settled = true
      window.removeEventListener('focus', focusHandler)
      cleanup()

      const reader = new FileReader()
      reader.onerror = () => {
        reject(new Error('Erreur de lecture du fichier'))
      }
      reader.onload = () => {
        resolve({ file, data: reader.result })
      }

      if (file.name.toLowerCase().endsWith('.zip')) {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsText(file)
      }
    })

    document.body.appendChild(input)
    input.click()
  })
}

function resolveConfirmActionId(result) {
  if (typeof result === 'string') {
    return result
  }
  if (result && typeof result === 'object') {
    return result.actionId || result.id || null
  }
  return null
}

function buildDefaultFilename(namespace, extension) {
  const timestamp = formatTimestamp()
  return `${namespace}-${timestamp}.${extension}`
}

function parseJsonPayload(rawData) {
  if (typeof rawData === 'string') {
    return JSON.parse(rawData)
  }
  if (rawData instanceof ArrayBuffer) {
    const decoder = new TextDecoder('utf-8')
    return JSON.parse(decoder.decode(rawData))
  }
  if (ArrayBuffer.isView(rawData)) {
    const decoder = new TextDecoder('utf-8')
    return JSON.parse(decoder.decode(rawData))
  }
  if (typeof rawData === 'object') {
    return rawData
  }
  throw new Error('Format de fichier non supporté')
}

function normalizeMode(mode) {
  return mode === 'merge' ? 'merge' : 'replace'
}

/**
 * Crée une action de menu permettant d'exporter un namespace.
 *
 * @param {string} namespace - Namespace à exporter
 * @param {Object} [options]
 * @param {string} [options.filename] - Nom de fichier personnalisé
 * @param {Function} [options.onSuccess] - Callback appelé après succès
 * @param {Function} [options.onError] - Callback appelé en cas d'échec
 * @returns {Function} Action compatible avec MainMenuService
 */
export function createExportAction(namespace, options = {}) {
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('createExportAction: namespace manquant')
  }

  const { filename, onSuccess, onError, bundle = null } = options

  return async () => {
    try {
      const useBundle = !!bundle
      const data = useBundle
        ? await exportBundle(bundle, namespace)
        : await persistenceRegistry.exportNamespace(namespace)

      if (!data) {
        throw new Error('Aucune donnée à exporter')
      }

      const isBlob = data instanceof Blob
      const extension = useBundle ? 'zip' : isBlob ? 'zip' : 'json'
      const mimeType = useBundle ? 'application/zip' : isBlob ? data.type || 'application/zip' : 'application/json'
      const resolvedFilename = sanitizeFilename(
        filename,
        buildDefaultFilename(namespace, extension)
      )

      downloadFile(data, resolvedFilename, mimeType)
      onSuccess?.({ filename: resolvedFilename, data })
    } catch (error) {
      console.error('createExportAction: export échoué', error)
      onError?.(error)
    }
  }
}

/**
 * Crée une action de menu permettant d'importer un namespace.
 *
 * @param {string} namespace - Namespace à importer
 * @param {Object} [options]
 * @param {'merge'|'replace'} [options.mode='replace'] - Mode d'import
 * @param {boolean} [options.confirmReplace=true] - Confirmer si mode replace
 * @param {Function} [options.onSuccess] - Callback après succès
 * @param {Function} [options.onError] - Callback après échec
 * @returns {Function} Action compatible avec MainMenuService
 */
export function createImportAction(namespace, options = {}) {
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('createImportAction: namespace manquant')
  }

  const {
    mode = 'replace',
    confirmReplace = true,
    onSuccess,
    onError,
    accept = DEFAULT_FILE_ACCEPT,
    bundle = null
  } = options

  return async () => {
    try {
      const normalizedMode = normalizeMode(mode)

      if (normalizedMode === 'replace' && confirmReplace) {
        const result = await modalService.confirm({
          icon: '📂',
          question: 'Importer de nouvelles données ?',
          description: 'Cette action remplacera les données existantes du namespace sélectionné.',
          buttons: [
            { id: 'confirm_import', label: 'Importer' },
            { id: 'cancel', label: 'Annuler' }
          ]
        })

        const actionId = resolveConfirmActionId(result)
        if (!actionId || actionId === MODAL_CANCELLED_BY_X || actionId === 'cancel') {
          return
        }

        if (actionId !== 'confirm_import') {
          return
        }
      }

      const fileAccept = bundle ? '.zip' : accept
      const { file, data } = await pickFile(fileAccept)
      if (!file) {
        return
      }

      const lowerName = file.name.toLowerCase()
      if (bundle) {
        await importBundle(bundle, data, { mode: normalizedMode, defaultNamespace: namespace })
      } else {
        const payload = lowerName.endsWith('.zip') ? data : parseJsonPayload(data)
        await persistenceRegistry.importNamespace(namespace, payload, { mode: normalizedMode })
      }

      onSuccess?.({ filename: file.name, mode: normalizedMode })
    } catch (error) {
      if (error?.code === FILE_PICKER_CANCELLED) {
        return
      }
      console.error('createImportAction: import échoué', error)
      onError?.(error)
    }
  }
}
