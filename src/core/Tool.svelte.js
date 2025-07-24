export class Tool {
  constructor(name, icon, position = 'topLeft') {
    this.id = crypto.randomUUID()
    this.name = name
    this.icon = icon
    this.position = $state(position) // topLeft, bottomLeft, topRight, bottomRight, bottom
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