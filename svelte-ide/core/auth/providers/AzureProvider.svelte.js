import { createLogger } from '../../../lib/logger.js'
import { AuthProvider } from '../AuthProvider.svelte.js'
import { createAzureConfigFromEnv } from './azure/azureConfig.svelte.js'
import { buildAuthorizeUrl, exchangeCodeForTokens, parseCallbackParams } from './azure/azureOAuth.svelte.js'
import { buildAccessTokensFromTokenData, getUserInfoFromIdToken } from './azure/azureTokens.svelte.js'
import { fetchAzureAvatarBlob, getAzureUserInfo } from './azure/azureProfile.svelte.js'
import { logRefreshTokenExpiry, refreshAzureTokens, refreshTokenWithScopes } from './azure/azureRefresh.svelte.js'

const logger = createLogger('core/auth/azure-provider')

export class AzureProvider extends AuthProvider {
  static fromEnv(env) {
    const config = createAzureConfigFromEnv(env)
    return new AzureProvider(config)
  }

  constructor(config) {
    super('azure', 'Microsoft Azure AD', config)
    this.authUrl = 'https://login.microsoftonline.com'
    this.scope = config.scopes || 'openid profile email User.Read'
  }

  requiredConfigKeys() {
    return ['clientId', 'tenantId']
  }

  async initialize() {
    await super.initialize()
  }

  async login() {
    const state = this.generateState()
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = await this.generateCodeChallenge(codeVerifier)

    this.storeState(state)
    sessionStorage.setItem(this.getStorageKey('code_verifier'), codeVerifier)

    const authUrl = buildAuthorizeUrl({
      authUrl: this.authUrl,
      tenantId: this.config.tenantId,
      clientId: this.config.clientId,
      redirectUri: this.getRedirectUri(),
      scope: this.scope,
      state,
      codeChallenge
    })

    let redirectHost = null
    try {
      redirectHost = new URL(authUrl).host
    } catch (_) {
      redirectHost = 'unknown'
    }
    logger.debug('Azure OAuth redirect initiated', {
      tenant: this.config.tenantId,
      redirectHost
    })

    window.location.href = authUrl

    return {
      success: true,
      redirected: true
    }
  }

  async handleOwnCallback() {
    logger.debug('Azure callback started')

    const { code, state, error, errorDescription } = parseCallbackParams(window.location.search)
    logger.debug('Azure callback parameters', { hasCode: !!code, hasState: !!state, error })

    if (error) {
      logger.error('Azure OAuth error', { error, errorDescription })
      return {
        success: false,
        error: `OAuth error: ${error} - ${errorDescription}`
      }
    }

    const storedState = this.consumeStoredState()
    const codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier'))

    logger.debug('Azure state validation', {
      hasState: !!state,
      hasStoredState: !!storedState,
      stateMatch: state && storedState ? state === storedState : false,
      hasCodeVerifier: !!codeVerifier
    })

    if (!state || !storedState) {
      logger.warn('Azure state validation failed: missing or expired state')
      return {
        success: false,
        error: 'Invalid or expired state parameter - possible CSRF attack'
      }
    }

    if (state !== storedState) {
      logger.warn('Azure state mismatch', { received: state, stored: storedState })
      return {
        success: false,
        error: 'Invalid state parameter - possible CSRF attack'
      }
    }

    if (!code) {
      logger.warn('No authorization code received from Azure')
      return {
        success: false,
        error: 'No authorization code received'
      }
    }

    sessionStorage.removeItem(this.getStorageKey('code_verifier'))

    try {
      logger.debug('Exchanging Azure authorization code for tokens')
      const tokenData = await exchangeCodeForTokens({
        authUrl: this.authUrl,
        tenantId: this.config.tenantId,
        clientId: this.config.clientId,
        code,
        codeVerifier,
        redirectUri: this.getRedirectUri()
      })
      logger.debug('Azure token exchange successful', {
        hasAccessToken: Boolean(tokenData.access_token),
        hasIdToken: Boolean(tokenData.id_token),
        hasRefreshToken: Boolean(tokenData.refresh_token),
        scope: tokenData.scope
      })

      logRefreshTokenExpiry(tokenData, 'initial-login')

      logger.debug('Extracting user info from ID token')
      const userInfo = getUserInfoFromIdToken(tokenData.id_token)
      logger.debug('Azure user info extracted', {
        hasEmail: Boolean(userInfo.email),
        hasName: Boolean(userInfo.name),
        sub: userInfo.sub
      })

      const requestScopedToken = tokenData.refresh_token
        ? async (scopes) => refreshTokenWithScopes({
          authUrl: this.authUrl,
          tenantId: this.config.tenantId,
          clientId: this.config.clientId,
          refreshToken: tokenData.refresh_token,
          scopes
        })
        : null

      const accessTokens = await buildAccessTokensFromTokenData({
        tokenData,
        scope: this.scope,
        refreshToken: tokenData.refresh_token,
        requestScopedToken
      })

      logger.debug('Azure callback processed successfully', {
        tokenCount: accessTokens.length,
        audiences: accessTokens.map(token => token.audience)
      })

      return {
        success: true,
        tokens: {
          accessTokens,
          refreshToken: tokenData.refresh_token,
          idToken: tokenData.id_token
        },
        userInfo
      }
    } catch (err) {
      logger.error('Azure callback processing error', err)
      return {
        success: false,
        error: err.message
      }
    }
  }

  async fetchAvatar({ tokens }) {
    return await fetchAzureAvatarBlob({
      authUrl: this.authUrl,
      tenantId: this.config.tenantId,
      clientId: this.config.clientId,
      accessTokens: tokens?.accessTokens,
      refreshToken: tokens?.refreshToken
    })
  }

  async getUserInfo(accessToken) {
    return await getAzureUserInfo(accessToken)
  }

  async refreshToken(refreshToken) {
    return await refreshAzureTokens({
      authUrl: this.authUrl,
      tenantId: this.config.tenantId,
      clientId: this.config.clientId,
      scope: this.scope,
      refreshToken
    })
  }

  async logout() {
    const logoutUrl = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`

    logger.debug('Azure logout - redirecting to Microsoft', {
      tenant: this.config.tenantId,
      redirectUri: window.location.origin
    })

    window.location.href = logoutUrl

    return { success: true, redirected: true }
  }
}
