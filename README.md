# IDE Framework Svelte 5

Ce projet est un framework modulaire pour la création d'environnements de développement intégrés (IDE), construit avec Svelte 5.

**Version actuelle :** 0.3.0 ([Changelog](./CHANGELOG.md))

## Démarrage Rapide

```bash
npm install
npm run dev
```

## Documentation

### Vision Produit
Pour comprendre la vision, les objectifs business et les cas d'usage du framework :

➡️ **[PRODUCT.md](./_GUIDES/PRODUCT.md)**

### Architecture Technique
Le framework est conçu autour d'une séparation stricte entre le **cœur de l'IDE** (la structure, les services) et les **Outils** (les fonctionnalités modulaires). Cette approche garantit une extensibilité et une maintenabilité maximales.

Pour une explication détaillée de l'architecture, des services disponibles et de la manière de créer vos propres outils :

➡️ **[ARCHITECTURE.md](./_GUIDES/ARCHITECTURE.md)**

### Normes de Développement
Ce projet applique des règles de codage strictes basées sur les dernières fonctionnalités de **Svelte 5 (Runes)**. 

**Points clés des normes Svelte 5 :**
- ✅ `$derived` autorisé pour les calculs purs avec dépendances directes
- ✅ `$effect` + `$state` requis pour les dépendances indirectes ou accès services
- ✅ Utilisation de `$inspect()` pour le debugging
- ❌ Syntaxe legacy proscrite (`export let`, `on:`, `$:`)

Pour connaître les règles détaillées, les bonnes pratiques et les anti-patterns à éviter :

➡️ **[SVELTE5.md](./_GUIDES/SVELTE5.md)**

## Licence

Ce projet est distribué sous licence Apache 2.0. Consultez les fichiers [LICENSE](./LICENSE) et [NOTICE](./NOTICE) pour connaître les conditions d'utilisation et les obligations d'attribution.
