import { createLogger } from '../../../../lib/logger.js'

const logger = createLogger('core/auth/google-provider')

export async function fetchGoogleUserInfo({ userInfoUrl, accessToken }) {
  const response = await fetch(userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch user info')
  }

  const userData = await response.json()

  logger.debug('Raw Google user data received', {
    hasId: Boolean(userData.sub || userData.id),
    hasEmail: Boolean(userData.email),
    hasPicture: Boolean(userData.picture)
  })

  const userId = userData.sub || userData.id
  const avatar = userData.picture || null

  return {
    sub: userId,
    id: userId,
    email: userData.email,
    name: userData.name,
    provider: 'google',
    avatar
  }
}
