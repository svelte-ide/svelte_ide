# Svelte 5 — Guide de Bonnes Pratiques (Réactivité & Simplicité)

## 1. Runes essentielles

### $state — Etat reactif
A utiliser pour toute donnee mutable qui doit mettre a jour l'interface.

```js
let user = $state({ name: "A" })
user.name = "B"
```

Notes :
- mutations OK pour objets/arrays simples
- reassignation necessaire pour Map, Set, objets complexes

---

### $derived — Valeurs calculees pures
Utiliser seulement si toutes les dependances sont directes, primitives et stables.

```js
let full = $derived(first + " " + last)
```

A eviter si :
- dependance indirecte (objets profonds, services, methodes)
- acces dynamique
- Map, Set, classes
- logique conditionnelle complexe

---

### $effect — Effets de bord
Utiliser pour toute action non pure.

```js
$effect(() => {
  fetchData(id)
})
```

Utiliser pour fetch, DOM, sync services, derives complexes.

---

### $props — Props composant
Toujours recuperer les props avec $props().

```js
let { value, onSelect } = $props()
```

---

## 2. Regles de reactivite robustes

### 2.1 Si un derived n'est pas trivial -> utiliser $effect
Assure une reactivite stable.

### 2.2 Reassigner apres mutation interne
```js
list.push(item)
list = [...list]
```

### 2.3 Services et classes
```js
let name = $state("")
$effect(() => { name = controller.getName() })
```

### 2.4 Eviter cascades d'effets
```js
$effect(() => {
  let v = name.trim()
  if (v !== name) name = v
})
```

### 2.5 Acces dynamique non reactif
```js
let v = $derived(obj[key]) // fragile
```

---

## 3. Patterns composants

### Props simples
```js
let { label = "OK" } = $props()
let resolved = $derived(label || "OK")
```

### Communication enfant -> parent
```js
let { onSelect } = $props()
<button onclick={() => onSelect(item)}>OK</button>
```

### Composants dynamiques
```svelte
{@render Component({ prop: x })}
```

---

## 4. Structures complexes

### Map et Set
```js
map.set(k, v)
map = new Map(map)
```

### Objets imbriques
```js
user.address.city = "QC"
user = { ...user, address: { ...user.address } }
```

### Stores externes
```js
let current = $state(null)
$effect(() => { current = externalStore.value })
```

---

## 5. Organisation du code Svelte 5

Ordre recommande :
1. imports  
2. variables $state  
3. $derived simples  
4. $effect  
5. snippets / composants  
6. markup

Ne pas utiliser :
- export let
- $:
- on:click
- <svelte:component>

---

## 6. Resume TLDR

$state pour : etat mutable simple  
$derived pour : valeurs triviales, calculs purs  
$effect pour : tout ce qui n'est pas un calcul pur  
Si doute : utiliser $effect + $state

---

## 7. Checklist finale

- [ ] Aucun derived complexe
- [ ] Aucun acces dynamique dans derived
- [ ] Reassignation apres mutation profonde
- [ ] Services -> dans un effect
- [ ] Props via $props()
- [ ] Callbacks pour communication enfant/parent
- [ ] onclick utilisations uniformes
- [ ] Map/Set reassignes
- [ ] Aucun $:
- [ ] Aucun export let

