import { Tool, eventBus, getAuthStore, indexedDBService } from 'svelte-ide'
import DocumentLibraryPanel from './DocumentLibraryPanel.svelte'
import './DocumentLibraryRestorationService.svelte.js'
import { TOOL_ICON, TOOL_ID, TOOL_NAME } from './constants.js'
import { documentPersistenceService } from './documentPersistenceService.js'

const READY_TIMEOUT_MS = 10000

class DocumentLibraryTool extends Tool {
  constructor() {
    super(TOOL_NAME, TOOL_ICON, 'topLeft', TOOL_ID)
  }

  initialize() {
    this.setComponent(DocumentLibraryPanel)
  }
}

let bootstrapPromise = null
let bootstrapCompleted = false

function waitForEncryptedPersistence() {
  const authStore = getAuthStore()
  if (authStore.isAuthenticated && authStore.hasEncryptionKey) {
    return Promise.resolve()
  }

  return new Promise(resolve => {
    const unsubscribe = eventBus.subscribe('persistence:ready', payload => {
      if (payload?.encrypted) {
        unsubscribe()
        resolve()
      }
    })
  })
}

async function ensureSecurePersistence() {
  await waitForEncryptedPersistence()
  await indexedDBService.readyForEncryption({ timeoutMs: READY_TIMEOUT_MS })
}

async function bootstrapDocumentLibrary() {
  if (bootstrapCompleted) {
    return
  }
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureSecurePersistence()
      await documentPersistenceService.prepare()
      bootstrapCompleted = true
    })()
  }
  await bootstrapPromise
}

export default {
  async register(toolManager) {
    await bootstrapDocumentLibrary()
    const tool = new DocumentLibraryTool()
    toolManager.registerTool(tool)
  }
}
