import { Tool } from '@svelte-ide/core/Tool.svelte.js'
import Calculator from './Calculator.svelte'

class CalculatorTool extends Tool {
  constructor() {
    super('Calculatrice', '🧮', 'topLeft', 'calculator')
  }

  initialize() {
    this.setComponent(Calculator)
  }
}

export default {
  register(toolManager) {
    const tool = new CalculatorTool()
    toolManager.registerTool(tool)
  }
}
