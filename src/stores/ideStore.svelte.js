import { Tab } from '../core/Tool.svelte.js'

class IDEStore {
  constructor() {
    this.tools = $state([])
    this.tabs = $state([])
    this.activeTab = $state(null)
    this.leftPanelVisible = $state(false)
    this.rightPanelVisible = $state(false)
    this.consolePanelVisible = $state(true)
    this.statusMessage = $state('')
    this.user = $state(null)
    this.consoleTabs = $state([])
    this.activeConsoleTab = $state(null)
    this._logIdCounter = 0
    this.activeLeftTool = $state(null)
    this.activeRightTool = $state(null)
    this.focusedPanel = $state(null)

    this.notifications = $state([])
    this.unreadNotificationsCount = $state(0)
    this.notificationsPanelVisible = $state(false)
    this._notificationIdCounter = 0

    this.rightToolbarItems = $state([])
  }

  leftTools = $derived(this.tools.filter(t => t.position === 'left'))
  rightTools = $derived(this.tools.filter(t => t.position === 'right'))

  addTool(tool) {
    if (!this.tools.find(t => t.id === tool.id)) {
      this.tools.push(tool)
    }
  }

  removeTool(toolId) {
    const index = this.tools.findIndex(tool => tool.id === toolId)
    if (index !== -1) {
      this.tools.splice(index, 1)
    }
  }

  moveTool(toolId, newPosition) {
    const tool = this.tools.find(t => t.id === toolId)
    if (tool && (newPosition === 'left' || newPosition === 'right')) {
      tool.setPosition(newPosition)
    }
  }

  toggleLeftPanel(toolId) {
    const tool = this.leftTools.find(t => t.id === toolId)
    if (!tool) return

    const wasActive = tool.active

    this.leftTools.forEach(t => t.deactivate())

    if (!wasActive) {
      tool.activate()
      this.activeLeftTool = tool
      this.leftPanelVisible = true
    } else {
      this.activeLeftTool = null
      this.leftPanelVisible = false
    }
  }

  toggleRightPanel(toolId) {
    const tool = this.rightTools.find(t => t.id === toolId)
    if (!tool) return

    const wasActive = tool.active

    this.rightTools.forEach(t => t.deactivate())

    if (!wasActive) {
      tool.activate()
      this.activeRightTool = tool
      this.rightPanelVisible = true
    } else {
      this.activeRightTool = null
      this.rightPanelVisible = false
    }
  }

  toggleConsolePanel() {
    this.consolePanelVisible = !this.consolePanelVisible
  }

  addConsoleTab(title) {
    let consoleTab = this.consoleTabs.find(tab => tab.title === title)
    if (!consoleTab) {
      consoleTab = {
        id: `console-${++this._logIdCounter}`,
        title,
        logs: []
      }
      this.consoleTabs.push(consoleTab)
    }
    this.activeConsoleTab = consoleTab.id
    return consoleTab
  }

  closeConsoleTab(tabId) {
    const index = this.consoleTabs.findIndex(tab => tab.id === tabId)
    if (index !== -1) {
      this.consoleTabs.splice(index, 1)
      if (this.activeConsoleTab === tabId) {
        this.activeConsoleTab = this.consoleTabs.length > 0 ? this.consoleTabs[0].id : null
      }
    }
  }

  clearConsoleTab(tabId) {
    const tab = this.consoleTabs.find(tab => tab.id === tabId)
    if (tab) {
      tab.logs.splice(0, tab.logs.length)
    }
  }

  setActiveConsoleTab(tabId) {
    this.activeConsoleTab = tabId
  }

  addTab(tab) {
    const existingTab = this.tabs.find(t => t.id === tab.id)
    if (!existingTab) {
      this.tabs.push(tab)
    }
    this.activeTab = tab.id
  }

  addTabFromTool(toolId, tabId, title, component, closable = true, additionalProps = {}) {
    const tool = this.tools.find(t => t.id === toolId)
    const toolIcon = tool ? tool.icon : null
    
    const tab = new (class extends Tab {
      constructor() {
        super(tabId, title, component, closable, toolIcon)
        Object.assign(this, additionalProps)
      }
    })()
    
    this.addTab(tab)
    return tab
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex(tab => tab.id === tabId)
    if (index !== -1) {
      this.tabs.splice(index, 1)
      if (this.activeTab === tabId) {
        this.activeTab = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null
      }
    }
  }

  reorderTabs(newTabsOrder) {
    this.tabs = newTabsOrder
  }

  setActiveTab(tabId) {
    this.activeTab = tabId
  }

  setFocusedPanel(panelType) {
    this.focusedPanel = panelType
  }

  clearFocusedPanel() {
    this.focusedPanel = null
  }

  setStatusMessage(message) {
    this.statusMessage = message
  }

  login(user) {
    this.user = {
      ...user,
      loginTime: new Date().toISOString(),
      authType: 'temporary'
    }
  }

  logout() {
    if (this.user) {
      this.closeAllTabs()
    }
    this.user = null
  }

  async loginWithOAuth(provider = 'default') {
    return new Promise((resolve, reject) => {
      this.addNotification(
        'OAuth',
        `Redirection vers ${provider} en cours...`,
        'info',
        'Authentification'
      )
      setTimeout(() => {
        reject(new Error('OAuth non implémenté - utiliser la connexion temporaire'))
      }, 1000)
    })
  }

  closeAllTabs() {
    this.tabs = []
    this.activeTab = null
  }

  addLog(message, type = 'info', tabTitle = 'Général') {
    const consoleTab = this.addConsoleTab(tabTitle)
    consoleTab.logs.push({
      id: ++this._logIdCounter,
      message,
      type,
      timestamp: new Date()
    })
    
    this.consoleTabs = [...this.consoleTabs]
  }

  addNotification(title, message, type = 'info', source = 'IDE') {
    const notification = {
      id: ++this._notificationIdCounter,
      title,
      message,
      type,
      source,
      timestamp: new Date(),
      read: false
    }

    this.notifications.unshift(notification)
    this.unreadNotificationsCount += 1
    
    return notification.id
  }

  markNotificationAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId)
    if (notification && !notification.read) {
      notification.read = true
      this.unreadNotificationsCount = Math.max(0, this.unreadNotificationsCount - 1)
    }
  }

  markAllNotificationsAsRead() {
    this.notifications.forEach(n => n.read = true)
    this.unreadNotificationsCount = 0
  }

  removeNotification(notificationId) {
    const index = this.notifications.findIndex(n => n.id === notificationId)
    if (index !== -1) {
      const notification = this.notifications[index]
      if (!notification.read) {
        this.unreadNotificationsCount = Math.max(0, this.unreadNotificationsCount - 1)
      }
      this.notifications.splice(index, 1)
    }
  }

  clearAllNotifications() {
    this.notifications = []
    this.unreadNotificationsCount = 0
  }

  toggleNotificationsPanel() {
    if (!this.notificationsPanelVisible) {
      this.rightTools.forEach(t => {
        if (t.active) {
          t.deactivate()
        }
      })
    }
    
    this.notificationsPanelVisible = !this.notificationsPanelVisible
    this.rightPanelVisible = this.notificationsPanelVisible || this.rightTools.some(t => t.active)
    
    if (this.notificationsPanelVisible) {
      this.setStatusMessage('Notifications ouvertes')
    } else {
      this.setStatusMessage('Notifications fermées')
    }
  }
}

export const ideStore = new IDEStore()

ideStore.addConsoleTab('Général')
