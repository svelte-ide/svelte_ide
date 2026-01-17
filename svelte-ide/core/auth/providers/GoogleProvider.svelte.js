import { createLogger } from '../../../lib/logger.js'
import { AuthProvider } from '../AuthProvider.svelte.js'
import { createGoogleConfigFromEnv, normalizeGoogleConfig } from './google/googleConfig.svelte.js'
import { buildAuthorizeUrl, exchangeGoogleCode, parseCallbackParams } from './google/googleOAuth.svelte.js'
import { buildGoogleTokens } from './google/googleTokens.svelte.js'
import { fetchGoogleUserInfo } from './google/googleProfile.svelte.js'
import { refreshGoogleTokens } from './google/googleRefresh.svelte.js'

const logger = createLogger('core/auth/google-provider')

export class GoogleProvider extends AuthProvider {
  static fromEnv(env) {
    const config = createGoogleConfigFromEnv(env)
    return new GoogleProvider(config)
  }

  constructor(config) {
    super('google', 'Google', config)
    this.authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    this.tokenUrl = 'https://oauth2.googleapis.com/token'
    this.userInfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo'

    const configuredScope = typeof config.scopes === 'string' ? config.scopes.trim() : ''
    this.scope = configuredScope && configuredScope.length > 0 ? configuredScope : 'openid profile email'
    this.useBackendExchange = this.useBackendExchange ?? false
    this.backendTokenUrl = this.backendTokenUrl ?? null
    this.backendRefreshUrl = this.backendRefreshUrl ?? this.backendTokenUrl
    this.backendHeaders = this.backendHeaders ?? {}
    this.backendCredentials = this.backendCredentials ?? 'include'
    this.allowInsecureClientSecret = this.allowInsecureClientSecret ?? false
  }

  requiredConfigKeys() {
    return ['clientId']
  }

  getAuthHints() {
    if (this.useBackendExchange) {
      return { tokenPersistence: 'memory', refreshTokenPersistence: 'memory' }
    }
    return {}
  }

  validateConfig() {
    super.validateConfig()

    if (!this.isConfigured) {
      return
    }

    const normalized = normalizeGoogleConfig(this.config)
    this.config = normalized.config
    this.allowInsecureClientSecret = normalized.allowInsecureClientSecret
    this.useBackendExchange = normalized.useBackendExchange
    this.backendTokenUrl = normalized.backendTokenUrl
    this.backendRefreshUrl = normalized.backendRefreshUrl
    this.backendHeaders = normalized.backendHeaders
    this.backendCredentials = normalized.backendCredentials
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
    logger.debug('Google OAuth redirect initiated', {
      hasBackendExchange: this.useBackendExchange,
      redirectHost
    })

    window.location.href = authUrl

    return {
      success: true,
      redirected: true
    }
  }

  async handleOwnCallback() {
    logger.debug('Google callback started')

    const { code, state, error, errorDescription } = parseCallbackParams(window.location.search)

    logger.debug('Google callback parameters', { hasCode: !!code, hasState: !!state, error })

    if (error) {
      logger.error('Google OAuth error', { error, errorDescription })
      return {
        success: false,
        error: `OAuth error: ${error} - ${errorDescription}`
      }
    }

    const storedState = this.consumeStoredState()
    const codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier'))

    logger.debug('Google state validation', {
      hasUrlState: !!state,
      hasStoredState: !!storedState,
      stateMatch: state && storedState ? state === storedState : false,
      hasCodeVerifier: !!codeVerifier
    })

    if (!state || !storedState) {
      logger.warn('Google state validation failed: missing or expired state')
      return {
        success: false,
        error: 'Invalid or expired state parameter - possible CSRF attack'
      }
    }

    if (state !== storedState) {
      logger.warn('Google state validation failed', { received: state, stored: storedState })
      return {
        success: false,
        error: 'Invalid state parameter - possible CSRF attack'
      }
    }

    if (!code) {
      logger.warn('No authorization code received from Google')
      return {
        success: false,
        error: 'No authorization code received'
      }
    }

    sessionStorage.removeItem(this.getStorageKey('code_verifier'))

    try {
      logger.debug('Exchanging Google authorization code for tokens')
      const tokenData = await exchangeGoogleCode({
        useBackendExchange: this.useBackendExchange,
        backendTokenUrl: this.backendTokenUrl,
        backendHeaders: this.backendHeaders,
        backendCredentials: this.backendCredentials,
        tokenUrl: this.tokenUrl,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        allowInsecureClientSecret: this.allowInsecureClientSecret,
        code,
        codeVerifier,
        redirectUri: this.getRedirectUri(),
        providerId: this.id
      })
      logger.debug('Google token exchange successful')

      logger.debug('Fetching Google user info')
      const userInfo = await fetchGoogleUserInfo({
        userInfoUrl: this.userInfoUrl,
        accessToken: tokenData.access_token
      })
      logger.debug('Google user info received', {
        hasEmail: Boolean(userInfo.email),
        hasName: Boolean(userInfo.name),
        hasAvatar: Boolean(userInfo.avatar)
      })

      logger.debug('Google callback processed successfully')
      return {
        success: true,
        tokens: buildGoogleTokens(tokenData, this.scope, null),
        userInfo
      }
    } catch (err) {
      logger.error('Google callback processing error', err)
      return {
        success: false,
        error: err.message
      }
    }
  }

  async getUserInfo(accessToken) {
    return await fetchGoogleUserInfo({
      userInfoUrl: this.userInfoUrl,
      accessToken
    })
  }

  async refreshToken(refreshToken) {
    return await refreshGoogleTokens({
      useBackendExchange: this.useBackendExchange,
      backendRefreshUrl: this.backendRefreshUrl,
      backendTokenUrl: this.backendTokenUrl,
      backendHeaders: this.backendHeaders,
      backendCredentials: this.backendCredentials,
      tokenUrl: this.tokenUrl,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      allowInsecureClientSecret: this.allowInsecureClientSecret,
      refreshToken,
      scope: this.scope,
      providerId: this.id
    })
  }

  async logout() {
    const logoutUrl = `https://accounts.google.com/logout`
    window.open(logoutUrl, '_blank', 'width=1,height=1')
  }
}
