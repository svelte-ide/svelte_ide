# IDE Framework Svelte 5

Framework d'interface de développement modulaire inspiré de PyCharm. Conçu pour être réutilisé dans différents projets en tant que base générique.

## Installation

```bash
npm install
npm run dev
```

## Architecture

Interface divisée en 8 sections principales :
- **Barre de titre** : Titre et connexion utilisateur
- **Barres d'outils latérales** : Icônes d'activation des outils
- **Panneaux latéraux** : Contenu des outils (redimensionnables)
- **Zone principale** : Onglets et visualisations
- **Console** : Logs système avec onglets (redimensionnable)
- **Barre d'état** : Messages contextuels et contrôles

## Séparation IDE / Outils

L'IDE fournit une **interface générique** et des **services** aux outils spécifiques :

### Interface Core (maintenir l'abstraction entre le core et les tools)
- `src/core/` : Classes de base et gestionnaires
- `src/stores/` : État global de l'IDE
- `src/components/layout/` : Composants d'interface

### Outils Modulaires (spécifiques au projet)
- `src/tools/[nom-outil]/` : Outils détectés automatiquement
- Peuvent être supprimés sans casser l'IDE
- Isolation complète du code core

## Services Disponibles

### Panneaux Latéraux
- Outils gauche/droite avec activation/désactivation
- Redimensionnement automatique

### Système d'Onglets
- Création d'onglets dans la zone principale
- Gestion des fermetures et navigation

### Console Multi-Onglets
- Logs par catégorie avec horodatage
- Types : info, warning, error

### Notifications
- Système de notifications avec compteur
- Notifications non lues

## Technologies

- **Svelte 5** avec syntaxe runes ($state, $effect, $derived)
- **Vite** pour le build
- **CSS Custom Properties** pour le thème VS Code
