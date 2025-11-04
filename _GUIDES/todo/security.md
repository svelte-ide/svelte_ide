# Sujets de securite a adresser

1. **Generer un `state` OAuth robuste**
   - Utiliser `crypto.getRandomValues` au lieu de `Math.random` dans `AuthProvider.generateState`.
   - Envisager de stocker le `state` dans `sessionStorage` avec un TTL pour limiter les replays.

2. **Eviter l exposition du client secret Google**
   - Migrer vers un flux PKCE pour clients publics (sans `clientSecret`) ou realiser l echange de code via un backend securise.
   - Documenter la configuration recommande (SPA vs serveur) et verifier la detection.

3. **Durcir le stockage des jetons**
   - Un refresh/access token reside en clair dans `localStorage`; prevoir un chiffrement ou un passage vers des cookies httpOnly fournis cote serveur.
   - Ajouter un mecanisme CSP/XSS mitigation et surveiller les acces aux tokens (no logging).

4. **Desactiver le MockProvider en production**
   - Introduire un flag d environnement exigeant `VITE_AUTH_PROVIDERS` explicite pour build prod.
   - Option: ajouter un avertissement bloqueur si MockProvider est actif hors mode dev.

5. **Completer l auto-refresh**
   - `TokenManager.setupAutoRefresh` n invoque aucune logique: intégrer un rappel vers `AuthManager.refreshToken()` ou avertir l utilisateur avant expiration.

6. **Nettoyer les logs sensibles**
   - Filtrer (`console.log`) pour eviter d exposer tokens/codes.
   - Prevoir un mode production qui neutralise les traces verbeuses.
