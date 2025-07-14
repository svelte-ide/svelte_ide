export class ContextMenuServiceSvelte {
  constructor() {
    this.menuItems = []
    this.isVisible = false
    this.position = { x: 0, y: 0 }
    this.context = null
    this.subscribers = []
  }

  subscribe(callback) {
    this.subscribers.push(callback)
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback)
    }
  }

  notify() {
    this.subscribers.forEach(callback => callback({
      isVisible: this.isVisible,
      position: this.position,
      menuItems: this.menuItems,
      context: this.context
    }))
  }

  show(x, y, context, menuItems) {
    this.position = { x, y }
    this.context = context
    this.menuItems = menuItems
    this.isVisible = true
    this.notify()
  }

  hide() {
    this.isVisible = false
    this.menuItems = []
    this.context = null
    this.notify()
  }

  executeAction(actionId) {
    const item = this.menuItems.find(item => item.id === actionId)
    if (item && item.action) {
      item.action(this.context)
    }
    this.hide()
  }
}

export const contextMenuService = new ContextMenuServiceSvelte()
