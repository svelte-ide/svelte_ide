import { createLogger } from '../../../../lib/logger.js'

const logger = createLogger('core/auth/google-provider')

export function buildAuthorizeUrl({
  authUrl,
  clientId,
  redirectUri,
  scope,
  state,
  codeChallenge
}) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent'
  })

  return `${authUrl}?${params}`
}

export function parseCallbackParams(search) {
  const urlParams = new URLSearchParams(search)
  return {
    code: urlParams.get('code'),
    state: urlParams.get('state'),
    error: urlParams.get('error'),
    errorDescription: urlParams.get('error_description')
  }
}

export async function exchangeGoogleCode({
  useBackendExchange,
  backendTokenUrl,
  backendHeaders,
  backendCredentials,
  tokenUrl,
  clientId,
  clientSecret,
  allowInsecureClientSecret,
  code,
  codeVerifier,
  redirectUri,
  providerId
}) {
  if (useBackendExchange) {
    const response = await fetch(backendTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...backendHeaders
      },
      credentials: backendCredentials,
      body: JSON.stringify({
        code,
        codeVerifier,
        redirectUri,
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
      logger.error('Google backend token exchange failed', error)
      const message =
        (error && (error.error_description || error.error || error.message)) ||
        'Backend token exchange failed'
      throw new Error(message)
    }

    logger.debug('Google token exchange completed via backend')
    return await response.json()
  }

  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  })

  const includeSecret = typeof clientSecret === 'string' && clientSecret.length > 0

  if (includeSecret) {
    params.set('client_secret', clientSecret)
  }

  logger.debug('Google token exchange payload (direct)', {
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
    let error
    try {
      error = await response.json()
    } catch (_) {
      error = await response.text()
    }
    logger.error('Google token exchange failed (direct)', error)
    const message =
      (error && (error.error_description || error.error || error.message)) ||
      'Token exchange failed'
    throw new Error(message)
  }

  logger.debug('Google token exchange completed via direct flow', {
    backend: false,
    includeSecret
  })
  return await response.json()
}
