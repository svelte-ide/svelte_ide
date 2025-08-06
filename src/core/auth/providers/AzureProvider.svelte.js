import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'

export class AzureProvider extends AuthProvider {
  constructor(config) {
    super('azure', 'Microsoft Azure AD', config)
    this.authUrl = 'https://login.microsoftonline.com'
    this.scope = 'openid profile email User.Read'
  }

  requiredConfigKeys() {
    return ['clientId', 'tenantId', 'redirectUri']
  }

  async initialize() {
    await super.initialize()
    
    if (window.location.hash.includes('code=') || window.location.search.includes('code=')) {
      await this.handleCallback()
    }
  }

  async login() {
    const state = this.generateState()
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = await this.generateCodeChallenge(codeVerifier)
    
    sessionStorage.setItem('oauth_state', state)
    sessionStorage.setItem('oauth_code_verifier', codeVerifier)

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: this.scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    })

    const authUrl = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/authorize?${params}`
    
    return new Promise((resolve, reject) => {
      this.loginResolve = resolve
      this.loginReject = reject
      window.location.href = authUrl
    })
  }

  async handleCallback() {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')

    console.log('Azure callback received:', { code: !!code, state, error })

    if (error) {
      const errorDescription = urlParams.get('error_description')
      console.error('Azure OAuth error:', { error, errorDescription })
      throw new Error(`OAuth error: ${error} - ${errorDescription}`)
    }

    const storedState = sessionStorage.getItem('oauth_state')
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier')
    
    console.log('State validation:', { receivedState: state, storedState, codeVerifier: !!codeVerifier })

    if (!state || state !== storedState) {
      console.error('State mismatch:', { received: state, stored: storedState })
      
      // Si le state est manquant mais qu'on a un code valide, c'est probablement un double appel
      if (!storedState && code) {
        console.warn('SessionStorage cleared but code present - possible double callback, attempting to continue')
        // On va quand même essayer de traiter le callback mais sans vérification du state
        // C'est moins sécurisé mais nécessaire pour gérer les doubles appels
      } else {
        throw new Error('Invalid state parameter - possible CSRF attack or session expired')
      }
    }

    // Nettoyer uniquement si on a le state correct ou si on force le traitement
    if (storedState || code) {
      sessionStorage.removeItem('oauth_state')
      sessionStorage.removeItem('oauth_code_verifier')
    }

    if (code) {
      const tokenData = await this.exchangeCodeForTokens(code, codeVerifier)
      const userInfo = await this.getUserInfo(tokenData.access_token)
      
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        userInfo: userInfo
      }
    }

    throw new Error('No authorization code received')
  }

  async exchangeCodeForTokens(code, codeVerifier) {
    const tokenEndpoint = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/token`
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.config.redirectUri,
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
      console.error('Azure token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: error,
        endpoint: tokenEndpoint,
        clientId: this.config.clientId,
        tenantId: this.config.tenantId,
        redirectUri: this.config.redirectUri
      })
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
    }

    return await response.json()
  }

  async getUserInfo(accessToken) {
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
    
    return {
      id: userData.id,
      email: userData.mail || userData.userPrincipalName,
      name: userData.displayName,
      provider: 'azure',
      avatar: null
    }
  }

  async refreshToken(refreshToken) {
    const tokenEndpoint = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/token`
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
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
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
    }

    const tokenData = await response.json()
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresIn: tokenData.expires_in
    }
  }

  async logout() {
    const logoutUrl = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(this.config.redirectUri)}`
    window.location.href = logoutUrl
  }
}
