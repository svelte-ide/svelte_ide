# Réponse à l'Intégrateur : Fix IndexedDB Race Condition

## Ton Analyse : 100% Correcte ✅

Tu as parfaitement identifié le problème :

> "Ces erreurs viennent de `ideStore.saveUserLayout()` qui essaie d'écrire dans IndexedDB **avant que la base soit ouverte**."

C'était effectivement un **race condition** au démarrage où le callback `panelsManager.addChangeCallback()` déclenchait une sauvegarde avant que `persistence:ready` soit émis.

---

## Ce Qui a Été Corrigé

### Dans `src/stores/ideStore.svelte.js`

**1. Ajout d'un flag de garde**
```javascript
// Flags pour éviter les sauvegardes prématurées
this._persistenceReady = false
this._hasPendingSave = false

// Écouter l'événement persistence:ready
eventBus.subscribe('persistence:ready', () => {
  this._persistenceReady = true
  // Si une sauvegarde était en attente, la déclencher maintenant
  if (this._hasPendingSave) {
    this._hasPendingSave = false
    this.saveUserLayout()
  }
})
```

**2. Protection dans `saveUserLayout()`**
```javascript
async saveUserLayout() {
  if (!this.isAuthenticated || !this.user) return
  
  // Différer la sauvegarde si la persistance n'est pas encore prête
  if (!this._persistenceReady) {
    this._hasPendingSave = true
    console.debug('IdeStore: Sauvegarde différée, persistance non prête')
    return // ⬅️ Sortie anticipée, pas d'appel IndexedDB
  }
  
  // ... reste du code (inchangé)
}
```

---

## Résultat Attendu

### ✅ Plus d'erreurs au démarrage
Les logs suivants **disparaissent complètement** :
```
❌ IndexedDBService: Save failed due to closed database, retrying once
❌ DOMException: IDBDatabase.transaction: Can't start a transaction on a closed database
```

### ✅ Flux corrigé
```
1. Utilisateur clique sur un tool
2. Panel s'ouvre instantanément
3. saveUserLayout() vérifie _persistenceReady
   └─> Si false → mise en queue silencieuse (log debug uniquement)
   └─> Si true → sauvegarde immédiate dans IndexedDB
```

### ✅ Pas d'impact sur ton code document-library
Le problème était **exclusivement dans le framework**. Ton outil fonctionne correctement et devrait maintenant bénéficier d'un environnement sans erreurs au démarrage.

---

## Tests à Effectuer (Confirme SVP)

### Test 1 : Démarrage à froid
```bash
# Clear IndexedDB
1. Ouvrir DevTools → Application → Storage → Clear site data
2. Rafraîchir l'app (F5)
3. Cliquer immédiatement sur "Document Library" (ou autre tool)
```

**Vérifie** :
- ✅ Aucune erreur `closed database` dans la console
- ✅ Le panel s'ouvre normalement
- ✅ (Optionnel en DEV) Tu vois `IdeStore: Sauvegarde différée, persistance non prête` au lieu d'une exception

### Test 2 : Rehydration après refresh
```bash
1. Ouvre Document Library
2. Upload un fichier JSON
3. Clique sur le fichier (ouvre le viewer)
4. Rafraîchir la page (F5)
```

**Vérifie** :
- ✅ Le fichier est toujours dans l'arbre (persisté)
- ✅ Le viewer affiche le JSON (state restauré)
- ✅ Le fichier est highlighted dans l'arbre (selectedPath restauré)

### Test 3 : Session authentifiée
```bash
1. Se connecter avec Google OAuth
2. Ouvrir plusieurs tools
3. Rafraîchir
```

**Vérifie** :
- ✅ Les tools rouvrent automatiquement
- ✅ Aucune erreur IndexedDB au login

---

## Pourquoi le Retry Seul Ne Suffisait Pas

Tu as raison, **le retry existe déjà** dans `IndexedDBService` :
```javascript
if (!retryAttempted && this._shouldRetryDatabaseOperation(error)) {
  console.warn('IndexedDBService: Save failed due to closed database, retrying once', error)
  await this.initialize()
  return this.save(storeName, key, data, true)
}
```

**Mais** :
1. ❌ Pollue la console avec des erreurs/warnings
2. ❌ Ajoute de la latence (réouverture de DB)
3. ❌ Peut échouer si la DB n'est toujours pas prête après le retry

Avec le fix :
1. ✅ Pas d'erreur du tout (sauvegarde différée proprement)
2. ✅ Pas de latence (pas de retry inutile)
3. ✅ Garantie que la sauvegarde s'exécute quand l'infra est prête

---

## Documentation Complète

J'ai créé `_DOCS/FIX_IDXDB_RACE_CONDITION.md` avec :
- L'analyse détaillée du problème
- Le flux avant/après
- Les tests de validation
- Les considérations futures

---

## Prochaines Étapes

1. **Teste les scénarios ci-dessus** et confirme que les erreurs ont disparu
2. Si OK → ton code `document-library` devrait fonctionner sans friction
3. Si tu vois encore des erreurs → partage les logs, on creusera plus loin

Merci pour le diagnostic précis, ça a permis d'identifier et corriger un bug réel du framework ! 🎯

---

**TL;DR pour l'équipe** :
- ✅ Fix appliqué dans le framework (pas dans document-library)
- ✅ Race condition résolu via `persistence:ready` + flag de garde
- ✅ Aucune régression attendue (logique métier inchangée)
- ✅ Tests requis : démarrage à froid + rehydration
