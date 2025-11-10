import { SCROLL_MODES } from '@/core/ScrollModes.svelte.js'

export class Tab {
  constructor(id, title, component, closable = true, icon = null, scrollMode = SCROLL_MODES.ide) {
    this.id = id
    this.title = title
    this.component = $state(component)
    this.closable = closable
    this.icon = icon
    this.modified = $state(false)
    this.scrollMode = scrollMode
    this.descriptor = null
    this.onSave = null
    this.onDiscard = null
    
    // Propriétés réactives pour les fichiers
    this.fileName = $state(null)
    this.content = $state(null)
    this.originalContent = $state(null)
    this.toolId = $state(null)
    this.onContentChange = null
    this.onDirtyStateChange = null
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
      descriptor: this.descriptor,
      scrollMode: this.scrollMode
    }
  }
}
