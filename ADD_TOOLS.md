# Ajouter un Nouvel Outil

## Structure d'un Outil

Créer un dossier `src/tools/[nom-outil]/` avec :

```
src/tools/mon-outil/
├── index.js          # Point d'entrée obligatoire
├── MonComposant.svelte
└── ...autres fichiers
```

## index.js - Point d'Entrée

```javascript
import { LeftTool, RightTool, Tab } from '../../core/Tool.js'
import { ideStore } from '../../stores/ideStore.svelte.js'
import MonComposant from './MonComposant.svelte'

class MonOutil extends LeftTool {
  constructor() {
    super('mon-outil', 'Mon Outil', '🔧')
  }

  initialize() {
    this.setComponent(MonComposant)
  }

  activate() {
    super.activate()
    // Logique d'activation
  }

  deactivate() {
    super.deactivate()
    // Logique de désactivation
  }

  destroy() {
    // Nettoyage des ressources
  }
}

export default {
  register(toolManager) {
    const tool = new MonOutil()
    toolManager.registerTool(tool)
  }
}
```

## Classes de Base

### LeftTool / RightTool
```javascript
class MonOutil extends LeftTool {
  constructor() {
    super(id, name, icon) // id unique, nom affiché, icône
  }
}
```

### Tab (pour la zone principale)
```javascript
import { Tab } from '../../core/Tool.js'

const tab = new Tab('tab-id', 'Titre', MonComposant, closable)
ideStore.addTab(tab)
```

## Services IDE Disponibles

### Logs Console
```javascript
// Log dans l'onglet "Général"
ideStore.addLog('Message', 'info')

// Log dans un onglet spécifique
ideStore.addLog('Erreur détectée', 'error', 'Mon Outil')
```

Types : `'info'`, `'warning'`, `'error'`

### Notifications
```javascript
ideStore.addNotification(
  'Titre',
  'Message détaillé',
  'success', // info, warning, error, success
  'Mon Outil' // source
)
```

### Gestion d'Onglets
```javascript
// Ajouter un onglet
const tab = new Tab('unique-id', 'Titre', ComposantContenu)
ideStore.addTab(tab)

// Fermer un onglet
ideStore.closeTab('tab-id')

// Onglet actif
ideStore.setActiveTab('tab-id')
```

### Barre d'État
```javascript
ideStore.setStatusMessage('Traitement en cours...')
```

### Outils Dynamiques
```javascript
// Enregistrer un outil à la volée
toolManager.registerTool(nouvelOutil)

// Désenregistrer
toolManager.unregisterTool('outil-id')
```

## Écouter les Changements d'Onglets

```javascript
import { tabWatcherService } from '../../core/TabWatcherService.js'

// Dans initialize()
tabWatcherService.addWatcher('mon-id', (activeTab) => {
  if (activeTab && activeTab.id.startsWith('mon-prefix-')) {
    // Réagir au changement
  }
})

// Dans destroy()
tabWatcherService.removeWatcher('mon-id')
```

## Exemple Complet

```javascript
// src/tools/calculator/index.js
import { RightTool } from '../../core/Tool.js'
import { ideStore } from '../../stores/ideStore.svelte.js'
import Calculator from './Calculator.svelte'

class CalculatorTool extends RightTool {
  constructor() {
    super('calculator', 'Calculatrice', '🧮')
  }

  initialize() {
    this.setComponent(Calculator)
    ideStore.addLog('Calculatrice initialisée', 'info', 'Calculator')
  }

  activate() {
    super.activate()
    ideStore.setStatusMessage('Calculatrice active')
  }

  deactivate() {
    super.deactivate()
    ideStore.setStatusMessage('')
  }

  calculate(expression) {
    try {
      const result = eval(expression)
      ideStore.addNotification(
        'Calcul terminé',
        `${expression} = ${result}`,
        'success',
        'Calculator'
      )
      return result
    } catch (error) {
      ideStore.addLog(`Erreur de calcul: ${error.message}`, 'error', 'Calculator')
      return null
    }
  }

  destroy() {
    ideStore.addLog('Calculatrice détruite', 'info', 'Calculator')
  }
}

export default {
  register(toolManager) {
    const tool = new CalculatorTool()
    toolManager.registerTool(tool)
  }
}
```

## Bonnes Pratiques

- **ID unique** : Utilisez un préfixe pour éviter les conflits
- **Nettoyage** : Implémenter `destroy()` pour libérer les ressources
- **Logs** : Utilisez un onglet de console spécifique à votre outil
- **État** : Stockez l'état dans votre composant, pas dans l'IDE
- **Isolation** : N'accédez qu'aux services publics de l'IDE
