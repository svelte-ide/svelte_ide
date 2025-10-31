class MainMenuService {
  constructor() {
    this.menus = $state([])
  }

  registerMenu(config = {}, ownerId = 'core') {
    const label = typeof config.label === 'string' ? config.label.trim() : ''
    if (!label) {
      console.warn('MainMenuService: missing label for menu', config)
      return null
    }

    const normalizedId = this._normalizeId(config.id ?? label)
    const order = Number.isFinite(config.order) ? config.order : 0
    const existing = this._findMenu(normalizedId)

    if (existing) {
      const updated = {
        ...existing,
        label,
        order,
        ownerId: existing.ownerId || ownerId
      }
      if (this._hasMenuChanged(existing, updated)) {
        this._replaceMenu(updated)
      }
      return updated
    }

    const menu = {
      id: normalizedId,
      label,
      order,
      ownerId,
      items: []
    }

    this.menus = this._sortMenus([...this.menus, menu])
    return menu
  }

  unregisterMenu(menuId, ownerId = null) {
    const normalizedId = this._normalizeId(menuId)
    const existing = this._findMenu(normalizedId)
    if (!existing) {
      return
    }
    if (ownerId && existing.ownerId && existing.ownerId !== ownerId) {
      return
    }
    this.menus = this.menus.filter(menu => menu.id !== normalizedId)
  }

  registerMenuItem(menuId, itemConfig = {}, ownerId = 'core') {
    const menu = this._findMenu(menuId)
    if (!menu) {
      console.warn(`MainMenuService: menu "${menuId}" not found for item`, itemConfig)
      return null
    }

    const label = typeof itemConfig.label === 'string' ? itemConfig.label.trim() : ''
    const isSeparator = !!itemConfig.separator
    if (!label && !isSeparator) {
      console.warn('MainMenuService: missing label for menu item', itemConfig)
      return null
    }

    let normalizedId
    if (typeof itemConfig.id === 'string' && itemConfig.id.trim()) {
      normalizedId = this._normalizeId(itemConfig.id)
    } else if (label) {
      normalizedId = this._normalizeId(label, `${menu.id}-item-`)
    } else {
      normalizedId = this._normalizeId(crypto.randomUUID(), `${menu.id}-item-`)
    }
    const order = Number.isFinite(itemConfig.order) ? itemConfig.order : 0
    const existingItems = menu.items.filter(item => item.id !== normalizedId)

    const nextItem = {
      id: normalizedId,
      label,
      order,
      shortcut: typeof itemConfig.shortcut === 'string' ? itemConfig.shortcut : '',
      disabled: !!itemConfig.disabled,
      action: typeof itemConfig.action === 'function' ? itemConfig.action : null,
      ownerId,
      separator: isSeparator
    }

    const nextItems = this._sortItems([...existingItems, nextItem])
    const updatedMenu = { ...menu, items: nextItems }
    this._replaceMenu(updatedMenu)
    return nextItem
  }

  unregisterMenuItem(menuId, itemId, ownerId = null) {
    const menu = this._findMenu(menuId)
    if (!menu) {
      return
    }
    const normalizedItemId = this._normalizeId(itemId)
    const nextItems = menu.items.filter(item => {
      if (item.id !== normalizedItemId) {
        return true
      }
      if (ownerId && item.ownerId && item.ownerId !== ownerId) {
        return true
      }
      return false
    })
    if (nextItems.length === menu.items.length) {
      return
    }
    const updatedMenu = { ...menu, items: nextItems }
    this._replaceMenu(updatedMenu)
  }

  unregisterOwner(ownerId) {
    if (!ownerId) {
      return
    }
    const nextMenus = []
    for (const menu of this.menus) {
      if (menu.ownerId && menu.ownerId === ownerId) {
        continue
      }
      const remainingItems = menu.items.filter(item => item.ownerId !== ownerId)
      if (remainingItems.length !== menu.items.length) {
        nextMenus.push({ ...menu, items: remainingItems })
        continue
      }
      nextMenus.push(menu)
    }
    if (nextMenus.length !== this.menus.length) {
      this.menus = this._sortMenus(nextMenus)
    } else {
      this.menus = nextMenus
    }
  }

  getMenu(menuId) {
    return this._findMenu(menuId)
  }

  _findMenu(menuId) {
    const normalizedId = this._normalizeId(menuId)
    return this.menus.find(menu => menu.id === normalizedId) || null
  }

  _replaceMenu(updatedMenu) {
    const nextMenus = this.menus.map(menu => (menu.id === updatedMenu.id ? updatedMenu : menu))
    this.menus = this._sortMenus(nextMenus)
  }

  _hasMenuChanged(previous, next) {
    return previous.label !== next.label || previous.order !== next.order || previous.ownerId !== next.ownerId
  }

  _sortMenus(menus = []) {
    return [...menus].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }
      return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
    })
  }

  _sortItems(items = []) {
    return [...items].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }
      return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
    })
  }

  _normalizeId(source, prefix = '') {
    if (!source && !prefix) {
      return crypto.randomUUID()
    }
    const raw = source ? `${source}`.trim().toLowerCase() : ''
    const base = raw
      ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : ''
    const finalId = base || crypto.randomUUID()
    return prefix ? `${prefix}${finalId}` : finalId
  }
}

export const mainMenuService = new MainMenuService()
