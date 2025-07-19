import { Tool } from '../../core/Tool.svelte.js'
import ExplorerWrapper from './ExplorerWrapper.svelte'
import MetadataPanel from './MetadataPanel.svelte'

class MetadataTool extends Tool {
  constructor() {
    super('Métadonnées', '📋', 'right')
  }

  initialize() {
    this.setComponent(MetadataPanel)
  }
  
  destroy() {
    super.destroy()
  }
}

class ExplorerTool extends Tool {
  constructor() {
    super('Explorateur', '📁', 'left')
  }

  initialize() {
    this.setComponent(ExplorerWrapper, { toolId: this.id })
  }

  destroy() {
    super.destroy()
  }
}

export default {
  register(toolManager) {
    const explorerTool = new ExplorerTool()
    const metadataTool = new MetadataTool()
    
    toolManager.registerTool(explorerTool)
    toolManager.registerTool(metadataTool)
  }
}

export { MetadataTool }
