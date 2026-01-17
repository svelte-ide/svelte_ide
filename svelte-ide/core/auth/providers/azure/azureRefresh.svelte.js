import { createLogger } from '../../../../lib/logger.js'
import { extractAudienceFromToken } from './azureTokens.svelte.js'

const logger = createLogger('core/auth/azure-provider')

export async function refreshTokenWithScopes({
  authUrl,
  tenantId,
  clientId,
  refreshToken,
  scopes
}) {
  logger.debug('Requesting token with specific scopes via refresh', { scopes })

  const tokenEndpoint = `${authUrl}/${tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: scopes
  })

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  })

  if (!response.ok) {
    const error = await response.json()
    logger.error('Token refresh with scopes failed', {
      status: response.status,
      error,
      requestedScopes: scopes
    })
    throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
  }

  const tokenData = await response.json()
  logger.debug('Token with specific scopes obtained', {
    scopes,
    hasAccessToken: Boolean(tokenData.access_token)
  })

  return tokenData
}

export async function refreshAzureTokens({
  authUrl,
  tenantId,
  clientId,
  scope,
  refreshToken
}) {
  const scopeList = (scope || '').split(' ').filter(Boolean)
  const customApiScopes = scopeList.filter(item => item.startsWith('api://'))
  const graphScopes = scopeList.filter(item => !item.startsWith('api://'))

  const accessTokens = []
  let latestRefreshToken = refreshToken

  const pushTokenData = (tokenData, requestedScopes, label) => {
    if (!tokenData?.access_token || !tokenData?.expires_in) {
      logger.warn('Azure refresh did not return an access token', { label })
      return
    }

    const scopes = (tokenData.scope || requestedScopes || '').split(' ').filter(Boolean)
    const audience = extractAudienceFromToken(tokenData.access_token)

    accessTokens.push({
      accessToken: tokenData.access_token,
      audience,
      scopes,
      expiresIn: tokenData.expires_in
    })

    if (tokenData.refresh_token) {
      latestRefreshToken = tokenData.refresh_token
    }

    logRefreshTokenExpiry(tokenData, label)

    logger.debug('Azure refresh token obtained', {
      label,
      audience,
      scopes,
      hasRefreshToken: Boolean(tokenData.refresh_token)
    })
  }

  try {
    if (customApiScopes.length > 0) {
      try {
        const requestedScopes = customApiScopes.join(' ')
        const customTokenData = await refreshTokenWithScopes({
          authUrl,
          tenantId,
          clientId,
          refreshToken: latestRefreshToken,
          scopes: requestedScopes
        })
        pushTokenData(customTokenData, requestedScopes, 'custom-api')
      } catch (error) {
        logger.warn('Azure refresh for custom API scopes failed', error)
      }
    }

    if (graphScopes.length > 0) {
      try {
        const requestedScopes = graphScopes.join(' ')
        const graphTokenData = await refreshTokenWithScopes({
          authUrl,
          tenantId,
          clientId,
          refreshToken: latestRefreshToken,
          scopes: requestedScopes
        })
        pushTokenData(graphTokenData, requestedScopes, 'graph-api')
      } catch (error) {
        logger.warn('Azure refresh for graph scopes failed', error)
      }
    }

    if (accessTokens.length === 0) {
      const tokenEndpoint = `${authUrl}/${tenantId}/oauth2/v2.0/token`

      const params = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })

      const response = await fetch(tokenEndpoint, {
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

      const fallbackTokenData = await response.json()
      pushTokenData(fallbackTokenData, fallbackTokenData.scope, 'fallback')
    }

    if (accessTokens.length === 0) {
      return {
        success: false,
        error: 'Token refresh failed: no access token returned'
      }
    }

    return {
      success: true,
      tokens: {
        accessTokens,
        refreshToken: latestRefreshToken
      }
    }
  } catch (error) {
    logger.error('Azure token refresh failed', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export function logRefreshTokenExpiry(tokenData, context) {
  const expiryInfo = computeRefreshTokenExpiry(tokenData)
  if (!expiryInfo) {
    return
  }

  logger.debug('Azure refresh token expiry', {
    context,
    expiresAt: expiryInfo.expiresAt.toLocaleString(),
    remainingSeconds: Math.round(expiryInfo.remainingMs / 1000)
  })
}

function computeRefreshTokenExpiry(tokenData) {
  if (!tokenData) {
    return null
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresIn = Number(tokenData.refresh_token_expires_in)
  const expiresOn = Number(tokenData.refresh_token_expires_on)

  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    const remainingMs = expiresIn * 1000
    return {
      remainingMs,
      expiresAt: new Date(Date.now() + remainingMs)
    }
  }

  if (Number.isFinite(expiresOn) && expiresOn > nowSeconds) {
    const remainingMs = (expiresOn - nowSeconds) * 1000
    return {
      remainingMs,
      expiresAt: new Date(expiresOn * 1000)
    }
  }

  return null
}
