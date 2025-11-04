import { TokenManager } from '@/core/auth/TokenManager.svelte.js'
import { authDebug, authWarn, authError } from '@/core/auth/authLogging.svelte.js'

export class AuthManager {
  constructor() {
    this.providers = new Map()
    this.activeProvider = null
    this.tokenManager = new TokenManager()
    this._isAuthenticated = false
    this._currentUser = null
    
    this.tokenManager.setAutoRefreshHandler(() => {
      this.refreshToken().catch(error => {
        authWarn('Auto-refresh failed', error)
      })
    })

    this.ready = this.tokenManager.ready.then(() => {
      return this.initializeAuthState()
    })
  }

  get isAuthenticated() {
    return this._isAuthenticated
  }

  get currentUser() {
    return this._currentUser
  }

  async initializeAuthState() {
    await this.tokenManager.ready

    const accessToken = this.tokenManager.getAccessToken()
    if (accessToken) {
      this._isAuthenticated = true
      this._currentUser = this.tokenManager.userInfo
    }
  }

  registerProvider(provider) {
    if (!provider || !provider.id) {
      throw new Error('Invalid provider')
    }
    this.providers.set(provider.id, provider)
    authDebug('Registered provider', { providerId: provider.id })
  }

  getAvailableProviders() {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      icon: provider.icon
    }))
  }

  findProviderForCallback(currentPath) {
    for (const [id, provider] of this.providers) {
      if (provider.canHandleCallback(currentPath)) {
        authDebug('Found provider for callback', { providerId: id, path: currentPath })
        return provider
      }
    }
    authDebug('No provider found for callback path', { path: currentPath })
    return null
  }

  async handleCallback() {
    await this.tokenManager.ready

    const currentPath = window.location.pathname
    authDebug('Handling callback', { path: currentPath })
    
    const provider = this.findProviderForCallback(currentPath)
    
    if (!provider) {
      authWarn('No provider can handle this callback', { path: currentPath })
      return {
        success: false,
        error: 'No provider found for this callback URL'
      }
    }

    authDebug('Delegating callback to provider', { providerId: provider.id })
    
    // Vérifier si on a déjà traité ce callback pour éviter les doubles traitements
    const callbackKey = `callback_processed_${provider.id}_${window.location.search}`
    if (sessionStorage.getItem(callbackKey)) {
      authWarn('Callback already processed, skipping', { providerId: provider.id })
      return { success: false, error: 'Callback already processed' }
    }
    
    const result = await provider.handleOwnCallback()
    
    if (result.success) {
      if (result.tokens?.accessToken && result.tokens?.expiresIn) {
        await this.tokenManager.setTokens(
          result.tokens.accessToken,
          result.tokens.refreshToken,
          result.tokens.expiresIn,
          result.userInfo
        )
      } else {
        await this.tokenManager.clear()
        this.tokenManager.userInfo = result.userInfo || null
      }
      this.activeProvider = provider
      this._isAuthenticated = true
      this._currentUser = result.userInfo
      
      authDebug('Authentication successful', { providerId: provider.id })
      
      // Marquer ce callback comme traité
      sessionStorage.setItem(callbackKey, 'true')
      
      // Nettoyer l'URL et rediriger vers la racine
      window.history.replaceState({}, document.title, window.location.origin + '/')
      
      // Nettoyer le marqueur après redirection
      setTimeout(() => sessionStorage.removeItem(callbackKey), 100)
    }
    
    return result
  }

  async login(providerId) {
    await this.tokenManager.ready

    const provider = this.providers.get(providerId)
    if (!provider) {
      return {
        success: false,
        error: `Provider ${providerId} not found`
      }
    }

    authDebug('Starting login', { providerId })
    const result = await provider.login()

    if (result?.redirected) {
      return result
    }

    if (result?.success) {
      if (result.tokens?.accessToken && result.tokens?.expiresIn) {
        await this.tokenManager.setTokens(
          result.tokens.accessToken,
          result.tokens.refreshToken,
          result.tokens.expiresIn,
          result.userInfo ?? null
        )
      } else {
        await this.tokenManager.clear()
        this.tokenManager.userInfo = result.userInfo ?? null
      }

      this.activeProvider = provider
      this._isAuthenticated = true
      this._currentUser = result.userInfo ?? null

      authDebug('Login completed successfully', { providerId })
    }

    return result
  }

  async logout() {
    await this.tokenManager.ready

    authDebug('Starting logout')
    
    try {
      if (this.activeProvider) {
        await this.activeProvider.logout()
      }
    } catch (error) {
      authWarn('Provider logout failed', error)
    }
    
    await this.tokenManager.clear()
    this.activeProvider = null
    this._isAuthenticated = false
    this._currentUser = null
    
    authDebug('Logout completed')
    
    return { success: true }
  }

  getAccessToken() {
    return this.tokenManager.getAccessToken()
  }

  async refreshToken() {
    await this.tokenManager.ready

    if (!this.activeProvider) {
      return {
        success: false,
        error: 'No active provider for token refresh'
      }
    }

    try {
      const refreshToken = this.tokenManager.getRefreshToken()
      if (!refreshToken) {
        return {
          success: false,
          error: 'No refresh token available'
        }
      }

      authDebug('Refreshing token', { providerId: this.activeProvider.id })
      const result = await this.activeProvider.refreshToken(refreshToken)
      
      if (result.success) {
        await this.tokenManager.setTokens(
          result.tokens.accessToken,
          result.tokens.refreshToken,
          result.tokens.expiresIn,
          this._currentUser
        )
        authDebug('Token refresh successful', { providerId: this.activeProvider.id })
        return { success: true, accessToken: result.tokens.accessToken }
      }
      
      authError('Token refresh failed', result.error)
      this._isAuthenticated = false
      this._currentUser = null
      await this.tokenManager.clear()
      
      return result
    } catch (error) {
      authError('Token refresh error', error)
      this._isAuthenticated = false
      this._currentUser = null
      await this.tokenManager.clear()
      
      return {
        success: false,
        error: error.message
      }
    }
  }

  async initializeProviders() {
    authDebug('Initializing providers')
    const successfulProviders = []
    const failedProviders = []
    
    for (const [id, provider] of this.providers) {
      try {
        await provider.initialize()
        successfulProviders.push(id)
        authDebug('Provider initialized', { providerId: id })
      } catch (error) {
        failedProviders.push({ id, error: error.message })
        authWarn('Failed to initialize provider', { providerId: id, error: error.message })
        // Retirer le provider défaillant
        this.providers.delete(id)
      }
    }
    
    authDebug('Initialization complete', {
      successful: successfulProviders.length,
      failed: failedProviders.length
    })
    
    if (this.providers.size === 0) {
      authWarn('No providers available after initialization')
    }
  }
}
