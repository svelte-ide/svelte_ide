export class Tab {
  constructor(id, title, component, closable = true, icon = null) {
    this.id = id
    this.title = title
    this.component = component
    this.closable = closable
    this.icon = icon
    this.modified = $state(false)
    this.descriptor = null // Descriptor pour la sérialisation/restauration
  }

  setModified(modified) {
    this.modified = modified
  }

  setDescriptor(descriptor) {
    this.descriptor = descriptor
  }

  getSerializableData() {
    return {
      id: this.id,
      title: this.title,
      closable: this.closable,
      icon: this.icon,
      descriptor: this.descriptor
    }
  }
}