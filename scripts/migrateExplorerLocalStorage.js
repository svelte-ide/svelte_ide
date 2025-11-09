import { JsonPersister } from '@/core/persistence/JsonPersister.svelte.js'

/**
 * Script de migration localStorage -> IndexedDB pour les anciens environnements Explorer.
 * À exécuter depuis la console dev (module bundlé via Vite, accessible via import).
 */
async function migrateExplorerLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    console.warn('[ExplorerMigration] localStorage indisponible dans ce contexte.')
    return { migrated: 0, skipped: 0 }
  }

  const persister = new JsonPersister('tool-explorer', {
    storeName: 'tool-explorer'
  })

  const legacyPrefix = `${persister.namespace}-`
  const stats = { migrated: 0, skipped: 0 }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key || !key.startsWith(legacyPrefix)) {
      stats.skipped += 1
      continue
    }

    const plainKey = key.slice(legacyPrefix.length)
    try {
      const content = window.localStorage.getItem(key)
      const parsed = JSON.parse(content)
      await persister.save(plainKey, parsed)
      window.localStorage.removeItem(key)
      stats.migrated += 1
      console.info('[ExplorerMigration]', `Entrée "${key}" migrée vers IndexedDB.`)
    } catch (error) {
      console.warn('[ExplorerMigration]', `Impossible de migrer "${key}" :`, error)
    }
  }

  console.info('[ExplorerMigration]', 'Migration terminée', stats)
  return stats
}

export default migrateExplorerLocalStorage
