let documents = $state({})
let backendResponses = $state({})
let activeDocumentId = $state(null)
const changeHandlers = new Set()

function serializeDocument(doc) {
  if (!doc?.id) return null
  const { file, children, uploadedAt, ...rest } = doc
  const normalizedUploadedAt =
    uploadedAt instanceof Date ? uploadedAt.toISOString() : uploadedAt ?? null

  return {
    ...rest,
    id: doc.id,
    name: doc.name ?? rest.name ?? '',
    nodeType: doc.nodeType ?? rest.nodeType ?? 'document',
    parentId: doc.parentId ?? rest.parentId ?? null,
    type: doc.type ?? rest.type ?? null,
    size: doc.size ?? rest.size ?? null,
    uploadedAt: normalizedUploadedAt
  }
}

function notifyChange() {
  const snapshot = {
    documents,
    backendResponses,
    activeDocumentId
  }
  changeHandlers.forEach(handler => {
    try {
      handler(snapshot)
    } catch (error) {
      console.error('documentViewerStore: change handler failed', error)
    }
  })
}

export function setActiveDocument(doc, response = undefined) {
  if (!doc) {
    if (activeDocumentId !== null) {
      activeDocumentId = null
      notifyChange()
    }
    return
  }
  if (!doc.id) return

  const serialized = serializeDocument(doc)
  documents = {
    ...documents,
    [doc.id]: serialized ?? { id: doc.id }
  }

  const nextResponse =
    response === undefined ? backendResponses[doc.id] ?? null : response ?? null

  backendResponses = {
    ...backendResponses,
    [doc.id]: nextResponse
  }

  if (activeDocumentId !== doc.id) {
    activeDocumentId = doc.id
  }
  notifyChange()
}

export function setBackendResponse(documentId, response) {
  if (!documentId) return
  backendResponses = {
    ...backendResponses,
    [documentId]: response ?? null
  }
  notifyChange()
}

export function getActiveDocumentId() {
  return activeDocumentId
}

export function getActiveDocument() {
  if (!activeDocumentId) return null
  return documents[activeDocumentId] ?? null
}

export function getActiveBackendResponse() {
  if (!activeDocumentId) return null
  return backendResponses[activeDocumentId] ?? null
}

export function getDocumentById(documentId) {
  if (!documentId) return null
  return documents[documentId] ?? null
}

export function getBackendResponseById(documentId) {
  if (!documentId) return null
  return backendResponses[documentId] ?? null
}

export function getAllDocuments() {
  return { ...documents }
}

export function getAllBackendResponses() {
  return { ...backendResponses }
}

export function restoreAllDocuments(savedDocuments = {}, savedResponses = {}, savedActiveId = null) {
  const normalizedDocs = {}
  for (const [docId, docValue] of Object.entries(savedDocuments)) {
    const serialized = serializeDocument(docValue)
    if (serialized) {
      normalizedDocs[docId] = serialized
    }
  }
  documents = normalizedDocs
  backendResponses = { ...savedResponses }
  activeDocumentId = savedActiveId ?? null
  notifyChange()
}

export function removeDocument(documentId) {
  if (!documentId) return
  let changed = false

  if (documents[documentId]) {
    const nextDocs = { ...documents }
    delete nextDocs[documentId]
    documents = nextDocs
    changed = true
  }
  if (backendResponses[documentId]) {
    const nextResponses = { ...backendResponses }
    delete nextResponses[documentId]
    backendResponses = nextResponses
    changed = true
  }
  if (activeDocumentId === documentId) {
    activeDocumentId = null
    changed = true
  }

  if (changed) {
    notifyChange()
  }
}

export function clearAll() {
  documents = {}
  backendResponses = {}
  activeDocumentId = null
  notifyChange()
}

export function subscribeViewerStore(handler) {
  if (typeof handler !== 'function') return () => undefined
  changeHandlers.add(handler)
  return () => {
    changeHandlers.delete(handler)
  }
}
