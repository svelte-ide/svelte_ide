# Améliorations Export/Import - svelte-ide

## Problème Actuel

Le système d'export/import du menu "Sauvegarde" de svelte-ide présente deux limitations :

### 1. Export Incomplet des Namespaces

**Symptôme** : Seuls certains namespaces sont exportés, pas tous les namespaces utilisés par l'application.

**Impact** : Dans BNR-CVD, les documents uploadés (namespace `'documents'` avec BinaryPersister) ne sont **pas exportés** par le menu Sauvegarde. Seuls les namespaces "système" (user-layout, etc.) sont inclus.

**Cause** : Le menu Sauvegarde ne connaît pas les namespaces métier créés par les tools de l'application.

### 2. Nom de Fichier Hardcodé

**Symptôme** : Le fichier exporté s'appelle toujours `svelte-ide-backup.zip` ou similaire.

**Impact** : Tous les projets utilisant svelte-ide ont le même nom de fichier d'export, ce qui crée de la confusion lors de sauvegardes multiples.

**Besoin** : Le nom devrait refléter l'application (`bnr-cvd-backup-2025-11-09.zip`).

---

## Solutions Proposées

### Solution 1 : Export Automatique de Tous les Namespaces

**Comportement attendu** : Le menu "Sauvegarde → Exporter" devrait exporter **tous les namespaces** enregistrés dans `persistenceRegistry`, sans exception.

**Implémentation suggérée** :

```javascript
// Dans le handler d'export du menu Sauvegarde
async function exportAll() {
  const allNamespaces = persistenceRegistry.getRegisteredNamespaces()
  
  const exports = {}
  for (const namespace of allNamespaces) {
    const data = await persistenceRegistry.exportNamespace(namespace)
    if (data) {
      exports[namespace] = data
    }
  }
  
  // Créer un ZIP contenant tous les exports
  const masterZip = createMasterArchive(exports)
  downloadFile(masterZip, `${APP_KEY}-backup-${timestamp}.zip`)
}
```

**Avantages** :
- Aucune configuration nécessaire côté application
- Export complet automatique
- Cohérence garantie

### Solution 2 : API d'Enregistrement de Namespaces à Exporter

**Alternative** : Permettre aux applications de déclarer les namespaces à inclure dans l'export global.

```javascript
// Dans l'application (main.js)
import { exportRegistry } from 'svelte-ide'

exportRegistry.registerNamespaceForExport('documents', 'binary')
exportRegistry.registerNamespaceForExport('document-library-tree', 'json')
```

**Moins recommandé** : Ajoute du boilerplate et risque d'oubli.

### Solution 3 : Nom de Fichier Configurable

**Comportement attendu** : Utiliser `APP_KEY` pour nommer les exports.

**Implémentation suggérée** :

```javascript
import { APP_KEY } from '@/core/config/appKey.js'

function getExportFilename() {
  const timestamp = new Date().toISOString().split('T')[0]
  return `${APP_KEY}-backup-${timestamp}.zip`
}
```

**Format proposé** : `{APP_KEY}-backup-{YYYY-MM-DD}.zip`

**Exemples** :
- `bnr-cvd-backup-2025-11-09.zip`
- `mon-app-backup-2025-11-09.zip`

---

## Recommandations

### Priorité 1 : Export Complet Automatique
**Implémentation** : Modifier le handler d'export pour itérer sur tous les namespaces de `persistenceRegistry`.

**Fichiers concernés** :
- `src/components/layout/chrome/StorageMenuHelper.svelte.js` (ou équivalent)
- Handler du menu "Sauvegarde → Exporter"

### Priorité 2 : Nom de Fichier Dynamique
**Implémentation** : Utiliser `APP_KEY` au lieu de `'svelte-ide'` hardcodé.

**Impact** : Minimal, améliore UX.

---

## Cas d'Usage BNR-CVD

Dans notre application, nous avons :
- **Namespace `'documents'`** (BinaryPersister) : fichiers PDF, DOCX uploadés par l'utilisateur
- **Namespace `'document-library-tree'`** (JsonPersister) : structure arborescente des dossiers

**Besoin critique** : Ces deux namespaces **doivent** être inclus dans l'export du menu Sauvegarde, sinon l'utilisateur perd ses documents au changement d'appareil/navigateur.

---

## Workaround Temporaire

En attendant l'implémentation dans svelte-ide, l'application peut ajouter son propre menu :

```javascript
mainMenuService.registerMenuItem('sauvegarde', {
  id: 'export-documents',
  label: 'Exporter Documents',
  action: async () => {
    const zipBlob = await persistenceRegistry.exportNamespace('documents')
    downloadBlob(zipBlob, 'documents-export.zip')
  }
})
```

**Inconvénient** : Fragmentation de l'UX (plusieurs menus d'export au lieu d'un seul).

---

## Conclusion

L'export devrait être **exhaustif par défaut** et le nom de fichier **contextualisé à l'application**. Ces modifications rendront svelte-ide plus robuste et éviteront les pertes de données inattendues.
