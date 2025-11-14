import { AuthProvider } from '@svelte-ide/core/auth/AuthProvider.svelte.js'
import { authDebug, authWarn } from '@svelte-ide/core/auth/authLogging.svelte.js'
import * as jose from 'jose'

export class MockProvider extends AuthProvider {
  constructor(config = {}) {
    super('mock', 'Mock Provider', config)
    this.icon = '🧪'
    this.config = {
      simulateDelay: config.simulateDelay ?? 1000,
      shouldFail: config.shouldFail ?? false,
      jwtSecret: config.jwtSecret ?? 'default-dev-secret-change-in-production',
      userInfo: config.userInfo ?? {
        sub: 'mock-user-123', // Standard OAuth2/OIDC : 'sub' = subject (user ID)
        name: 'John Doe',
        email: 'john.doe@example.com',
        picture: '👨‍💻'
      },
      ...config
    }
  }

  requiredConfigKeys() {
    return []
  }

  canHandleCallback(currentPath) {
    // MockProvider ne gère pas de callback OAuth réel
    return false
  }

  async initialize() {
    await super.initialize()
  }

  async login() {
    authDebug('Mock provider starting authentication')
    
    if (this.config.simulateDelay > 0) {
      authDebug('Mock provider delay', { delayMs: this.config.simulateDelay })
      await new Promise(resolve => setTimeout(resolve, this.config.simulateDelay))
    }

    if (this.config.shouldFail) {
      authDebug('Mock provider simulating failure')
      return {
        success: false,
        error: 'Mock authentication failed (simulated)'
      }
    }

    const now = Math.floor(Date.now() / 1000)
    const expiresIn = 3600 // 1 heure

    const accessToken = await this.generateJWT({
      sub: this.config.userInfo.sub,
      name: this.config.userInfo.name,
      email: this.config.userInfo.email,
      picture: this.config.userInfo.picture,
      provider: 'mock',
      iat: now,
      exp: now + expiresIn
    })

    const refreshToken = await this.generateJWT({
      sub: this.config.userInfo.sub,
      type: 'refresh',
      provider: 'mock',
      iat: now,
      exp: now + (expiresIn * 24) // 24 heures pour le refresh token
    })

    const mockTokens = {
      accessToken,
      refreshToken,
      expiresIn
    }

    const userInfo = {
      ...this.config.userInfo,
      provider: 'mock',
      loginTime: new Date().toISOString()
    }

    authDebug('Mock provider authentication successful (JWT signed)')
    return {
      success: true,
      tokens: mockTokens,
      userInfo
    }
  }

  async handleOwnCallback() {
    // MockProvider ne devrait jamais être appelé pour un callback
    authWarn('Mock provider callback invoked unexpectedly')
    return {
      success: false,
      error: 'MockProvider does not handle OAuth callbacks'
    }
  }

  async logout() {
    authDebug('Mock provider starting logout')
    
    if (this.config.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    authDebug('Mock provider logout completed')
    return { success: true }
  }

  async refreshToken(refreshToken) {
    authDebug('Mock provider refreshing token')
    
    // Hook pour les tests : simuler des échecs de refresh
    if (typeof window !== 'undefined' && window.testAutoRefresh) {
      const shouldFail = window.testAutoRefresh.shouldSimulateRefreshFailure?.()
      if (shouldFail) {
        authWarn('Mock provider simulating refresh failure (test mode)')
        return {
          success: false,
          error: 'Simulated refresh failure for testing'
        }
      }
    }
    
    if (this.config.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    // Valider le refresh token JWT
    try {
      const secret = new TextEncoder().encode(this.config.jwtSecret)
      const { payload } = await jose.jwtVerify(refreshToken, secret)
      
      if (payload.type !== 'refresh' || payload.provider !== 'mock') {
        authWarn('Mock provider invalid refresh token payload')
        return {
          success: false,
          error: 'Invalid refresh token'
        }
      }

      const now = Math.floor(Date.now() / 1000)
      const expiresIn = 3600

      const newAccessToken = await this.generateJWT({
        sub: payload.sub,
        name: this.config.userInfo.name,
        email: this.config.userInfo.email,
        picture: this.config.userInfo.picture,
        provider: 'mock',
        iat: now,
        exp: now + expiresIn
      })

      const newTokens = {
        accessToken: newAccessToken,
        refreshToken: refreshToken, // Le refresh token reste valide
        expiresIn
      }

      authDebug('Mock provider token refresh successful (JWT signed)')
      return {
        success: true,
        tokens: newTokens
      }
    } catch (err) {
      authWarn('Mock provider refresh token verification failed', err)
      return {
        success: false,
        error: 'Invalid or expired refresh token'
      }
    }
  }

  /**
   * Génère un JWT signé avec HS256
   * @private
   */
  async generateJWT(payload) {
    const secret = new TextEncoder().encode(this.config.jwtSecret)
    return await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .sign(secret)
  }
}
