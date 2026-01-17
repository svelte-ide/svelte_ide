import { createLogger } from '../../../../lib/logger.js'

const logger = createLogger('core/auth/azure-provider')

export const GRAPH_AUDIENCE = '00000003-0000-0000-c000-000000000000'

export function extractAudienceFromToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return 'unknown'
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.aud || 'unknown'
  } catch (error) {
    logger.warn('Failed to extract audience from token', error)
    return 'unknown'
  }
}

export function getUserInfoFromIdToken(idToken) {
  try {
    const parts = idToken.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid ID token format')
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    logger.debug('ID Token payload decoded', {
      oid: payload.oid,
      preferred_username: payload.preferred_username,
      name: payload.name
    })

    return {
      sub: payload.oid,
      id: payload.oid,
      email: payload.email || payload.preferred_username,
      name: payload.name,
      provider: 'azure',
      avatar: null
    }
  } catch (error) {
    logger.error('Failed to decode ID token', error)
    throw new Error('Failed to extract user info from ID token')
  }
}

function splitScopes(value) {
  if (!value || typeof value !== 'string') {
    return []
  }
  return value.split(' ').filter(Boolean)
}

function getCustomApiScopes(scope) {
  return splitScopes(scope).filter(item => item.startsWith('api://'))
}

function getExpectedAudience(customApiScopes) {
  if (!Array.isArray(customApiScopes) || customApiScopes.length === 0) {
    return null
  }
  return customApiScopes[0].split('/').slice(0, 3).join('/')
}

export async function buildAccessTokensFromTokenData({
  tokenData,
  scope,
  refreshToken,
  requestScopedToken
}) {
  const accessTokens = []
  const scopesList = splitScopes(tokenData.scope || scope)
  const audience = extractAudienceFromToken(tokenData.access_token)

  accessTokens.push({
    accessToken: tokenData.access_token,
    audience,
    scopes: scopesList,
    expiresIn: tokenData.expires_in
  })

  const customApiScopes = getCustomApiScopes(scope)

  logger.debug('Checking for custom API scopes', {
    allScopes: scope,
    customApiScopes,
    customApiScopesCount: customApiScopes.length,
    currentAudience: audience
  })

  if (customApiScopes.length > 0) {
    const expectedAudience = getExpectedAudience(customApiScopes)

    logger.debug('Evaluating if refresh is needed', {
      audience,
      expectedAudience,
      isGraphAPI: audience === GRAPH_AUDIENCE,
      needsRefresh: audience !== expectedAudience && audience === GRAPH_AUDIENCE
    })

    if (audience !== expectedAudience && audience === GRAPH_AUDIENCE && refreshToken && requestScopedToken) {
      logger.debug('Token received is for Graph API, requesting custom API token with refresh', {
        currentAudience: audience,
        expectedAudience
      })

      try {
        const customTokenData = await requestScopedToken(customApiScopes.join(' '))
        if (customTokenData) {
          const customAudience = extractAudienceFromToken(customTokenData.access_token)
          accessTokens.push({
            accessToken: customTokenData.access_token,
            audience: customAudience,
            scopes: customApiScopes,
            expiresIn: customTokenData.expires_in
          })
          logger.debug('Custom API token obtained via refresh', {
            audience: customAudience,
            scopes: customApiScopes
          })
        }
      } catch (refreshError) {
        logger.warn('Failed to obtain custom API token via refresh', refreshError)
      }
    }
  }

  return accessTokens
}
