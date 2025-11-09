---
title: Service de stockage IndexedDB pour blobs sécurisés
version: 0.1
date_created: 2025-02-14
last_updated: 2025-02-14
---
# Plan de mise en œuvre : Service de stockage de blobs pour svelte-ide
Créer un service officiel dans `svelte-ide` qui permet aux tools de stocker des fichiers binaires (PDF, DOCX, images, artefacts OCR) dans IndexedDB sans avoir à réimplémenter la couche de persistance ni à contourner `TokenCipher`. Le service doit être chiffré, multi-store et offrir une API publique similaire à `IndexedDBPersister`, mais optimisée pour les blobs et leurs métadonnées.

## Architecture et conception
- Étendre `IndexedDBService` (ou introduire `BinaryStoreService`) pour supporter la sérialisation Blob/ArrayBuffer avec chiffrement AES-GCM via `TokenCipher`.
- Prévoir deux niveaux : 
  1. Structures JSON (arbre de dossiers, métadonnées légères) via les persisters existants.
  2. Blobs + artefacts volumineux via un store dédié exposé dans l’API publique (`saveBlob`, `loadBlob`, `deleteBlob`, `listBlobs`, `exportStore`).
- Pas de TTL automatique : les blobs restent stockés indéfiniment et ne sont supprimés que par action explicite de l’utilisateur.
- Fournir une fonctionnalité d’export/import générique (ZIP ou JSON + blobs) afin que les clients puissent sauvegarder/restaurer toute leur bibliothèque hors ligne.

## Décisions produit
- Pas de quotas initiaux sur ce store binaires ; seule la capacité IndexedDB du navigateur fait foi.
- Export/import standardisés via un paquet ZIP contenant les blobs et un manifeste JSON.
- Pas de rotation de clé actuellement, donc pas de re-chiffrement automatique.

## Tâches
- [x] Concevoir l’API publique (`BinaryStorageService`) et l’implémenter (`src/core/persistence/BinaryStorageService.svelte.js`). **TODO**: documenter l’API dans `_GUIDES/INDEXEDDB_USAGE.md`.
- [x] Ajouter la prise en charge des blobs chiffrés via TokenCipher (conversion `Blob` ↔ `ArrayBuffer`, méthodes `encryptBytes`/`decryptBytes`).
- [x] Implémenter les méthodes clés : `saveBlob`, `loadBlob`, `deleteBlob`, `listBlobs`, `exportStore`, `importStore`, `clearNamespace`.
- [ ] Étendre `persistenceRegistry` ou exposer un helper pour simplifier l’enregistrement côté tools (à spécifier selon besoins réel).
- [ ] Ajouter des tests manuels/automatisés (fallback, conformité ZIP, rotation de clé future, export/import).
- [ ] Publier la nouvelle API dans `public-api.js` + changelog + guide de migration (export public prêt, reste docs/changelog).

## Questions ouvertes
1. Faut-il exposer proactivement l’usage disque à l’utilisateur même en l’absence de quotas ?
2. Quand nous introduirons une rotation de clé, voulons-nous un re-chiffrement lazy ou une purge forcée ?
3. Quelle convention de manifeste JSON adopter dans le ZIP pour permettre l’interop entre outils ?
