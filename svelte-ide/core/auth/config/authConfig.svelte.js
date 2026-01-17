const ALLOWED_PERSISTENCE = new Set(['memory', 'session', 'local'])
const PERSISTENCE_ORDER = ['memory', 'session', 'local']

function normalize(value) {
  if (!value || typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function isAllowed(value) {
  return ALLOWED_PERSISTENCE.has(value)
}

function pickMostRestrictive(values) {
  let selected = null
  for (const value of values) {
    if (!isAllowed(value)) {
      continue
    }
    if (!selected) {
      selected = value
      continue
    }
    if (PERSISTENCE_ORDER.indexOf(value) < PERSISTENCE_ORDER.indexOf(selected)) {
      selected = value
    }
  }
  return selected
}

function collectProviderHints(providers) {
  const hints = []
  for (const provider of providers) {
    if (!provider || typeof provider.getAuthHints !== 'function') {
      continue
    }
    const hint = provider.getAuthHints()
    if (hint && typeof hint === 'object') {
      hints.push(hint)
    }
  }
  return hints
}

function resolveFromEnv(key) {
  const value = normalize(import.meta.env[key])
  return isAllowed(value) ? value : null
}

function resolvePersistence(envKey, hintedValue, fallbackValue) {
  const envValue = resolveFromEnv(envKey)
  const selected = pickMostRestrictive([envValue, hintedValue, fallbackValue])
  return selected || fallbackValue
}

export function resolveAuthConfig({ providers = [] } = {}) {
  const hints = collectProviderHints(providers)
  const hintedTokenPersistence = pickMostRestrictive(hints.map(hint => hint.tokenPersistence))
  const hintedRefreshPersistence = pickMostRestrictive(hints.map(hint => hint.refreshTokenPersistence))

  const persistence = resolvePersistence('VITE_AUTH_TOKEN_PERSISTENCE', hintedTokenPersistence, 'session')
  const refreshTokenPersistence = resolvePersistence('VITE_AUTH_REFRESH_TOKEN_PERSISTENCE', hintedRefreshPersistence, 'session')
  const encryptionKey = (import.meta.env.VITE_AUTH_TOKEN_ENCRYPTION_KEY || '').trim()
  const auditAccess = import.meta.env.VITE_AUTH_LOG_TOKEN_ACCESSES === 'true'

  return {
    persistence,
    refreshTokenPersistence,
    encryptionKey,
    auditAccess
  }
}
