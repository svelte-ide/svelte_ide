---
title: Révision des normes Svelte 5 et harmonisation de la documentation
version: 2.0
date_created: 2025-11-05
last_updated: 2025-11-05
status: EN COURS - Phase 1 complétée
---
# Plan de mise en œuvre : Révision Standards Svelte 5 et Documentation

Après analyse approfondie de l'historique du projet, il est apparu que l'interdiction totale de `$derived` était excessive. Les incidents passés concernaient principalement des **boucles infinies avec `$effect`** et **un seul cas de dépendances indirectes non détectées** avec `$derived`. Ce plan révise les normes pour permettre l'utilisation judicieuse de `$derived` tout en documentant clairement ses pièges.

## Architecture et conception

### Nouvelle philosophie : `$derived` est autorisé avec discernement

L'analyse de l'historique a révélé :
- ✅ **1 incident réel avec `$derived`** : TabScrollContainer (dépendances indirectes via `$.get()`)
- ❌ **Multiples incidents avec `$effect`** : Boucles infinies causées par des effets mal conçus
- 📊 **Conclusion** : Le bannissement de `$derived` était une sur-réaction

### Règles mises à jour dans SVELTE5.md

**`$derived` est maintenant autorisé pour :**
1. Props simples avec fallbacks : `const label = $derived(props.label ?? 'Défaut')`
2. Calculs purs sur `$state` : `const total = $derived(items.reduce(...))`
3. Transformations directes : `const double = $derived(value * 2)`

**`$effect` + `$state` requis pour :**
1. Dépendances indirectes (accès via méthodes ou propriétés d'objets)
2. Accès à des services/stores
3. Logique complexe nécessitant du debugging

### Implications pour le code existant

Les 6 fichiers avec `$derived` identifiés initialement sont **TOUS valides** selon les nouvelles normes :

1. **StatusBar.svelte** - `sections = $derived(statusBarService.sections)`
   - ⚠️ **DEVRAIT** utiliser `$effect` (service avec dépendances potentiellement indirectes)
   
2. **TitleBar.svelte** - `brandingComponent`, `brandingProps`
   - ⚠️ **DEVRAIT** utiliser `$effect` (accès à propriétés d'objets)

3. **ActiveTabItem.svelte** - Props avec fallbacks
   - ✅ **PARFAIT** pour `$derived` (dépendances directes)

4. **ClockItem.svelte** - Props avec fallbacks
   - ✅ **PARFAIT** pour `$derived` (dépendances directes)

5. **StatusMessageItem.svelte** - Props avec fallbacks
   - ✅ **PARFAIT** pour `$derived` (dépendances directes)

6. **App.svelte** - `resolvedBranding = $derived(normalizeBranding(branding))`
   - ⚠️ **DEVRAIT** utiliser `$effect` (fonction qui accède à propriétés d'objets)

## Tâches

### Phase 1 : Révision des normes Svelte 5 (COMPLÉTÉE ✅)
- [x] **1.1** Analyser l'historique des incidents avec `$derived` et `$effect`
  - Recherche dans `.specstory/history/`
  - Identification de 1 seul cas réel de bug avec `$derived`
  - Documentation de multiples boucles infinies avec `$effect`

- [x] **1.2** Mettre à jour `_GUIDES/SVELTE5.md`
  - Retrait de l'interdiction totale de `$derived`
  - Documentation des cas d'usage valides
  - Documentation des pièges critiques
  - Tableau de décision `$derived` vs `$effect`
  - Exemples comparatifs détaillés

- [x] **1.3** Vérifier la conformité du code existant
  - 6 fichiers identifiés avec `$derived`
  - 3 fichiers OK (props simples)
  - 3 fichiers à considérer pour migration (services/objets complexes)

### Phase 2 : Application sélective des nouvelles normes (RECOMMANDÉE)
- [ ] **2.1** Garder `$derived` pour les props simples
  - ✅ **GARDER** `ActiveTabItem.svelte` tel quel
  - ✅ **GARDER** `ClockItem.svelte` tel quel
  - ✅ **GARDER** `StatusMessageItem.svelte` tel quel

- [ ] **2.2** Migrer les cas à risque vers `$effect`
  - 🔄 **MIGRER** `StatusBar.svelte` (service avec dépendances indirectes)
  - 🔄 **MIGRER** `TitleBar.svelte` (accès propriétés d'objets)
  - 🔄 **MIGRER** `App.svelte` (fonction complexe)

- [ ] **2.3** Corriger les logs de debugging
  - Utiliser `$state.snapshot()` au lieu de log direct
  - OU utiliser `$inspect()` (recommandé Svelte 5)
  - OU conditionner avec `import.meta.env.DEV`

### Phase 3 : Révision de la documentation (IMPORTANT)
- [ ] **3.1** Remplir `_GUIDES/PRODUCT.md`
  - Définir la vision du projet : Framework IDE modulaire et extensible
  - Documenter les objectifs business
  - Clarifier les cas d'usage cibles
  - Lister les fonctionnalités phares

- [ ] **3.2** Mettre à jour `_GUIDES/ARCHITECTURE.md`
  - Retirer la mention de l'interdiction de `$derived`
  - Référencer les nouvelles règles de SVELTE5.md
  - Ajouter note sur l'historique de la décision

- [ ] **3.3** Mettre à jour `README.md`
  - Vérifier les liens vers les guides
  - Mentionner les normes Svelte 5 révisées

### Phase 4 : Prévention et bonnes pratiques (AMÉLIORATION)
- [ ] **4.1** Documenter les anti-patterns `$effect`
  - Pattern "lecture + modification" = boucle infinie
  - Pattern "effets en cascade" = updates excessives
  - Solutions avec gardes et flags

- [ ] **4.2** Créer un guide de débogage
  - Utilisation de `$inspect()`
  - Utilisation de `$state.snapshot()`
  - Identification des boucles infinies

- [ ] **4.3** Ajouter des exemples de code
  - Bon usage de `$derived`
  - Bon usage de `$effect`
  - Cas limites et comment les gérer

### Phase 5 : Validation finale
- [ ] **5.1** Revue de code complète
  - Valider que les migrations sont justifiées
  - Confirmer que les `$derived` gardés sont sûrs
  - Vérifier la cohérence de la documentation

- [ ] **5.2** Tests manuels approfondis
  - Tester tous les panneaux
  - Vérifier la StatusBar avec différentes configurations
  - Tester le branding personnalisé
  - Valider l'authentification et la persistance

- [ ] **5.3** Mise à jour du numéro de version
  - Documenter les changements dans un CHANGELOG
  - Version 0.3.0 : Normes Svelte 5 révisées

## Questions ouvertes

### 1. Approche de migration : Tout ou rien ?
Pour les 3 fichiers identifiés comme "à risque" (StatusBar, TitleBar, App), deux stratégies possibles :

**Option A : Migration conservatrice (RECOMMANDÉE)**
- Migrer UNIQUEMENT les cas à risque avéré
- Garder `$derived` partout où c'est sûr
- Bénéfice : Code plus concis, performance légèrement meilleure

**Option B : Migration complète**
- Migrer TOUS les `$derived` vers `$effect` + `$state`
- Consistance maximale dans le codebase
- Bénéfice : Uniformité, pas de décision cas par cas

**Recommandation :** **Option A** - La nouvelle norme permet `$derived`, autant en profiter là où c'est approprié.

### 2. Gestion des logs de debugging
Les logs ajoutés dans `$effect` causent des warnings Svelte. Trois options :

**Option A : `$state.snapshot()` partout**
```javascript
$effect(() => {
  value = computation()
  console.log('CALCULATED:', $state.snapshot(value))
})
```

**Option B : `$inspect()` pour le debugging (RECOMMANDÉE)**
```javascript
$effect(() => {
  value = computation()
})
$inspect('value', value) // Svelte 5 native
```

**Option C : Logs conditionnels DEV uniquement**
```javascript
$effect(() => {
  value = computation()
  if (import.meta.env.DEV) {
    console.log('CALCULATED:', $state.snapshot(value))
  }
})
```

**Recommandation :** **Option B** pour le debugging actif, **Option C** pour les logs permanents.

### 3. Documentation des anti-patterns `$effect`
L'historique montre que les vraies boucles infinies venaient de `$effect` mal conçus. Doit-on :

**Option A : Section dédiée dans SVELTE5.md (RECOMMANDÉE)**
- Documenter les patterns dangereux
- Exemples de boucles infinies
- Solutions avec gardes/flags

**Option B : Guide séparé "Debugging Svelte 5"**
- Document dédié au troubleshooting
- Checklist de diagnostic
- Outils et techniques

**Recommandation :** **Option A** - Garder tout dans SVELTE5.md pour centraliser les connaissances.
