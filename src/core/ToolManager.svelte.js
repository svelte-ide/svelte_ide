import { ideStore } from '../stores/ideStore.svelte.js'

class ToolManagerSvelte {
  constructor() {
    this.registeredTools = new Map()
  }

  registerTool(tool) {
    if (this.registeredTools.has(tool.id)) {
      return
    }

    this.registeredTools.set(tool.id, tool)
    tool.initialize()
    ideStore.addTool(tool)
  }

  unregisterTool(toolId) {
    const tool = this.registeredTools.get(toolId)
    if (!tool) {
      ideStore.addLog(`Tool ${toolId} not found`, 'warning')
      return
    }

    tool.destroy()
    ideStore.removeTool(toolId)
    this.registeredTools.delete(toolId)
    ideStore.addLog(`Tool ${tool.name} unregistered`, 'info')
  }

  async loadTools() {
    try {
      const toolModules = import.meta.glob('../tools/**/index.svelte.js')
      
      for (const path in toolModules) {
        try {
          const module = await toolModules[path]()
          if (module.default) {
            if (typeof module.default.register === 'function') {
              module.default.register(this)
            } 
            else if (module.default.id && module.default.name) {
              this.registerTool(module.default)
            }
          }
        } catch (error) {
          console.error(`Failed to load tool from ${path}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to load tools:', error)
    }
  }
}

export const toolManager = new ToolManagerSvelte()
