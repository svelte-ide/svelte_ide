import { LeftTool } from '../../core/Tool.svelte.js'
import { ideStore } from '../../stores/ideStore.svelte.js'
import Calculator from './Calculator.svelte'

class CalculatorTool extends LeftTool {
  constructor() {
    super('Calculatrice', '🧮')
  }

  initialize() {
    this.setComponent(Calculator)
  }

  activate() {
    super.activate()
  }

  deactivate() {
    super.deactivate()
  }

  destroy() {
  }
}

export default {
  register(toolManager) {
    const tool = new CalculatorTool()
    toolManager.registerTool(tool)
  }
}
