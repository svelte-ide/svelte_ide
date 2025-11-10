# Correction de la Réhydratation Explorer

## Problème Initial

La réhydratation des fichiers ouverts dans Explorer 1 ne fonctionnait pas en raison d'un problème de timing :

1. `ideStore.restoreUserLayout()` publie `tab:hydrate` (ligne 582)
2. Les tabs sont reconstruits
3. **PUIS** `stateProviderService.restoreAllStates()` est appelé (ligne 608)

**Conséquence** : Quand `ExplorerRestorationService` reçoit `tab:hydrate`, l'état d'`ExplorerPersistenceService` n'est pas encore restauré.

## Solution Implémentée

### Principe KISS : Event-Driven 100% Côté Outil

**Aucune modification du cœur de l'IDE**. Toute la logique est dans `src/test_tools/explorer/`.

### Architecture

```
ideStore.restoreUserLayout()
  ↓
1. publish('tab:hydrate') ← Arrive AVANT restoreAllStates()
  ↓
ExplorerRestorationService reçoit l'événement
  ├─ Si state.restored = false → Mettre en file d'attente
  └─ Sinon → Hydrater immédiatement
  ↓
2. stateProviderService.restoreAllStates()
  ↓
ExplorerPersistenceService.restoreState()
  ├─ Restaurer selectedItem, recentFiles
  ├─ Restaurer fileContents dans explorerStore
  └─ publish('explorer:state-restored') ✨
  ↓
ExplorerRestorationService traite la file d'attente
  ├─ Pour chaque tab en attente
  └─ Hydrater avec le contenu en cache
```

### Changements Effectués

#### 1. `explorerStore.svelte.js`
Ajout de méthodes pour la persistance globale :
- `getAllContents()` : Retourne tous les fileContents
- `getAllOriginalContents()` : Retourne tous les fileOriginalContents
- `restoreAllContents()` : Restaure les contenus depuis un snapshot

#### 2. `ExplorerPersistenceService.svelte.js`
- ❌ **Supprimé** : `_loadInitialState()` (source de race condition)
- ✅ **Ajouté** : 
  - `fileContents` et `fileOriginalContents` dans `saveState()`
  - Restauration de ces données dans `restoreState()`
  - Publication de `explorer:state-restored` après restauration
- ✅ **Modifié** : État par défaut avec `loaded: true` immédiatement

#### 3. `ExplorerRestorationService.svelte.js`
- ✅ **Ajouté** : File d'attente `pendingHydrations`
- ✅ **Ajouté** : Abonnement à `explorer:state-restored`
- ✅ **Modifié** : `handleHydrate()` utilise d'abord le cache avant de charger depuis le disque

## Respect de l'Architecture

### ✅ Principe KISS
- Pas de couches d'abstraction complexes
- Solution simple : un événement + une file d'attente
- Code minimal nécessaire

### ✅ Séparation IDE vs Outils
- **ZÉRO modification** de `src/core/` ou `src/stores/`
- L'IDE ne sait rien de ce pattern
- Pattern réutilisable par d'autres outils

### ✅ Extensibilité
Tout outil peut utiliser ce pattern :
```javascript
class MonOutilPersistenceService {
  async restoreState(data) {
    // ... restaurer l'état
    eventBus.publish('mon-outil:state-restored', { state: this.state })
  }
}

class MonOutilRestorationService {
  constructor() {
    this.stateRestored = false
    this.pendingHydrations = []
    
    eventBus.subscribe('mon-outil:state-restored', () => {
      this.stateRestored = true
      this.pendingHydrations.forEach(fn => fn())
      this.pendingHydrations = []
    })
    
    eventBus.subscribe('tab:hydrate', (event) => {
      if (this.stateRestored) {
        this.handleHydrate(event)
      } else {
        this.pendingHydrations.push(() => this.handleHydrate(event))
      }
    })
  }
}
```

## Test de Validation

### Scénario
1. Se connecter avec Google OAuth
2. Ouvrir un fichier (ex: `demo1.txt`)
3. Modifier le contenu
4. Recharger la page (F5)
5. **Vérifier** :
   - ✅ Le tab se rouvre automatiquement
   - ✅ Le contenu modifié est restauré
   - ✅ `selectedItem` dans FileExplorer est correct
   - ✅ Aucune erreur dans la console
   - ✅ Pas de "Chargement de la persistance..." bloquant

### Console de Debug
Pour activer les traces :
```javascript
eventBus.setDebugMode(true)
```

Événements à observer :
- `tab:hydrate` (arrive en premier)
- `explorer:state-restored` (arrive après)
- Logs "Traiter toutes les hydratations en attente"

## Bénéfices

1. **Performance** : Les contenus de fichiers modifiés sont restaurés depuis le cache (IndexedDB) au lieu d'être rechargés depuis `fileService`
2. **Cohérence** : L'état modifié est préservé même si le fichier source a changé
3. **Architecture** : Démontre la séparation stricte IDE/Outils
4. **Réutilisabilité** : Pattern applicable à tous les outils ayant des besoins similaires

## Note sur le "Bug" du Cœur

L'ordre d'exécution dans `ideStore.restoreUserLayout()` (hydratation avant restoration d'état) pourrait être considéré comme un bug, **MAIS** :

1. Le corriger casserait potentiellement d'autres outils
2. La solution event-driven est plus robuste et découplée
3. Elle fonctionne même si l'ordre change dans le futur
4. Elle permet à chaque outil de gérer son propre timing

**Décision** : Ne pas modifier le cœur pour l'instant. La solution côté outil est suffisante et plus KISS.

---

**Date** : 9 novembre 2025  
**Auteur** : GitHub Copilot  
**Statut** : ✅ Implémenté et Testé
