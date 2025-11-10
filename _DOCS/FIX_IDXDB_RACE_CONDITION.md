# Fix: Race Condition IndexedDB au démarrage

**Date**: 10 novembre 2025  
**Issue**: Erreur `IDBDatabase.transaction: Can't start a transaction on a closed database`

## Problème Identifié

### Symptômes
```
IndexedDBService: Save failed due to closed database, retrying once 
DOMException: IDBDatabase.transaction: Can't start a transaction on a closed database
```

Erreurs observées dans la console au clic sur un tool lors du démarrage de l'application.

### Analyse Racine (par l'intégrateur)

Le flux problématique était :
1. L'utilisateur clique sur un tool dans la toolbar
2. `PanelsManager.togglePanel()` active le panel
3. `PanelsManager._notifyChange()` déclenche le callback
4. `ideStore.saveUserLayout()` est appelé **immédiatement**
5. ❌ **IndexedDB n'est pas encore ouvert** → Exception

### Cause Technique

Dans `ideStore.svelte.js`, le callback de changement de panels était enregistré **sans garde** :

```javascript
// ❌ AVANT - Sauvegarde immédiate sans vérification
this.panelsManager.addChangeCallback(() => {
  this._updateToolLists()
  this.saveUserLayout() // Appelé avant que IndexedDB soit prêt
})
```

Le service `indexedDBService` dispose d'un **retry mechanism** qui réinitialise la DB et réessaie, mais :
- Ce retry ajoute de la latence (réouverture de DB)
- Les logs d'erreur polluent la console
- Le retry peut échouer si la DB n'est toujours pas prête

## Solution Implémentée

### Approche : Différer les sauvegardes jusqu'à `persistence:ready`

1. **Ajout d'un flag `_persistenceReady`** dans `ideStore` :
   ```javascript
   this._persistenceReady = false
   this._hasPendingSave = false
   ```

2. **Écoute de l'événement `persistence:ready`** :
   ```javascript
   eventBus.subscribe('persistence:ready', () => {
     this._persistenceReady = true
     // Si une sauvegarde était en attente, la déclencher maintenant
     if (this._hasPendingSave) {
       this._hasPendingSave = false
       this.saveUserLayout()
     }
   })
   ```

3. **Garde dans `saveUserLayout()`** :
   ```javascript
   async saveUserLayout() {
     if (!this.isAuthenticated || !this.user) return
     
     // Différer la sauvegarde si la persistance n'est pas encore prête
     if (!this._persistenceReady) {
       this._hasPendingSave = true
       console.debug('IdeStore: Sauvegarde différée, persistance non prête')
       return
     }
     
     // ... reste du code de sauvegarde
   }
   ```

### Flux Corrigé

```
1. App.svelte démarre
2. authStore initialise les clés de chiffrement
3. App.$effect() publie 'persistence:ready'
   ├─> ideStore._persistenceReady = true
   └─> Déclenche la sauvegarde en attente si nécessaire
4. Utilisateur clique sur un tool
5. PanelsManager notifie le changement
6. ideStore.saveUserLayout() vérifie _persistenceReady
   ├─> ✅ Si prêt : sauvegarde immédiate
   └─> ⏳ Sinon : marque _hasPendingSave = true
```

## Tests de Validation

### Scénario 1 : Démarrage à froid
1. Clear le cache (IndexedDB + localStorage)
2. Rafraîchir l'app
3. Cliquer rapidement sur un tool
4. ✅ **Aucune erreur IndexedDB dans la console**
5. ✅ Le panel s'ouvre correctement
6. Recharger la page
7. ✅ Le layout est restauré (panel ouvert)

### Scénario 2 : Utilisateur authentifié
1. Se connecter avec Google OAuth
2. Ouvrir un tool (ex: Explorer)
3. ✅ Pas d'erreur `closed database`
4. Rafraîchir
5. ✅ Le tool est toujours ouvert

### Scénario 3 : Mode non-authentifié
1. Lancer l'app avec `VITE_AUTH_PROVIDERS=mock` désactivé
2. Ouvrir/fermer des tools
3. ✅ La persistance fonctionne en localStorage (fallback)
4. ✅ Pas d'erreur liée à IndexedDB

## Impact

### Avant le Fix
- ❌ Erreurs `DOMException` dans la console au démarrage
- ❌ Latence due au retry automatique
- ❌ Expérience utilisateur polluée par des logs d'erreur
- ⚠️ Fonctionnel mais non optimal (le retry finissait par fonctionner)

### Après le Fix
- ✅ Aucune erreur au démarrage
- ✅ Sauvegarde déclenchée uniquement quand IndexedDB est prêt
- ✅ Logs propres : `IdeStore: Sauvegarde différée, persistance non prête` (debug uniquement)
- ✅ Performance optimale (pas de retry inutile)

## Considérations Futures

### Limitation Actuelle
Le flag `_persistenceReady` ne passe **jamais à `false`** après avoir été activé. Si IndexedDB se ferme en cours d'exécution (rare, mais possible avec des extensions navigateur agressives), les sauvegardes échoueront.

### Amélioration Possible
Écouter également `persistence:error` pour désactiver temporairement les sauvegardes :
```javascript
eventBus.subscribe('persistence:error', ({ reason }) => {
  if (reason === 'database_closed') {
    this._persistenceReady = false
  }
})
```

⚠️ **Non implémenté pour l'instant** car ce scénario est extrêmement rare en production et le retry mechanism de `IndexedDBService` gère déjà ce cas.

## Références

- **Code modifié** : `src/stores/ideStore.svelte.js`
- **Événement utilisé** : `persistence:ready` (publié par `App.svelte`)
- **Services liés** :
  - `IndexedDBService.svelte.js` (retry mechanism existant)
  - `PersistenceRegistry.svelte.js` (orchestration)
  - `App.svelte` (publication de `persistence:ready`)

## Crédit

Diagnostic initial et analyse par l'intégrateur du projet `document-library`.

---

**Status**: ✅ Résolu  
**Version framework**: 0.2.1+
