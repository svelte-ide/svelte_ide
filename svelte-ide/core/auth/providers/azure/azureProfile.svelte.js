import { createLogger } from '../../../../lib/logger.js'
import { extractAudienceFromToken, GRAPH_AUDIENCE } from './azureTokens.svelte.js'
import { refreshTokenWithScopes } from './azureRefresh.svelte.js'

const logger = createLogger('core/auth/azure-provider')

export async function fetchAzureAvatarBlob({
  authUrl,
  tenantId,
  clientId,
  accessTokens,
  refreshToken
}) {
  try {
    const accessToken = selectAvatarAccessToken(accessTokens)
    if (!accessToken) {
      return null
    }

    const graphToken = await resolveGraphToken({
      authUrl,
      tenantId,
      clientId,
      accessToken,
      refreshToken
    })
    if (!graphToken) {
      return null
    }

    const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: {
        'Authorization': `Bearer ${graphToken}`
      }
    })

    if (!photoResponse.ok) {
      logger.debug('Azure user profile photo unavailable (HTTP error)', { status: photoResponse.status })
      return null
    }

    return await photoResponse.blob()
  } catch (error) {
    logger.debug('Azure user profile photo unavailable (network error)', error)
    return null
  }
}

export async function getAzureUserInfo(accessToken) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch user info')
  }

  const userData = await response.json()
  const userId = userData.id

  return {
    sub: userId,
    id: userId,
    email: userData.mail || userData.userPrincipalName,
    name: userData.displayName,
    provider: 'azure',
    avatar: null
  }
}

function selectAvatarAccessToken(accessTokens) {
  if (!Array.isArray(accessTokens) || accessTokens.length === 0) {
    return null
  }
  const graphToken = accessTokens.find(token => token.audience === GRAPH_AUDIENCE)
  return graphToken?.accessToken || accessTokens[0].accessToken
}

async function resolveGraphToken({
  authUrl,
  tenantId,
  clientId,
  accessToken,
  refreshToken
}) {
  const audience = extractAudienceFromToken(accessToken)
  if (audience === GRAPH_AUDIENCE) {
    return accessToken
  }

  if (!refreshToken) {
    return null
  }

  logger.debug('Access token is not for Graph API, requesting Graph token', {
    currentAudience: audience
  })

  try {
    const graphTokenData = await refreshTokenWithScopes({
      authUrl,
      tenantId,
      clientId,
      refreshToken,
      scopes: 'https://graph.microsoft.com/User.Read'
    })
    logger.debug('Graph API token obtained for avatar download (temporary, not stored)')
    return graphTokenData.access_token
  } catch (refreshError) {
    logger.warn('Failed to obtain Graph token for avatar', refreshError)
    return null
  }
}
