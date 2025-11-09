import { createExportAction, createImportAction } from './MenuActionsHelpers.svelte.js'

function notify(ideStore, title, message, type, source) {
  if (ideStore && typeof ideStore.addNotification === 'function') {
    ideStore.addNotification(title, message, type, source)
  }
}

function logStatus(ideStore, message, level = 'info', source = 'storage') {
  if (ideStore && typeof ideStore.addLog === 'function') {
    ideStore.addLog(message, level, source)
  }
}

/**
 * Enregistre un menu "Stockage" standard avec actions Export/Import.
 *
 * @param {Object} ideStoreInstance - Instance de ideStore
 * @param {string} toolId - Identifiant du propriétaire (utilisé comme ownerId)
 * @param {string} namespace - Namespace de persistance ciblé
 * @param {Object} [options]
 * @param {string} [options.menuId='storage'] - Identifiant du menu
 * @param {string} [options.menuLabel='Stockage'] - Libellé du menu
 * @param {number} [options.menuOrder=800] - Ordre d'affichage du menu
 * @param {string} [options.exportLabel='Exporter les données...'] - Libellé de l'action d'export
 * @param {string} [options.importLabel='Importer les données...'] - Libellé de l'action d'import
 * @param {string} [options.filename] - Nom de fichier personnalisé pour l'export
 * @param {Object} [options.bundle] - Configuration bundle (JSON + blobs)
 * @param {Object} [options.exportActionOptions] - Options supplémentaires pour createExportAction
 * @param {Object} [options.importActionOptions] - Options supplémentaires pour createImportAction
 * @returns {{menuId: string, exportItemId: string|null, importItemId: string|null}|null}
 */
export function registerStorageMenu(
  ideStoreInstance,
  toolId,
  namespace,
  options = {}
) {
  if (!ideStoreInstance || typeof ideStoreInstance.registerMenu !== 'function') {
    console.warn('registerStorageMenu: ideStore invalide')
    return null
  }
  if (!toolId) {
    console.warn('registerStorageMenu: toolId requis')
    return null
  }
  if (!namespace) {
    console.warn('registerStorageMenu: namespace requis')
    return null
  }

  const {
    menuId = 'storage',
    menuLabel = 'Stockage',
    menuOrder = 800,
    exportLabel = 'Exporter les données...',
    importLabel = 'Importer les données...',
    filename,
    bundle = null,
    exportActionOptions = {},
    importActionOptions = {}
  } = options

  ideStoreInstance.registerMenu(
    { id: menuId, label: menuLabel, order: menuOrder },
    toolId
  )

  const mergedExportOptions = {
    ...exportActionOptions,
    filename: exportActionOptions.filename ?? filename,
    bundle: exportActionOptions.bundle ?? bundle,
    onSuccess: (payload) => {
      notify(
        ideStoreInstance,
        'Export réussi',
        `Les données de ${toolId} ont été exportées`,
        'success',
        toolId
      )
      logStatus(
        ideStoreInstance,
        `Export du stockage "${toolId}" terminé : ${payload?.filename ?? 'fichier inconnu'}`,
        'info',
        toolId
      )
      exportActionOptions.onSuccess?.(payload)
    },
    onError: (error) => {
      notify(
        ideStoreInstance,
        'Erreur d\'export',
        error?.message || 'Impossible d\'exporter les données',
        'error',
        toolId
      )
      logStatus(
        ideStoreInstance,
        `Export du stockage "${toolId}" a échoué : ${error?.message || 'Erreur inconnue'}`,
        'error',
        toolId
      )
      exportActionOptions.onError?.(error)
    }
  }

  const normalizedImportMode = importActionOptions.mode === 'merge' ? 'merge' : 'replace'
  const shouldConfirmReplace = importActionOptions.confirmReplace ?? true

  const mergedImportOptions = {
    ...importActionOptions,
    mode: normalizedImportMode,
    confirmReplace: shouldConfirmReplace,
    bundle: importActionOptions.bundle ?? bundle,
    onSuccess: (payload) => {
      notify(
        ideStoreInstance,
        'Import réussi',
        `Les données de ${toolId} ont été importées`,
        'success',
        toolId
      )
      logStatus(
        ideStoreInstance,
        `Import du stockage "${toolId}" terminé : ${payload?.filename ?? 'fichier inconnu'}`,
        'info',
        toolId
      )
      importActionOptions.onSuccess?.(payload)
    },
    onError: (error) => {
      notify(
        ideStoreInstance,
        'Erreur d\'import',
        error?.message || 'Impossible d\'importer les données',
        'error',
        toolId
      )
      logStatus(
        ideStoreInstance,
        `Import du stockage "${toolId}" a échoué : ${error?.message || 'Erreur inconnue'}`,
        'error',
        toolId
      )
      importActionOptions.onError?.(error)
    }
  }

  const exportItem = ideStoreInstance.registerMenuItem(
    menuId,
    {
      id: `${toolId}-export`,
      label: exportLabel,
      order: 10,
      action: createExportAction(namespace, mergedExportOptions)
    },
    toolId
  )

  const importItem = ideStoreInstance.registerMenuItem(
    menuId,
    {
      id: `${toolId}-import`,
      label: importLabel,
      order: 20,
      action: createImportAction(namespace, mergedImportOptions)
    },
    toolId
  )

  return {
    menuId,
    exportItemId: exportItem?.id ?? null,
    importItemId: importItem?.id ?? null
  }
}
