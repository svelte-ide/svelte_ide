import { createExportAllAction, createImportAllAction } from './MenuActionsHelpers.svelte.js'

/**
 * Enregistre un menu "Sauvegarde" avec export/import exhaustif de tous les namespaces.
 * 
 * @param {Object} ideStoreInstance - Instance de ideStore
 * @param {Object} [options]
 * @param {string} [options.menuId='sauvegarde'] - Identifiant du menu
 * @param {string} [options.menuLabel='sauvegarde'] - Libellé du menu
 * @param {number} [options.menuOrder=850] - Ordre d'affichage du menu
 * @param {string} [options.exportLabel='Exporter toutes les données...'] - Libellé de l'action d'export
 * @param {string} [options.importLabel='Importer toutes les données...'] - Libellé de l'action d'import
 * @param {string} [options.ownerId='core-storage'] - Identifiant du propriétaire
 * @param {Object} [options.exportOptions] - Options supplémentaires pour createExportAllAction
 * @param {Object} [options.importOptions] - Options supplémentaires pour createImportAllAction
 * @returns {{menuId: string, exportItemId: string|null, importItemId: string|null}|null}
 * 
 * @example
 * // Dans main.js ou dans un tool
 * import { registerBackupMenu } from 'svelte-ide'
 * 
 * registerBackupMenu(ideStore, {
 *   menuLabel: 'Mes Données',
 *   ownerId: 'mon-app'
 * })
 */
export function registerBackupMenu(ideStoreInstance, options = {}) {
  if (!ideStoreInstance || typeof ideStoreInstance.registerMenu !== 'function') {
    console.warn('registerBackupMenu: ideStore invalide')
    return null
  }

  const {
    menuId = 'sauvegarde',
    menuLabel = 'sauvegarde',
    menuOrder = 850,
    exportLabel = 'Exporter toutes les données...',
    importLabel = 'Importer toutes les données...',
    ownerId = 'core-storage',
    exportOptions = {},
    importOptions = {}
  } = options

  // Enregistrer le menu
  ideStoreInstance.registerMenu(
    { id: menuId, label: menuLabel, order: menuOrder },
    ownerId
  )

  // Callbacks par défaut pour les notifications et logs
  const defaultExportCallbacks = {
    onSuccess: ({ filename, namespaces }) => {
      ideStoreInstance.addNotification?.(
        'Export réussi',
        `${namespaces.length} namespace(s) exportés dans ${filename}`,
        'success',
        ownerId
      )
      ideStoreInstance.addLog?.(
        `Export complet terminé : ${filename} (${namespaces.join(', ')})`,
        'info',
        ownerId
      )
    },
    onError: (error) => {
      ideStoreInstance.addNotification?.(
        'Erreur d\'export',
        error?.message || 'Impossible d\'exporter les données',
        'error',
        ownerId
      )
      ideStoreInstance.addLog?.(
        `Export complet échoué : ${error?.message || 'Erreur inconnue'}`,
        'error',
        ownerId
      )
    }
  }

  const defaultImportCallbacks = {
    onSuccess: ({ filename, namespaces }) => {
      ideStoreInstance.addNotification?.(
        'Import réussi',
        `${namespaces.length} namespace(s) restaurés depuis ${filename}`,
        'success',
        ownerId
      )
      ideStoreInstance.addLog?.(
        `Import complet terminé : ${filename} (${namespaces.join(', ')})`,
        'info',
        ownerId
      )
    },
    onError: (error) => {
      ideStoreInstance.addNotification?.(
        'Erreur d\'import',
        error?.message || 'Impossible d\'importer les données',
        'error',
        ownerId
      )
      ideStoreInstance.addLog?.(
        `Import complet échoué : ${error?.message || 'Erreur inconnue'}`,
        'error',
        ownerId
      )
    }
  }

  // Fusionner les options avec les callbacks par défaut
  const mergedExportOptions = {
    ...exportOptions,
    onSuccess: (payload) => {
      defaultExportCallbacks.onSuccess(payload)
      exportOptions.onSuccess?.(payload)
    },
    onError: (error) => {
      defaultExportCallbacks.onError(error)
      exportOptions.onError?.(error)
    }
  }

  const mergedImportOptions = {
    mode: 'replace',
    confirmReplace: true,
    ...importOptions,
    onSuccess: (payload) => {
      defaultImportCallbacks.onSuccess(payload)
      importOptions.onSuccess?.(payload)
    },
    onError: (error) => {
      defaultImportCallbacks.onError(error)
      importOptions.onError?.(error)
    }
  }

  // Enregistrer l'action d'export
  const exportItem = ideStoreInstance.registerMenuItem(
    menuId,
    {
      id: 'export-all-data',
      label: exportLabel,
      order: 10,
      action: createExportAllAction(mergedExportOptions)
    },
    ownerId
  )

  // Enregistrer l'action d'import
  const importItem = ideStoreInstance.registerMenuItem(
    menuId,
    {
      id: 'import-all-data',
      label: importLabel,
      order: 20,
      action: createImportAllAction(mergedImportOptions)
    },
    ownerId
  )

  return {
    menuId,
    exportItemId: exportItem?.id ?? null,
    importItemId: importItem?.id ?? null
  }
}
