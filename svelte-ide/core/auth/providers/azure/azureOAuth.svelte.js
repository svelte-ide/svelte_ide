import { createLogger } from '../../../../lib/logger.js'

const logger = createLogger('core/auth/azure-provider')

export function buildAuthorizeUrl({
  authUrl,
  tenantId,
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
    code_challenge_method: 'S256'
  })

  return `${authUrl}/${tenantId}/oauth2/v2.0/authorize?${params}`
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

export async function exchangeCodeForTokens({
  authUrl,
  tenantId,
  clientId,
  code,
  codeVerifier,
  redirectUri
}) {
  const tokenEndpoint = `${authUrl}/${tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
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
    logger.error('Azure token exchange failed', {
      status: response.status,
      statusText: response.statusText,
      error,
      endpoint: tokenEndpoint
    })
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
  }

  return await response.json()
}
