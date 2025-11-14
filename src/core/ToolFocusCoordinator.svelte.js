import { eventBus } from '@svelte-ide/core/EventBusService.svelte.js'

class ToolFocusCoordinator {
  constructor() {
    this._focusHandler = null
    this._toolToGroup = new Map()
    this._groupToTools = new Map()

    eventBus.subscribe('tabs:focus-changed', ({ tab }) => {
      this._handleTabFocus(tab)
    })

    eventBus.subscribe('tabs:activated', payload => {
      const tab = payload && typeof payload === 'object' && 'tab' in payload
        ? payload.tab
        : payload
      this._handleTabFocus(tab)
    })

    eventBus.subscribe('tabs:added', ({ tab }) => {
      this._handleTabFocus(tab)
    })
  }

  setFocusHandler(handler) {
    this._focusHandler = typeof handler === 'function' ? handler : null
  }

  registerTool(tool) {
    if (!tool || !tool.id) {
      return
    }

    const toolId = tool.id
    const groupId = this._deriveGroupId(tool)

    this._toolToGroup.set(toolId, groupId)

    if (!this._groupToTools.has(groupId)) {
      this._groupToTools.set(groupId, new Set())
    }
    this._groupToTools.get(groupId).add(toolId)
  }

  unregisterTool(toolId) {
    if (!toolId) {
      return
    }

    const groupId = this._toolToGroup.get(toolId)
    if (!groupId) {
      return
    }

    this._toolToGroup.delete(toolId)

    const group = this._groupToTools.get(groupId)
    if (group) {
      group.delete(toolId)
      if (group.size === 0) {
        this._groupToTools.delete(groupId)
      }
    }
  }

  _handleTabFocus(tab) {
    if (!this._focusHandler || !tab) {
      this._publishFocusGroupChange(null, null, tab, [])
      return
    }

    const primaryToolId = tab.toolId ?? tab.descriptor?.toolId
    if (!primaryToolId) {
      this._publishFocusGroupChange(null, null, tab, [])
      return
    }

    const groupId = this._toolToGroup.get(primaryToolId)
    if (!groupId) {
      this._publishFocusGroupChange(null, primaryToolId, tab, [])
      return
    }

    const toolsInGroup = this._groupToTools.get(groupId)
    if (!toolsInGroup || toolsInGroup.size === 0) {
      this._publishFocusGroupChange(groupId, primaryToolId, tab, [])
      return
    }

    const toolIds = Array.from(toolsInGroup)
    this._publishFocusGroupChange(groupId, primaryToolId, tab, toolIds)

    toolsInGroup.forEach(toolId => {
      const isPrimary = toolId === primaryToolId
      this._focusHandler(toolId, tab, { isPrimary })
    })
  }

  _deriveGroupId(tool) {
    if (tool && typeof tool.focusGroup === 'string') {
      const normalized = tool.focusGroup.trim()
      if (normalized) {
        return normalized
      }
    }

    const source = typeof tool?.id === 'string' ? tool.id : ''
    if (!source) {
      return tool.id
    }

    const separatorIndex = source.indexOf('-')
    if (separatorIndex === -1) {
      return source
    }
    return source.slice(0, separatorIndex) || source
  }

  getGroupForTool(toolId) {
    if (!toolId) {
      return null
    }
    return this._toolToGroup.get(toolId) || null
  }

  _publishFocusGroupChange(groupId, primaryToolId, tab, toolIds) {
    eventBus.publish('tools:focus-group-changed', {
      groupId: groupId ?? null,
      primaryToolId: primaryToolId ?? null,
      tab: tab ?? null,
      toolIds: Array.isArray(toolIds) ? toolIds : []
    })
  }
}

export const toolFocusCoordinator = new ToolFocusCoordinator()
