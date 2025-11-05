# Guide des Bonnes Pratiques Svelte 5

Ce guide définit les normes obligatoires pour l'écriture de code avec Svelte 5. L'objectif est de produire un code moderne, lisible, performant et d'éviter les pièges de réactivité. **Aucune syntaxe legacy n'est autorisée.**

## 1. Les Piliers de la Réactivité : `let`, `$state`, `$derived`, `$effect`

La maîtrise de ces quatre concepts est non négociable.
#
-   **`let` : Pour les Constantes et Valeurs Statiques**
    -   **Usage :** Uniquement pour les valeurs qui ne changeront **jamais** durant le cycle de vie du composant (fonctions, constantes importées, valeurs initiales non réactives).
    -   **Anti-Pattern :** Utiliser `let` pour une variable qui, si elle changeait, devrait mettre à jour l'interface.

-   **`$state` : Pour l'État Réactif**
    -   **Usage :** **TOUJOURS** utiliser `$state()` pour déclarer toute variable dont le changement doit déclencher une mise à jour de l'interface. C'est la source de vérité pour l'état de vos composants.
    -   **Bonne pratique :** Vous pouvez muter directement les objets et les tableaux déclarés avec `$state`. Inutile de les réassigner (`monArray.push(x)` fonctionne, pas besoin de `monArray = [...monArray, x]`).

-   **`$derived` : Pour les Valeurs Calculées Pures**
    -   **Usage :** Pour déclarer une nouvelle variable dont la valeur est une **combinaison synchrone et pure** d'autres valeurs `$state` ou `$derived`. Svelte optimise ces calculs pour ne les exécuter que lorsque leurs dépendances changent.
    -   **Exemple :** `let nomComplet = $derived(prenom + ' ' + nom);`
    -   **Anti-Pattern :** Mettre des appels API, des `setTimeout`, ou toute autre logique asynchrone ou à effet de bord dans un `$derived`.

-   **`$effect` : Pour les Effets de Bord**
    -   **Usage :** **TOUT** ce qui n'est pas un calcul de valeur pure. C'est le seul endroit autorisé pour les effets de bord en réaction à un changement d'état.
    -   **Exemples :**
        -   Appels API (`fetch`).
        -   Interaction avec `localStorage` ou `document`.
        -   Logging.
        -   Synchronisation avec une librairie externe.
    -   **Nettoyage :** Si un `$effect` crée un abonnement ou un timer, il **doit** retourner une fonction de nettoyage.
        ```javascript
        $effect(() => {
          const timer = setInterval(() => console.log('tick'), 1000);
          return () => clearInterval(timer); // Nettoyage obligatoire
        });
        ```

## 2. `$derived` : Quand et Comment l'Utiliser

`$derived` est **autorisé** mais nécessite une compréhension approfondie de ses pièges pour éviter les bugs de réactivité.

### ✅ Cas d'Usage VALIDES pour `$derived`

**Règle d'or :** `$derived` fonctionne UNIQUEMENT si toutes les dépendances sont **directes et visibles** dans l'expression.

```javascript
// ✅ BON - Dépendances directes sur des $state
let firstName = $state('Pierre')
let lastName = $state('Langlois')
let fullName = $derived(firstName + ' ' + lastName)

// ✅ BON - Calcul simple avec props
let { items = [] } = $props()
let itemCount = $derived(items.length)

// ✅ BON - Transformation directe
let price = $state(100)
let priceWithTax = $derived(price * 1.15)
```

### ❌ Pièges CRITIQUES avec `$derived`

**1. Dépendances indirectes (accès via méthodes ou propriétés d'objets)**

```javascript
// ❌ DANGEREUX - Svelte peut ne pas détecter la dépendance
let container = $state({ width: 100, height: 50 })
let ratio = $derived(container.width / container.height) // ⚠️ Peut ne pas se mettre à jour !

// ✅ SOLUTION - Utiliser $effect + $state
let ratio = $state(0)
$effect(() => {
  ratio = container.width / container.height
})
```

**2. Appels de méthodes dans le calcul**

```javascript
// ❌ DANGEREUX - La méthode peut cacher des dépendances
let activeTool = $state(someTool)
let toolName = $derived(activeTool.getName()) // ⚠️ Réactivité non garantie !

// ✅ SOLUTION - Accès direct à la propriété
let toolName = $derived(activeTool.name)

// ✅ OU utiliser $effect si la méthode est nécessaire
let toolName = $state('')
$effect(() => {
  toolName = activeTool.getName()
})
```

**3. Logging de valeurs `$derived`**

```javascript
// ⚠️ ATTENTION - Ne PAS logger directement un $state dans $effect
let value = $state(10)
$effect(() => {
  console.log('value:', value) // ⚠️ Warning: logging $state proxy
})

// ✅ SOLUTION - Utiliser $state.snapshot()
$effect(() => {
  console.log('value:', $state.snapshot(value))
})

// ✅ OU utiliser $inspect() (recommandé pour debugging)
$inspect('value', value)
```

### 🎯 Décision : `$derived` vs `$effect` + `$state`

| Critère | Utiliser `$derived` | Utiliser `$effect` + `$state` |
|---------|---------------------|-------------------------------|
| Dépendances | Directes et simples | Indirectes ou complexes |
| Calcul | Pure transformation synchrone | Logique conditionnelle ou appels de méthodes |
| Debugging | Pas besoin de logs | Besoin de tracer les changements |
| Props avec fallbacks | ✅ Idéal | Overkill |
| Services/Stores | ❌ Risqué | ✅ Préférable |

### 📝 Exemples Comparatifs

```javascript
// CAS 1: Props simples avec fallbacks
// ✅ $derived est parfait ici
let { label = 'Défaut', className = '' } = $props()
const resolvedLabel = $derived(label ?? 'Défaut')
const resolvedClass = $derived(className ?? '')

// ❌ $effect serait du overkill
let resolvedLabel = $state('Défaut')
$effect(() => {
  resolvedLabel = label ?? 'Défaut'
})

// CAS 2: Accès à des services
// ❌ $derived risqué (dépendances indirectes possibles)
const sections = $derived(statusBarService.sections)

// ✅ $effect préférable
let sections = $state({ left: [], center: [], right: [] })
$effect(() => {
  sections = statusBarService.sections
})

// CAS 3: Calculs purs sur $state
// ✅ $derived excellent
let items = $state([1, 2, 3])
let total = $derived(items.reduce((a, b) => a + b, 0))

// CAS 4: Transformation avec objet complexe
// ❌ $derived peut échouer
let branding = $state({ component: MyComp, props: {} })
const resolved = $derived(normalizeBranding(branding)) // ⚠️ Risqué !

// ✅ $effect sûr
let resolved = $state(null)
$effect(() => {
  resolved = normalizeBranding(branding)
})
```

## 3. Éviter les Boucles Infinies avec `$effect`

L'expérience a montré que le compilateur Svelte peut être trop optimiste avec `$derived`, conduisant à des non-mises à jour si les dépendances sont indirectes.

-   **Le Symptôme :** Une valeur affichée à l'écran ne se met pas à jour alors que ses données sources ont changé.
-   **La Cause :** La dépendance n'est pas directement visible dans l'expression du `$derived` (ex: elle est cachée dans une méthode d'un objet).

-   **La Solution Infaillible : Le "Pattern `$effect` + `$state`"**
    -   En cas de doute ou de bug avec un `$derived`, **ne perdez pas de temps** et refactorez-le immédiatement en utilisant un `$effect` qui met à jour un `$state`. C'est plus verbeux mais **explicite et fiable**.

    -   **Exemple de refactoring :**

        *Version `$derived` (potentiellement piégeuse) :*
        ```javascript
        // Si activeTool est un objet complexe, Svelte pourrait ne pas voir
        // les changements de ses propriétés internes.
        let toolName = $derived(activeTool ? activeTool.getName() : 'Aucun');
        ```

        *Version `$effect` + `$state` (sûre et recommandée) :*
        ```javascript
        let toolName = $state('Aucun');

        $effect(() => {
          // Accès explicite pour garantir la dépendance
          const currentTool = ideStore.activeToolsByPosition[position];
          
          if (currentTool) {
            toolName = currentTool.name;
          } else {
            toolName = 'Aucun';
          }
        });
        ```

## 3. Composants : Props, Événements et Cycle de Vie

-   **Props :**
    -   **Usage :** Récupérez **TOUJOURS** les props avec `let { maProp, autreProp } = $props();`.
    -   **Anti-Pattern :** `export let maProp;` est **interdit**.

-   **Événements (Callbacks) :**
    -   **Usage :** Un composant enfant **DOIT** exposer des props de type fonction (callbacks) pour communiquer avec son parent.
    -   **Exemple :**
        ```javascript
        // Enfant.svelte
        let { onAction } = $props();
        
        // Parent.svelte
        <Enfant onAction={() => console.log('Action!')} />
        ```
    -   **Anti-Pattern :** `createEventDispatcher` et la syntaxe `on:mon-evenement` sont **interdits**.

-   **Cycle de Vie :**
    -   **`onMount` :** Le corps de la balise `<script>` est exécuté une seule fois au montage. C'est le nouvel `onMount`.
    -   **`onDestroy` :** Un `$effect` qui retourne une fonction de nettoyage.
    -   **`beforeUpdate` / `afterUpdate` :** Remplacés par `$effect.pre()` et `await tick()` dans un `$effect`.

## 4. Règles d'Or et Anti-Patterns en Rafale

-   **TOUJOURS** utiliser `onclick={handler}`. **JAMAIS** `on:click={handler}`.
-   **TOUJOURS** utiliser `{@render monComposant}` pour le rendu dynamique. **JAMAIS** `<svelte:component>`.
-   **JAMAIS** de `$:`. Utilisez `$derived` pour les valeurs, `$effect` pour les actions.
-   **JAMAIS** de déstructuration d'un objet `$state` car cela lui fait perdre sa réactivité. Accédez à ses propriétés directement (`monObjet.prop`).
