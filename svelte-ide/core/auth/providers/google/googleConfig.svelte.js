import { createLogger } from '../../../../lib/logger.js'

const logger = createLogger('core/auth/google-provider')

export function createGoogleConfigFromEnv(env) {
  const clientId = typeof env?.VITE_GOOGLE_CLIENT_ID === 'string'
    ? env.VITE_GOOGLE_CLIENT_ID.trim()
    : ''
  const scopes = typeof env?.VITE_GOOGLE_SCOPES === 'string'
    ? env.VITE_GOOGLE_SCOPES.trim()
    : ''
  const backendTokenUrl = typeof env?.VITE_GOOGLE_BACKEND_TOKEN_URL === 'string'
    ? env.VITE_GOOGLE_BACKEND_TOKEN_URL.trim()
    : ''
  const backendRefreshUrl = typeof env?.VITE_GOOGLE_BACKEND_REFRESH_URL === 'string'
    ? env.VITE_GOOGLE_BACKEND_REFRESH_URL.trim()
    : ''
  const backendCredentials = env?.VITE_GOOGLE_BACKEND_CREDENTIALS
  const useBackendExchange = env?.VITE_GOOGLE_USE_BACKEND === 'true' || env?.VITE_GOOGLE_USE_BACKEND === '1'
  const clientSecret = typeof env?.VITE_GOOGLE_CLIENT_SECRET === 'string'
    ? env.VITE_GOOGLE_CLIENT_SECRET.trim()
    : ''

  if (!clientId) {
    throw new Error('AuthStore: Google provider requires VITE_GOOGLE_CLIENT_ID')
  }

  const useBackend = useBackendExchange || Boolean(backendTokenUrl) || Boolean(backendRefreshUrl)

  if (useBackend && !backendTokenUrl) {
    throw new Error('AuthStore: Google backend exchange requires VITE_GOOGLE_BACKEND_TOKEN_URL')
  }

  if (clientSecret) {
    throw new Error('AuthStore: Google client secret is not allowed in frontend builds. Use backend exchange instead.')
  }

  const config = { clientId }
  if (scopes) {
    config.scopes = scopes
  }

  if (useBackend) {
    config.useBackendExchange = true
    if (backendTokenUrl) {
      config.backendTokenUrl = backendTokenUrl
    }
    if (backendRefreshUrl) {
      config.backendRefreshUrl = backendRefreshUrl
    }
    if (backendCredentials) {
      config.backendCredentials = backendCredentials
    }
  }

  return config
}

export function normalizeGoogleConfig(config) {
  const normalizedConfig = { ...config }
  const secret =
    typeof normalizedConfig.clientSecret === 'string' ? normalizedConfig.clientSecret.trim() : ''

  logger.debug('Google provider config received', {
    receivedClientSecret: !!normalizedConfig.clientSecret,
    trimmedSecretLength: secret.length
  })

  if (secret) {
    throw new Error('GoogleProvider: clientSecret is not supported in frontend builds. Remove it and use backend exchange.')
  }

  delete normalizedConfig.clientSecret
  delete normalizedConfig.allowInsecureClientSecret

  const allowInsecureClientSecret = false

  logger.debug('Google provider config evaluated', {
    allowInsecureClientSecret,
    storedSecretLength: 0
  })

  const wantsBackend =
    normalizedConfig.useBackendExchange === true ||
    (typeof normalizedConfig.useBackendExchange === 'string' &&
      (normalizedConfig.useBackendExchange.toLowerCase() === 'true' || normalizedConfig.useBackendExchange === '1'))

  const backendTokenUrl =
    typeof normalizedConfig.backendTokenUrl === 'string'
      ? normalizedConfig.backendTokenUrl.trim()
      : null
  const backendRefreshUrl =
    typeof normalizedConfig.backendRefreshUrl === 'string'
      ? normalizedConfig.backendRefreshUrl.trim()
      : null

  const useBackendExchange = wantsBackend || !!backendTokenUrl || !!backendRefreshUrl

  if (useBackendExchange && !backendTokenUrl) {
    throw new Error('GoogleProvider: backend exchange enabled but backendTokenUrl is missing')
  }

  let backendHeaders = {}
  let backendCredentials = 'include'

  if (useBackendExchange) {
    const headers =
      normalizedConfig.backendHeaders && typeof normalizedConfig.backendHeaders === 'object'
        ? normalizedConfig.backendHeaders
        : null
    backendHeaders = headers ? { ...headers } : {}

    if (normalizedConfig.backendCredentials !== undefined) {
      if (typeof normalizedConfig.backendCredentials === 'boolean') {
        backendCredentials = normalizedConfig.backendCredentials ? 'include' : 'omit'
      } else if (typeof normalizedConfig.backendCredentials === 'string') {
        backendCredentials = normalizedConfig.backendCredentials
      }
    }
  }

  normalizedConfig.useBackendExchange = useBackendExchange
  normalizedConfig.backendTokenUrl = backendTokenUrl || null
  normalizedConfig.backendRefreshUrl = backendRefreshUrl || backendTokenUrl || null

  return {
    config: normalizedConfig,
    allowInsecureClientSecret,
    useBackendExchange,
    backendTokenUrl: backendTokenUrl || null,
    backendRefreshUrl: backendRefreshUrl || backendTokenUrl || null,
    backendHeaders,
    backendCredentials
  }
}
