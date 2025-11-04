import { namespacedKey } from '@/core/config/appKey.js'
import { getTokenSecurityConfig } from '@/core/auth/tokenSecurityConfig.svelte.js'
import { TokenCipher } from '@/core/security/tokenCipher.svelte.js'

const STORAGE_KEY = namespacedKey('auth-tokens')

function selectStorage(persistence) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    if (persistence === 'local') {
      return window.localStorage
    }
    if (persistence === 'session') {
      return window.sessionStorage
    }
  } catch (error) {
    console.warn('TokenManager: Storage unavailable, falling back to in-memory tokens', error)
  }

  return null
}

function sanitizeToken(token) {
  if (!token || typeof token !== 'string') {
    return null
  }
  if (token.length <= 8) {
    return token
  }
  return `${token.slice(0, 4)}…${token.slice(-4)}`
}

export class TokenManager {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    this.userInfo = null
    this.refreshTimer = null
    this.autoRefreshHandler = null
    this.isReady = false

    const securityConfig = getTokenSecurityConfig()
    this.persistence = securityConfig.persistence
    this.auditAccess = securityConfig.auditAccess
    this.storage = selectStorage(securityConfig.persistence)
    this.cipher = new TokenCipher(securityConfig.encryptionKey)

    this.ready = this.initialize()
  }

  async initialize() {
    await this.loadFromStorage()
    this.setupAutoRefresh()
    this.isReady = true
  }

  async loadFromStorage() {
    if (!this.storage) {
      return
    }

    try {
      const stored = this.storage.getItem(STORAGE_KEY)
      if (!stored) {
        return
      }

      const decrypted = await this.cipher.decrypt(stored)
      if (!decrypted) {
        await this.clearStorage()
        return
      }

      const data = JSON.parse(decrypted)
      if (data.expiry && new Date(data.expiry) > new Date()) {
        this.accessToken = data.accessToken
        this.refreshToken = data.refreshToken || null
        this.tokenExpiry = new Date(data.expiry)
        this.userInfo = data.userInfo || null

        if (this.auditAccess) {
          console.debug('TokenManager: Tokens restored from storage', {
            persistence: this.persistence,
            hasRefreshToken: Boolean(this.refreshToken),
            expiry: this.tokenExpiry.toISOString()
          })
        }
      } else {
        await this.clearStorage()
      }
    } catch (error) {
      console.warn('TokenManager: Failed to load stored tokens, clearing cache', error)
      await this.clearStorage()
    }
  }

  async saveToStorage() {
    if (!this.storage) {
      return
    }

    if (!this.accessToken || !this.tokenExpiry) {
      await this.clearStorage()
      return
    }

    const data = {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiry: this.tokenExpiry.toISOString(),
      userInfo: this.userInfo
    }

    try {
      const payload = JSON.stringify(data)
      const encrypted = await this.cipher.encrypt(payload)
      this.storage.setItem(STORAGE_KEY, encrypted)
    } catch (error) {
      console.warn('TokenManager: Failed to persist tokens', error)
    }
  }

  async clearStorage() {
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.warn('TokenManager: Failed to clear stored tokens', error)
      }
    }
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    this.userInfo = null
  }

  async setTokens(accessToken, refreshToken, expiresIn, userInfo = null) {
    await this.ready

    if (!accessToken || !expiresIn) {
      await this.clear()
      return
    }

    this.accessToken = accessToken
    this.refreshToken = refreshToken || null
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)
    this.userInfo = userInfo || null

    if (this.auditAccess) {
      console.debug('TokenManager: Tokens updated', {
        accessToken: sanitizeToken(this.accessToken),
        hasRefreshToken: Boolean(this.refreshToken),
        expiresAt: this.tokenExpiry.toISOString()
      })
    }

    await this.saveToStorage()
    this.setupAutoRefresh()
  }

  getAccessToken() {
    if (!this.isReady || !this.accessToken || !this.tokenExpiry) {
      return null
    }

    if (new Date() >= this.tokenExpiry) {
      return null
    }

    if (this.auditAccess) {
      console.debug('TokenManager: Access token read', {
        accessToken: sanitizeToken(this.accessToken),
        expiresAt: this.tokenExpiry.toISOString()
      })
    }

    return this.accessToken
  }

  getRefreshToken() {
    if (!this.isReady) {
      return null
    }
    return this.refreshToken
  }

  isTokenValid() {
    return Boolean(
      this.accessToken &&
      this.tokenExpiry &&
      new Date() < this.tokenExpiry
    )
  }

  setAutoRefreshHandler(handler) {
    this.autoRefreshHandler = handler
    this.setupAutoRefresh()
  }

  setupAutoRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    if (this.tokenExpiry && this.refreshToken && this.autoRefreshHandler) {
      const refreshTime = this.tokenExpiry.getTime() - Date.now() - 5 * 60 * 1000

      if (refreshTime > 0) {
        this.refreshTimer = setTimeout(() => {
          this.autoRefreshHandler()
        }, refreshTime)
      }
    }
  }

  async clear() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    await this.clearStorage()
  }
}
