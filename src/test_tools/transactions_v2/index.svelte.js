import { Tool } from '@/core/Tool.svelte.js'
import TransactionsV2Panel from './TransactionsV2Panel.svelte'

class TransactionsV2Tool extends Tool {
  constructor() {
    super('Transactions v2', '📊', 'topLeft', 'transactions-v2')
  }

  initialize() {
    this.setComponent(TransactionsV2Panel)
  }
}

export default {
  register(toolManager) {
    const tool = new TransactionsV2Tool()
    toolManager.registerTool(tool)
  }
}
