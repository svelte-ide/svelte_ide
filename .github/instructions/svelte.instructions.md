---
applyTo: '**'
---
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


# Normes de codage

Ne pas mettre de commentaires dans le code.
Ne pas mettre de docstrings dans le code.
N'utiliser les try/except que pour les exceptions critiques.

Ne pas faire de méga fichiers avec des centaines de lignes, sauf en cas de nécessité absolue.
Tu dois diviers ton code en plusieurs fichiers logiques de manière à conserver la lisibilité et la maintenabilité.
Tu dois créer des structures de dossiers nécessaires pour conserver la lisibilité et la maintenabilité de ton code.

Garde tes boucles et conditions les plus simples possible.
Assure-toi ne ne pas laisser de code mort.

# refact
Lorsque tu changes un comportement existant, assure toi de supprimer tout le code relié à l'ancien comportement et que le reste du code fonctionne correctement.

# tests
NE PAS CODER DE TESTS UNITAIRES, D'INTÉGRATION OU FONCTIONNELS, DE MIGRATIONS, ETC. Demande moi de tester le code à la place.

# Svelte
Quand Svelte est utilisé, tu dois coder avec Svelte 5:

- Ne plus déclarer de let top-level pour la réactivité → utiliser $state(…).
- Ne plus utiliser les blocs $: → passer à $derived(…) pour les valeurs et $effect(…) pour les effets.
- Ne plus écrire export let prop → récupérer les props avec let { prop } = $props().
- Ne plus employer on:click|preventDefault → utiliser onclick={e => { e.preventDefault(); … }}.
- Ne plus créer d’événements via createEventDispatcher → exposer des callback props (onClick={…}).
- Ne plus utiliser beforeUpdate/afterUpdate → remplacer par $effect.pre(…) et await tick().
- Ne plus instancier new Component(...) → monter avec mount(Component, { target }).
- Ne plus tripoter $$props/$$restProps → utiliser $props() et le spread (…rest).
- Ne plus utiliser <svelte:component>/<svelte:self> → dynamiser avec {@render MonComposant}.
- Ne plus appeler $on/$set/$destroy sur l’instance → passer par des callback props et unmount().
- Respecter tout autre changement de Svelte 5.

## Svelte 5 - Réactivité et $derived

Attention aux pièges de réactivité avec Svelte 5 :

- **$derived peut être trop optimisé** : Svelte 5 optimise parfois de manière trop agressive les $derived, ce qui peut empêcher les mises à jour réactives. Privilégié les $effect au $derived avec accès explicite aux propriétés réactives.

- **Accès explicite aux propriétés** : Dans un $effect, s'assurer d'accéder explicitement aux propriétés réactives pour maintenir la réactivité. Exemple :
  ```javascript
  $effect(() => {
    // Accès explicite pour forcer la réactivité
    if (activeTool) activeTool.name
    if (store.visible) store.visible
  })

# RÈGLES TRÈS IMPORTANTES
**TU DOIS RESPECTER LA SÉPARATION STRICTE DES RESPONSABILITÉS ENTRE L'IDE ET LES OUTILS.**
**Il ne doit pas y avoir de dépendances entre l'IDE vers les outils.**