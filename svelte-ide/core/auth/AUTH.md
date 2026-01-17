# AUTH Module Design (SIDE)

This document describes the authentication module design for SIDE and the core principles used to keep the code simple, provider-agnostic, and maintainable.

## Goals
- Provide a single, consistent auth service to SIDE regardless of provider.
- Keep providers isolated to provider-specific logic only.
- Centralize token storage, refresh, and user profile enrichment in core.
- Keep configuration provider-agnostic and explicit.

## Core Components

### AuthManager
File: `svelte-ide/core/auth/AuthManager.svelte.js`

Responsibilities:
- Orchestrate login, callback handling, refresh, and logout.
- Coordinate `TokenManager` and `UserProfileService`.
- Keep minimal session state: `isAuthenticated`, `currentUser`, `activeProvider`.
- Notify `authStore` on session expiration.

Key behaviors:
- On startup, restore tokens and cached avatar, then derive encryption key.
- On callback/login, accept the canonical token payload, enrich user info, store tokens, and update state.
- On refresh, delegate to provider and update tokens on success; clear state on failure.
- On logout, clear local state first, then delegate to provider logout.

### TokenManager
File: `svelte-ide/core/auth/TokenManager.svelte.js`

Responsibilities:
- Store access tokens as a multi-audience map.
- Persist tokens based on configuration (memory/session/local).
- Encrypt stored tokens when an encryption key is provided.
- Auto-refresh tokens before expiration with retry and backoff.

Token model:
- Always multi-audience. There is no legacy single-token path.
- `getAccessToken()` accepts `null`, a string, or a list of scopes:
  - `null` returns the default token.
  - string is interpreted as audience or scope.
  - array requires all scopes to match.

### AuthProvider
File: `svelte-ide/core/auth/AuthProvider.svelte.js`

Responsibilities:
- Define the provider contract and common OAuth helpers.
- Provide PKCE and state handling utilities.
- Expose optional hints and avatar fetch hooks.

Required methods:
- `initialize()`
- `login()`
- `handleOwnCallback()`
- `refreshToken()`

Optional:
- `logout()`
- `getAuthHints()`
- `fetchAvatar()`

### UserProfileService
File: `svelte-ide/core/auth/profile/UserProfileService.svelte.js`

Responsibilities:
- Centralize avatar caching and enrichment.
- Apply cached avatars on reload.
- Fetch avatars through provider hooks when needed.

Avatar caching:
- Uses `AvatarCacheService` (IndexedDB).
- Stores and reuses avatar blobs across reloads.

### AuthStore
File: `svelte-ide/stores/authStore.svelte.js`

Responsibilities:
- Expose a reactive facade for UI components.
- Initialize providers and `AuthManager`.
- Provide session status and errors to UI.

Public state:
- `isAuthenticated`, `currentUser`, `isLoading`
- `availableProviders`, `initialized`
- `encryptionKey`, `hasEncryptionKey`, `sessionStatus`

## Canonical Contracts

### AuthTokens
```
{
  accessTokens: [
    {
      accessToken: string,
      audience: string | null,
      scopes: string[],
      expiresIn: number
    }
  ],
  refreshToken: string | null,
  idToken: string | null
}
```

### AuthResult
```
{
  success: boolean,
  redirected?: boolean,
  tokens?: AuthTokens,
  userInfo?: UserInfo,
  error?: string
}
```

### UserInfo
```
{
  sub: string,
  id: string,
  email: string | null,
  name: string | null,
  provider: string,
  avatar: string | null
}
```

Notes:
- Providers must always return `tokens.accessTokens` as an array (Google uses a 1-item array).
- Avatar is optional; it can be a URL on return and later cached by `UserProfileService`.

## Auth Flow Overview

### Initialization
1) `AuthStore.initialize()` builds providers and config.
2) `AuthManager` loads tokens from storage.
3) Cached avatar is applied if available.
4) Encryption key is derived if `currentUser` exists.

### Login
1) Provider `login()` redirects or returns tokens directly.
2) On success, `AuthManager` stores tokens and enriches user info.
3) `AuthStore` syncs state for UI.

### Callback
1) `AuthManager.handleCallback()` locates the right provider.
2) Provider returns canonical `AuthResult`.
3) `AuthManager` stores tokens, enriches user info, updates state, and cleans the URL.

### Refresh
1) `TokenManager` schedules refresh before expiry.
2) `AuthManager.refreshToken()` delegates to provider.
3) On success, tokens are replaced and encryption key updated.
4) On failure, session is cleared and UI is notified.

### Logout
1) Clear local tokens and user state.
2) Clear encryption key.
3) Delegate to provider logout (may redirect).

## Configuration and Security

### Provider-Agnostic Auth Config
File: `svelte-ide/core/auth/config/authConfig.svelte.js`

Inputs:
- Env vars (explicit overrides)
- Provider hints (security signals)
- Defaults

Resolution rule:
- The most restrictive value wins (memory < session < local).

Env variables:
- `VITE_AUTH_PROVIDERS` (comma-separated)
- `VITE_AUTH_TOKEN_PERSISTENCE` (memory|session|local)
- `VITE_AUTH_REFRESH_TOKEN_PERSISTENCE` (memory|session|local)
- `VITE_AUTH_TOKEN_ENCRYPTION_KEY` (base64 AES-GCM key)
- `VITE_AUTH_LOG_TOKEN_ACCESSES` (true|false)

### Encryption and Token Storage
File: `svelte-ide/core/security/tokenCipher.svelte.js`

Behavior:
- AES-GCM encryption if WebCrypto is available and a key is provided.
- Falls back to plaintext if encryption cannot be used.

### Encryption Key Derivation
File: `svelte-ide/core/auth/EncryptionKeyDerivation.svelte.js`

Behavior:
- Derives a base64 key using `appKey` and `userInfo.sub`.
- Stored in `authStore` for other services.
- Cleared on logout or session expiration.

## Provider-Specific Notes

### Provider Internal Structure
Providers are thin orchestrators. Provider-local helpers live under provider folders and are not part of the public API.

Azure helpers:
- `svelte-ide/core/auth/providers/azure/azureConfig.svelte.js` (env config + validation)
- `svelte-ide/core/auth/providers/azure/azureOAuth.svelte.js` (authorize URL, callback parsing, code exchange)
- `svelte-ide/core/auth/providers/azure/azureTokens.svelte.js` (token audience parsing, access token list)
- `svelte-ide/core/auth/providers/azure/azureProfile.svelte.js` (user info + avatar blob fetch)
- `svelte-ide/core/auth/providers/azure/azureRefresh.svelte.js` (refresh flows + expiry logging)

Google helpers:
- `svelte-ide/core/auth/providers/google/googleConfig.svelte.js` (env config + validation)
- `svelte-ide/core/auth/providers/google/googleOAuth.svelte.js` (authorize URL, callback parsing, code exchange)
- `svelte-ide/core/auth/providers/google/googleTokens.svelte.js` (token normalization)
- `svelte-ide/core/auth/providers/google/googleProfile.svelte.js` (user info)
- `svelte-ide/core/auth/providers/google/googleRefresh.svelte.js` (refresh flows)

### Google
File: `svelte-ide/core/auth/providers/GoogleProvider.svelte.js`

Features:
- Supports direct exchange or backend exchange.
- When backend exchange is enabled, provider hints request memory persistence.
- Returns a 1-item `accessTokens` array.
- Provides avatar URL via user info (cached by `UserProfileService`).

Env variables:
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_SCOPES`
- `VITE_GOOGLE_USE_BACKEND`
- `VITE_GOOGLE_BACKEND_TOKEN_URL`
- `VITE_GOOGLE_BACKEND_REFRESH_URL`
- `VITE_GOOGLE_BACKEND_CREDENTIALS`
- `VITE_GOOGLE_CLIENT_SECRET`
- `VITE_GOOGLE_ALLOW_INSECURE_SECRET`

### Azure
File: `svelte-ide/core/auth/providers/AzureProvider.svelte.js`

Features:
- Multi-audience token support (Graph + custom API).
- Fetches avatar through Microsoft Graph when available.
- Returns `accessTokens` array for all requested scopes.

Env variables:
- `VITE_AZURE_CLIENT_ID`
- `VITE_AZURE_TENANT_ID`
- `VITE_AZURE_SCOPES`

## Extension Guidelines
- Add a provider by extending `AuthProvider` and returning the canonical contract.
- Keep provider logic focused on OAuth and provider APIs only.
- Do not add storage logic inside providers.
- Use `getAuthHints()` only for security signals (not feature toggles).
- Use `fetchAvatar()` only to return a Blob or URL; caching is handled centrally.
