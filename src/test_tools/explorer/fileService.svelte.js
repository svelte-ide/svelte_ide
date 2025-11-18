import { SCROLL_MODES } from '@svelte-ide/core/ScrollModes.svelte.js'
import { persistenceRegistry } from '@svelte-ide/core/persistence/PersistenceRegistry.svelte.js'
import { explorerStore } from './explorerStore.svelte.js'

const JSON_NAMESPACE = 'tool-explorer'
const FILES_KEY = 'files-index'
const BLOB_NAMESPACE = 'tool-explorer-blobs'
const BLOB_TENANT = 'demo'
const BLOB_SAMPLE_ID = 'explorer-sample-blob'
const BLOB_SAMPLE_FILE = 'blob-demo.txt'
const BLOB_SAMPLE_MIME = 'text/plain'
const BLOB_SAMPLE_CONTENT = [
  'Fichier stocké via BinaryPersister 👋',
  '',
  'Ce fichier est sauvegardé sous forme de blob,',
  'ce qui permet de tester les exports/imports binaires.',
  '',
  'Vous pouvez modifier ce texte puis enregistrer (fermez l’onglet et cliquez sur "Enregistrer").'
].join('\n')

const explorerPersister = persistenceRegistry.createPersister(JSON_NAMESPACE, 'json', {
  storeName: 'tool-explorer'
})

let binaryPersisterReady = false

function ensureBinaryPersister() {
  if (!binaryPersisterReady) {
    persistenceRegistry.createPersister(BLOB_NAMESPACE, 'binary', { tenantId: BLOB_TENANT })
    binaryPersisterReady = true
  }
}

ensureBinaryPersister()

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null

const SEED_FOLDERS = ['Documents', 'Images', 'Projets']

const SEED_FILES = [
  {
    name: 'demo1.txt',
    mimeType: 'text/plain',
    content: 'Contenu du fichier demo1.txt\nLigne 2\nLigne 3'
  },
  {
    name: 'demo2.md',
    mimeType: 'text/markdown',
    content: '# Fichier Markdown\n\nCeci est un **fichier markdown**.'
  },
  {
    name: 'demo3.js',
    mimeType: 'application/javascript',
    content: 'console.log("Hello from demo3.js");\nfunction test() {\n  return "test";\n}'
  },
  {
    name: 'test.html',
    mimeType: 'text/html',
    content: '<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body><h1>Hello World</h1></body>\n</html>'
  },
  {
    name: 'exemple.json',
    mimeType: 'application/json',
    content: '{\n  "name": "exemple",\n  "version": "1.0.0",\n  "description": "Un exemple de JSON"\n}'
  },
  {
    name: 'fichier.css',
    mimeType: 'text/css',
    content: 'body {\n  background-color: #1e1e1e;\n  color: #cccccc;\n  font-family: Arial, sans-serif;\n}'
  }
]

function encodeText(content = '') {
  if (textEncoder) {
    return textEncoder.encode(content)
  }
  const buffer = new Uint8Array(content.length)
  for (let i = 0; i < content.length; i += 1) {
    buffer[i] = content.charCodeAt(i) & 0xff
  }
  return buffer
}

function decodeText(data) {
  if (!data) {
    return ''
  }
  const view = data instanceof Uint8Array
    ? data
    : new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer)

  if (textDecoder) {
    return textDecoder.decode(view)
  }

  let result = ''
  for (let i = 0; i < view.length; i += 1) {
    result += String.fromCharCode(view[i])
  }
  return result
}

async function seedEntries() {
  const timestamp = new Date().toISOString()

  const folderEntries = SEED_FOLDERS.map((name) => ({
    id: `folder-${name.toLowerCase()}`,
    name,
    type: 'folder',
    createdAt: timestamp,
    updatedAt: timestamp
  }))

  const textFileEntries = SEED_FILES.map((file) => ({
    id: `file-${file.name}`,
    name: file.name,
    type: 'file',
    storage: 'json',
    mimeType: file.mimeType,
    content: file.content,
    size: file.content.length,
    createdAt: timestamp,
    updatedAt: timestamp
  }))

  const blobEntry = {
    id: `file-${BLOB_SAMPLE_FILE}`,
    name: BLOB_SAMPLE_FILE,
    type: 'file',
    storage: 'blob',
    blobId: BLOB_SAMPLE_ID,
    mimeType: BLOB_SAMPLE_MIME,
    encoding: 'utf-8',
    description: 'Fichier binaire de démonstration',
    size: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  const entries = [...folderEntries, ...textFileEntries, blobEntry]
  await explorerPersister.save(FILES_KEY, entries)
  await ensureSampleBlob(entries, blobEntry)
  await explorerPersister.save(FILES_KEY, entries)
  return entries
}

async function ensureSampleBlob(entries, blobEntry) {
  ensureBinaryPersister()
  try {
    const existing = await persistenceRegistry.loadBlob(BLOB_NAMESPACE, BLOB_SAMPLE_ID, { as: 'arrayBuffer' })
    if (existing) {
      const size = typeof existing.size === 'number'
        ? existing.size
        : existing.data?.byteLength ?? 0
      const target = blobEntry ?? entries.find((entry) => entry.blobId === BLOB_SAMPLE_ID)
      if (target) {
        target.size = size
        target.updatedAt = existing.updatedAt ?? target.updatedAt
      }
      return
    }
  } catch (error) {
    logger.warn('Explorer: lecture du blob de démonstration impossible, recréation', error)
  }

  const payload = encodeText(BLOB_SAMPLE_CONTENT)
  const blob = new Blob([payload], { type: BLOB_SAMPLE_MIME })
  await persistenceRegistry.saveBlob(BLOB_NAMESPACE, BLOB_SAMPLE_ID, blob, {
    filename: BLOB_SAMPLE_FILE,
    mimeType: BLOB_SAMPLE_MIME,
    description: 'Exemple de stockage BinaryPersister'
  })

  const target = blobEntry ?? entries.find((entry) => entry.blobId === BLOB_SAMPLE_ID)
  if (target) {
    target.size = blob.size
    target.updatedAt = new Date().toISOString()
  }
}

async function readEntries() {
  try {
    const stored = await explorerPersister.load(FILES_KEY, null)
    if (Array.isArray(stored) && stored.length > 0) {
      return stored
    }
  } catch (error) {
    logger.warn('Explorer: impossible de lire les fichiers persistés, re-génération', error)
  }
  return seedEntries()
}

function toPublicEntry(entry) {
  const { content, ...rest } = entry
  return { ...rest }
}

async function findFileEntry(fileName) {
  const entries = await readEntries()
  return entries.find((entry) => entry.type === 'file' && entry.name === fileName) ?? null
}

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()
  const iconMap = {
    txt: '📄',
    md: '📝',
    js: '📜',
    html: '🌐',
    json: '📋',
    css: '🎨'
  }
  return iconMap[ext] || '📄'
}

export async function getExplorerItems() {
  const entries = await readEntries()
  return entries.map(toPublicEntry)
}

export async function getFileList() {
  const entries = await getExplorerItems()
  return entries.filter((entry) => entry.type === 'file')
}

export async function getFileContent(fileName) {
  if (!fileName) {
    throw new Error('Nom de fichier manquant')
  }

  const entries = await readEntries()
  const entry = entries.find((candidate) => candidate.type === 'file' && candidate.name === fileName)
  if (!entry) {
    throw new Error(`Fichier "${fileName}" introuvable`)
  }

  if (entry.storage === 'blob') {
    ensureBinaryPersister()
    const blobRecord = await persistenceRegistry.loadBlob(BLOB_NAMESPACE, entry.blobId, { as: 'arrayBuffer' })
    if (!blobRecord) {
      throw new Error(`Blob "${entry.blobId}" introuvable pour ${fileName}`)
    }
    return decodeText(blobRecord.data)
  }

  return entry.content ?? ''
}

export async function saveFileContent(fileName, content = '') {
  const entries = await readEntries()
  const entry = entries.find((candidate) => candidate.type === 'file' && candidate.name === fileName)
  if (!entry) {
    throw new Error(`Fichier "${fileName}" introuvable`)
  }

  const now = new Date().toISOString()

  if (entry.storage === 'blob') {
    ensureBinaryPersister()
    const encoded = encodeText(content)
    const blob = new Blob([encoded], { type: entry.mimeType || 'text/plain' })
    await persistenceRegistry.saveBlob(BLOB_NAMESPACE, entry.blobId, blob, {
      filename: entry.name,
      mimeType: entry.mimeType || 'text/plain',
      description: entry.description
    })
    entry.size = blob.size
    entry.updatedAt = now
  } else {
    entry.content = content
    entry.size = content.length
    entry.updatedAt = now
  }

  await explorerPersister.save(FILES_KEY, entries)
  return entry
}

export async function openFileInIDE(fileName, ideStore, FileViewer, toolId = 'explorer') {
  const content = await getFileContent(fileName)

  explorerStore.setFileContent(fileName, content)
  explorerStore.setFileOriginalContent(fileName, content)

  const tab = ideStore.openFile({
    fileName,
    content,
    component: FileViewer,
    icon: getFileIcon(fileName),
    toolId,
    scrollMode: SCROLL_MODES.tool
  })

  tab.onSave = async () => {
    try {
      const latestContent = explorerStore.getFileContent(fileName) ?? content
      await saveFileContent(fileName, latestContent)
      explorerStore.setFileOriginalContent(fileName, latestContent)
      tab.originalContent = latestContent
      tab.content = latestContent
      ideStore.addNotification(
        'Fichier sauvegardé',
        `Les modifications de "${fileName}" ont été enregistrées.`,
        'success',
        toolId
      )
      return true
    } catch (error) {
      logger.error('Explorer: sauvegarde impossible', error)
      ideStore.addNotification(
        'Erreur de sauvegarde',
        error?.message || 'Impossible d\'enregistrer ce fichier.',
        'error',
        toolId
      )
      return false
    }
  }

  return tab
}
