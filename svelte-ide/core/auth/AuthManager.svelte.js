import { createLogger } from '../../lib/logger.js'
import { deriveEncryptionKey } from './EncryptionKeyDerivation.svelte.js'
import { userProfileService } from './profile/UserProfileService.svelte.js'
import { TokenManager } from './TokenManager.svelte.js'

const logger = createLogger('core/auth/auth-manager')

export class AuthManager {
  constructor(config = {}) {
    this.providers = new Map()
    this.activeProvider = null
    this.tokenManager = new TokenManager(config)
    this._isAuthenticated = false
    this._currentUser = null
    this._authStoreRef = null
    this.initError = null
    
    this.tokenManager.setAutoRefreshHandler(() => {
      return this.refreshToken().catch(error => {
        logger.warn('Auto-refresh failed', error)
        return { success: false, error: error.message }
      })
    })

    this.tokenManager.setSessionExpiredHandler(() => {
      return this.handleSessionExpired()
    })

    this.ready = this.tokenManager.ready
      .then(() => this.initializeAuthState())
      .catch(error => {
        this.initError = error
      })
  }

  
  async handleSessionExpired() {
    logger.warn('Session expired, user needs to re-authenticate')
    
    this._isAuthenticated = false
    this._currentUser = null
    this._clearEncryptionKey()
    this.activeProvider = null

    
    if (this._authStoreRef?.handleSessionExpired) {
      try {
        this._authStoreRef.handleSessionExpired({
          message: 'Session expired. Please sign in again.'
        })
      } catch (storeError) {
        logger.warn('Failed to notify authStore about session expiration', storeError)
      }
    }
  }

  
  setAuthStoreRef(authStore) {
    this._authStoreRef = authStore
    logger.debug('AuthStore reference registered in AuthManager')
  }

  
  async _deriveAndSetEncryptionKey(userInfo) {
    if (!userInfo) {
      logger.warn('Cannot derive encryption key: userInfo is null')
      return
    }

    try {
      const encryptionKey = await deriveEncryptionKey(userInfo)
      
      if (this._authStoreRef) {
        this._authStoreRef.setEncryptionKey(encryptionKey)
        logger.debug('Encryption key derived and set in authStore')
      } else {
        logger.warn('AuthStore reference not available, encryption key not set')
      }
    } catch (error) {
      logger.error('Failed to derive encryption key', error)
      
      
    }
  }

  
  _clearEncryptionKey() {
    if (this._authStoreRef) {
      this._authStoreRef.clearEncryptionKey()
      logger.debug('Encryption key cleared from authStore')
    }
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

      if (this._currentUser) {
        this._currentUser = await userProfileService.applyCachedAvatar(this._currentUser)
        this.tokenManager.userInfo = this._currentUser
      }

      if (this._currentUser) {
        await this._deriveAndSetEncryptionKey(this._currentUser)
      }
    }
  }

  registerProvider(provider) {
    if (!provider || !provider.id) {
      throw new Error('Invalid provider')
    }
    this.providers.set(provider.id, provider)
    logger.debug('Registered provider', { providerId: provider.id })
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
        logger.debug('Found provider for callback', { providerId: id, path: currentPath })
        return provider
      }
    }
    logger.debug('No provider found for callback path', { path: currentPath })
    return null
  }

  async handleCallback() {
    await this.tokenManager.ready

    const currentPath = window.location.pathname
    logger.debug('Handling callback', { path: currentPath })
    
    const provider = this.findProviderForCallback(currentPath)
    
    if (!provider) {
      logger.warn('No provider can handle this callback', { path: currentPath })
      return {
        success: false,
        error: 'No provider found for this callback URL'
      }
    }

    logger.debug('Delegating callback to provider', { providerId: provider.id })
    
    
    const callbackKey = `callback_processed_${provider.id}_${window.location.search}`
    if (sessionStorage.getItem(callbackKey)) {
      logger.warn('Callback already processed, skipping', { providerId: provider.id })
      return { success: false, error: 'Callback already processed' }
    }
    
    const result = await provider.handleOwnCallback()
    
    if (result.success) {
      const tokensPayload = result.tokens || null
      let userInfo = result.userInfo || null

      if (tokensPayload?.accessTokens && Array.isArray(tokensPayload.accessTokens)) {
        if (userInfo) {
          userInfo = await userProfileService.enrichUserInfo(provider, userInfo, tokensPayload)
        }
        await this.tokenManager.setTokens(
          tokensPayload.accessTokens,
          tokensPayload.refreshToken || null,
          userInfo
        )
      } else {
        await this.tokenManager.clear()
        this.tokenManager.userInfo = userInfo
      }
      
      this.activeProvider = provider
      this._isAuthenticated = true
      this._currentUser = userInfo
      result.userInfo = userInfo
      
      
      await this._deriveAndSetEncryptionKey(userInfo)
      
      logger.debug('Authentication successful', { providerId: provider.id })
      
      
      sessionStorage.setItem(callbackKey, 'true')
      
      
      window.history.replaceState({}, document.title, window.location.origin + '/')
      
      
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

    logger.debug('Starting login', { providerId })
    const result = await provider.login()

    if (result?.redirected) {
      return result
    }

    if (result?.success) {
      const tokensPayload = result.tokens || null
      let userInfo = result.userInfo ?? null

      if (tokensPayload?.accessTokens && Array.isArray(tokensPayload.accessTokens)) {
        if (userInfo) {
          userInfo = await userProfileService.enrichUserInfo(provider, userInfo, tokensPayload)
        }
        await this.tokenManager.setTokens(
          tokensPayload.accessTokens,
          tokensPayload.refreshToken || null,
          userInfo
        )
      } else {
        await this.tokenManager.clear()
        this.tokenManager.userInfo = userInfo
      }

      this.activeProvider = provider
      this._isAuthenticated = true
      this._currentUser = userInfo
      result.userInfo = userInfo

      
      if (this._currentUser) {
        await this._deriveAndSetEncryptionKey(this._currentUser)
      }

      logger.debug('Login completed successfully', { providerId })
    }

    return result
  }

  async logout() {
    await this.tokenManager.ready

    logger.debug('Starting logout')
    
    await this.tokenManager.clear()
    const previousProvider = this.activeProvider
    this.activeProvider = null
    this._isAuthenticated = false
    this._currentUser = null
    
    
    this._clearEncryptionKey()
    
    
    
    
    
    logger.debug('Local state cleared, delegating to provider logout')
    
    
    
    try {
      if (previousProvider) {
        const result = await previousProvider.logout()
        
        logger.debug('Logout completed')
        return result
      }
    } catch (error) {
      logger.warn('Provider logout failed', error)
    }
    
    logger.debug('Logout completed')
    return { success: true }
  }

  getAccessToken(audienceOrScopes) {
    return this.tokenManager.getAccessToken(audienceOrScopes)
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

      logger.debug('Refreshing token', { providerId: this.activeProvider.id })
      const result = await this.activeProvider.refreshToken(refreshToken)
      
      if (result.success) {
        const tokensPayload = result.tokens || null
        if (tokensPayload?.accessTokens && Array.isArray(tokensPayload.accessTokens)) {
          await this.tokenManager.setTokens(
            tokensPayload.accessTokens,
            tokensPayload.refreshToken || refreshToken,
            this._currentUser
          )
        } else {
          logger.warn('Refresh response missing tokens payload')
          return {
            success: false,
            error: 'No tokens returned by provider'
          }
        }
        
        
        
        if (this._currentUser) {
          await this._deriveAndSetEncryptionKey(this._currentUser)
        }
        
        logger.debug('Token refresh successful', { providerId: this.activeProvider.id })
        return { success: true, accessToken: this.tokenManager.getAccessToken() }
      }
      
      logger.error('Token refresh failed', result.error)
      this._isAuthenticated = false
      this._currentUser = null
      this._clearEncryptionKey()
      await this.tokenManager.clear()
      
      return result
    } catch (error) {
      logger.error('Token refresh error', error)
      this._isAuthenticated = false
      this._currentUser = null
      this._clearEncryptionKey()
      await this.tokenManager.clear()
      
      return {
        success: false,
        error: error.message
      }
    }
  }

  async initializeProviders() {
    logger.debug('Initializing providers')
    const successfulProviders = []
    const failedProviders = []
    
    for (const [id, provider] of this.providers) {
      try {
        await provider.initialize()
        successfulProviders.push(id)
        logger.debug('Provider initialized', { providerId: id })
      } catch (error) {
        failedProviders.push({ id, error: error.message })
        logger.warn('Failed to initialize provider', { providerId: id, error: error.message })
        
        this.providers.delete(id)
      }
    }
    
    logger.debug('Initialization complete', {
      successful: successfulProviders.length,
      failed: failedProviders.length
    })
    
    if (this.providers.size === 0) {
      logger.warn('No providers available after initialization')
      return
    }
    
    
    if (this._isAuthenticated && this._currentUser?.provider && !this.activeProvider) {
      this.activeProvider = this.providers.get(this._currentUser.provider)
      if (this.activeProvider) {
        logger.debug('Active provider restored after page reload', { 
          providerId: this._currentUser.provider 
        })
      } else {
        logger.warn('Cannot restore active provider: provider not registered', { 
          providerId: this._currentUser.provider 
        })
      }
    }
  }
}
