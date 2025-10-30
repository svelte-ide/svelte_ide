import { eventBus } from '@/core/EventBusService.svelte.js'
import TransactionsView from './TransactionsView.svelte'

class TransactionsRestorationService {
  constructor() {
    this._subscribe()
  }

  _subscribe() {
    eventBus.subscribe('tab:hydrate', (hydrateEvent) => {
      if (hydrateEvent?.descriptor?.type !== 'transactions-view') {
        return
      }
      this._handleHydrate(hydrateEvent)
    })
  }

  _handleHydrate(hydrateEvent) {
    const { hydrateCallback } = hydrateEvent
    if (typeof hydrateCallback === 'function') {
      hydrateCallback(TransactionsView)
    }
  }
}

export const transactionsRestorationService = new TransactionsRestorationService()
