export class Tool {
  constructor(name, icon, position = 'topLeft', id = null) {
    this.id = id ?? Tool.generate_id(name)
    this.name = name
    this.icon = icon
    this.position = $state(position)
    this.active = $state(false)
    this.component = null
    this.componentProps = {}
    this.visibilityMode = 'contextual'
    this.visible = true
    this.contextMatcher = null
    this._autoHidden = false
    this._lastActiveState = false
  }

  static generate_id(source) {
    if (!source) {
      return crypto.randomUUID()
    }
    const value = source.toString().trim().toLowerCase().normalize('NFD')
    const cleaned = value.replace(/[\u0300-\u036f]/g, '')
    const sanitized = cleaned.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return sanitized || crypto.randomUUID()
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

  setVisibilityMode(mode) {
    this.visibilityMode = mode === 'always' ? 'always' : 'contextual'
  }

  setContextMatcher(matcher) {
    this.contextMatcher = typeof matcher === 'function' ? matcher : null
  }

  isContextual() {
    return this.visibilityMode !== 'always'
  }

  isTabCompatible(tab) {
    if (!this.isContextual()) {
      return true
    }

    const matcher = this.contextMatcher ?? this._defaultContextMatcher.bind(this)
    try {
      return !!matcher(tab, this)
    } catch (error) {
      console.warn(`Tool ${this.id}: context matcher error`, error)
      return false
    }
  }

  _defaultContextMatcher(tab) {
    if (!tab) {
      return false
    }
    if (tab.toolId && tab.toolId === this.id) {
      return true
    }
    if (tab.descriptor?.toolId && tab.descriptor.toolId === this.id) {
      return true
    }
    return false
  }

  initialize() {
  }

  destroy() {
  }
}
