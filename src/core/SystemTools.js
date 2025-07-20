import { Tool } from '@/core/Tool.svelte.js'
import Console from '@/components/system/console/Console.svelte'
import Notifications from '@/components/system/notifications/Notifications.svelte'

export class ConsoleTool extends Tool {
  constructor() {
    super('Console', '>', 'bottom')
  }

  initialize() {
    this.setComponent(Console)
  }
}

export class NotificationsTool extends Tool {
  constructor() {
    super('Notifications', '🔔', 'topRight')
  }

  initialize() {
    this.setComponent(Notifications)
  }
}
