export class Tool {
  constructor(name, icon, position = 'left') {
    this.id = crypto.randomUUID()
    this.name = name
    this.icon = icon
    this.position = $state(position)
    this.active = $state(false)
    this.component = null
    this.componentProps = {}
  }

  setComponent(component, props = {}) {
    this.component = component
    this.componentProps = props
  }

  setPosition(newPosition) {
    this.position = newPosition
  }

  activate() {
    this.active = true
  }

  deactivate() {
    this.active = false
  }

  initialize() {
  }

  destroy() {
  }
}

export class Tab {
  constructor(id, title, component, closable = true, toolIcon = null) {
    this.id = id
    this.title = title
    this.component = component
    this.closable = closable
    this.modified = false
    this.toolIcon = toolIcon
  }

  setModified(modified) {
    this.modified = modified
  }
}
