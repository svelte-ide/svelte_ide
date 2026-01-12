import { createLogger } from '../../../lib/logger.js'
import { avatarCacheService } from '../AvatarCacheService.svelte.js'

const logger = createLogger('core/auth/user-profile')

class UserProfileService {
  async applyCachedAvatar(userInfo) {
    if (!userInfo?.sub) {
      return userInfo
    }

    const cachedAvatar = await avatarCacheService.getAvatar(userInfo.sub)
    if (!cachedAvatar) {
      return userInfo
    }

    return { ...userInfo, avatar: cachedAvatar }
  }

  async enrichUserInfo(provider, userInfo, tokens) {
    if (!userInfo?.sub) {
      return userInfo
    }

    const cachedAvatar = await avatarCacheService.getAvatar(userInfo.sub)
    if (cachedAvatar) {
      return { ...userInfo, avatar: cachedAvatar }
    }

    let source = userInfo.avatar
    if (!source && provider?.fetchAvatar) {
      try {
        source = await provider.fetchAvatar({ userInfo, tokens })
      } catch (error) {
        logger.debug('Avatar fetch failed', error)
      }
    }

    if (!source) {
      return userInfo
    }

    let avatar = null
    if (typeof source === 'string') {
      avatar = await this.cacheAvatarFromUrl(userInfo.sub, source)
      if (!avatar) {
        avatar = source
      }
    } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
      avatar = await avatarCacheService.saveAvatar(userInfo.sub, source)
    }

    if (!avatar) {
      return userInfo
    }

    return { ...userInfo, avatar }
  }

  async cacheAvatarFromUrl(userId, url) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        return null
      }
      const blob = await response.blob()
      return await avatarCacheService.saveAvatar(userId, blob)
    } catch (error) {
      logger.debug('Avatar download failed', error)
      return null
    }
  }
}

export const userProfileService = new UserProfileService()
