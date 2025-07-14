# Instructions IA - IDE Framework Svelte 5

## Points Critiques à Respecter

### Séparation Stricte IDE/Outils
- **TOUJOURS CONSERVER L'ABSTRACTION l'IDE ET LES OUTILS. IDE:** `src/core/`, `src/stores/`, `src/components/layout/`
- **Outils uniquement** dans `src/tools/[nom-outil]/`
- Isolation totale : un outil peut être supprimé sans casser l'IDE
- Utiliser uniquement les services publics exposés par l'IDE

### Syntaxe Svelte 5 Obligatoire
- `$state()` au lieu de `let` pour la réactivité
- `$derived()` pour les valeurs calculées
- `$effect()` pour les effets de bord  
- `let { prop } = $props()` pour les props
- `onclick={handler}` au lieu de `on:click`
- Callbacks props au lieu de `createEventDispatcher`
- `$effect.pre()` et `await tick()` au lieu de lifecycle hooks
- `mount()/unmount()` pour l'instanciation programmatique
- `{@render Component}` pour le rendu dynamique

### Architecture des Outils
```javascript
// Structure obligatoire index.js
export default {
  register(toolManager) {
    const tool = new MonOutil()
    toolManager.registerTool(tool)
  }
}
```

### Classes de Base
- `LeftTool` : Panneaux latéraux gauche
- `RightTool` : Panneaux latéraux droite  
- `Tab` : Onglets zone principale
- Héritent de `Tool` avec `initialize()`, `activate()`, `deactivate()`, `destroy()`

### Services IDE Autorisés
```javascript
// Logs
ideStore.addLog(message, type, tabTitle)

// Notifications  
ideStore.addNotification(title, message, type, source)

// Onglets
ideStore.addTab(new Tab(id, title, component))
ideStore.closeTab(id)
ideStore.setActiveTab(id)

// Statut
ideStore.setStatusMessage(message)

// Outils dynamiques
toolManager.registerTool(tool)
toolManager.unregisterTool(id)

// Observation onglets
tabWatcherService.addWatcher(id, callback)
```

### Anti-Patterns à Éviter
- Modifier l'état de l'IDE directement
- Accéder aux composants layout depuis les outils
- Stocker l'état des outils dans ideStore
- Utiliser l'ancienne syntaxe Svelte
- Créer des dépendances entre outils
- Modifier les fichiers core/stores/layout

### Structure de Fichiers
```
src/
├── core/           ← NE PAS TOUCHER
├── stores/         ← NE PAS TOUCHER  
├── components/
│   └── layout/     ← NE PAS TOUCHER
└── tools/          ← ZONE OUTILS
    └── mon-outil/
        ├── index.js      ← Point d'entrée obligatoire
        ├── Component.svelte
        └── ...
```

### Détection Automatique
- Outils détectés via `import.meta.glob('../tools/**/index.js')`
- Chargement automatique au démarrage
- Échec silencieux si outil manquant/cassé

### Nettoyage Obligatoire
```javascript
destroy() {
  // Supprimer les watchers
  tabWatcherService.removeWatcher(this.watcherId)
  // Désenregistrer les outils dynamiques
  if (this.childTool) {
    toolManager.unregisterTool(this.childTool.id)
  }
  // Nettoyer les ressources
}
```

### Réactivité Svelte 5
- Accès explicite aux propriétés dans `$effect()`
- Éviter l'optimisation excessive de `$derived()`
- Forcer la réactivité si nécessaire avec accès explicite
