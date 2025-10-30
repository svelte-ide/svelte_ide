export const MODAL_CANCELLED_BY_X = 'x_cancelled'

class ModalService {
  constructor() {
    this.isVisible = $state(false)
    this.icon = $state(null)
    this.question = $state('')
    this.description = $state('')
    this.buttons = $state([])
    this._resolver = null
  }

  open(config = {}) {
    if (this._resolver) {
      this._resolver(MODAL_CANCELLED_BY_X)
      this._resolver = null
    }

    const {
      icon = null,
      question = '',
      description = '',
      buttons = []
    } = config

    this.icon = icon
    this.question = question
    this.description = description
    this.buttons = buttons.map((button, index) => {
      if (typeof button === 'string') {
        return { id: button, label: button }
      }
      const id = button?.id ?? `modal-action-${index}`
      return {
        id,
        label: button.label ?? id,
        payload: button.payload ?? null
      }
    })

    this.isVisible = true

    return new Promise((resolve) => {
      this._resolver = resolve
    })
  }

  confirm(options) {
    return this.open(options)
  }

  close(result = MODAL_CANCELLED_BY_X) {
    const resolver = this._resolver
    this._resolver = null

    this.isVisible = false
    this.icon = null
    this.question = ''
    this.description = ''
    this.buttons = []

    if (resolver) {
      resolver(result)
    }
  }

  closeWithAction(actionId, payload = null) {
    const result = payload !== null ? { actionId, payload } : actionId
    this.close(result)
  }
}

export const modalService = new ModalService()
