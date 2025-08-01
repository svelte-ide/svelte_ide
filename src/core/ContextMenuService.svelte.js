export class ContextMenuServiceSvelte {
  constructor() {
    this.menuItems = $state([])
    this.isVisible = $state(false)
    this.position = $state({ x: 0, y: 0 })
    this.context = $state(null)
  }

  show(x, y, context, menuItems) {
    this.position = { x, y }
    this.context = context
    this.menuItems = menuItems
    this.isVisible = true
  }

  hide() {
    this.isVisible = false
    this.menuItems = []
    this.context = null
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
