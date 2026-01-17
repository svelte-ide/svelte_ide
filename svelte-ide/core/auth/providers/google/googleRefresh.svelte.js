import { createLogger } from '../../../../lib/logger.js'
import { buildGoogleTokens } from './googleTokens.svelte.js'

const logger = createLogger('core/auth/google-provider')

export async function refreshGoogleTokens({
  useBackendExchange,
  backendRefreshUrl,
  backendTokenUrl,
  backendHeaders,
  backendCredentials,
  tokenUrl,
  clientId,
  clientSecret,
  allowInsecureClientSecret,
  refreshToken,
  scope,
  providerId
}) {
  if (useBackendExchange) {
    const response = await fetch(backendRefreshUrl || backendTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...backendHeaders
      },
      credentials: backendCredentials,
      body: JSON.stringify({
        refreshToken,
        clientId,
        provider: providerId
      })
    })

    if (!response.ok) {
      let error
      try {
        error = await response.json()
      } catch (_) {
        error = await response.text()
      }
      logger.error('Google backend token refresh failed', error)
      const message =
        (error && (error.error_description || error.error || error.message)) ||
        'Token refresh failed'
      return {
        success: false,
        error: message
      }
    }

    const tokenData = await response.json()
    logger.debug('Google token refresh completed via backend')

    return {
      success: true,
      tokens: buildGoogleTokens(tokenData, scope, refreshToken)
    }
  }

  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  })

  const includeSecret = typeof clientSecret === 'string' && clientSecret.length > 0

  if (includeSecret) {
    params.set('client_secret', clientSecret)
  }

  logger.debug('Google token refresh payload (direct)', {
    hasSecret: params.has('client_secret'),
    allowInsecureClientSecret,
    configHasSecret: includeSecret
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  })

  if (!response.ok) {
    const error = await response.json()
    return {
      success: false,
      error: `Token refresh failed: ${error.error_description || error.error}`
    }
  }

  const tokenData = await response.json()

  return {
    success: true,
    tokens: buildGoogleTokens(tokenData, scope, refreshToken)
  }
}
