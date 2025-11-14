import { indexedDBService } from '@svelte-ide/core/persistence/IndexedDBService.svelte.js'
import { buildSeedTransactions } from './TransactionsV2SeedData.svelte.js'

const STORE_NAME = 'transactions-v2'
const KEY_PREFIX = 'tx'

function normalizeAmount(value, direction) {
  const numeric = Number(value) || 0
  if (direction === 'credit' && numeric < 0) {
    return Math.abs(numeric)
  }
  if (direction === 'debit' && numeric > 0) {
    return -numeric
  }
  return numeric
}

function normalizeTransaction(input = {}) {
  const direction = input.direction === 'credit' ? 'credit' : 'debit'
  const amount = normalizeAmount(input.amount, direction)
  const nowIso = input.date && !Number.isNaN(Date.parse(input.date)) ? new Date(input.date).toISOString() : new Date().toISOString()

  return {
    id: input.id ?? globalThis.crypto?.randomUUID?.() ?? `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: nowIso,
    description: (input.description || 'Transaction').trim(),
    category: (input.category || 'Autre').trim(),
    amount,
    direction,
    tags: Array.isArray(input.tags) ? input.tags : [],
    source: input.source || 'manual'
  }
}

function buildKey(id) {
  return `${KEY_PREFIX}:${id}`
}

class TransactionsV2Repository {
  constructor() {
    this.storeName = STORE_NAME
    this.initialized = false
    this.readyPromise = null
  }

  async _ensureReady() {
    if (this.initialized) {
      return true
    }

    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        await indexedDBService.initialize()
        if (!indexedDBService.hasStore(this.storeName)) {
          await indexedDBService.ensureStore(this.storeName)
        }
        this.initialized = true
        return true
      })()
    }

    return this.readyPromise
  }

  async seedDemoData() {
    await this._ensureReady()
    const existing = await indexedDBService.count(this.storeName)
    if (existing > 0) {
      return false
    }

    const seed = buildSeedTransactions()
    for (const tx of seed) {
      await this.save(tx)
    }
    return true
  }

  async save(transactionInput) {
    await this._ensureReady()
    const tx = normalizeTransaction(transactionInput)
    const payload = {
      ...tx,
      updatedAt: Date.now(),
      createdAt: transactionInput?.createdAt ?? Date.now()
    }
    return indexedDBService.save(this.storeName, buildKey(tx.id), payload)
  }

  async saveMany(list = []) {
    for (const entry of list) {
      await this.save(entry)
    }
  }

  async load(id) {
    await this._ensureReady()
    return indexedDBService.load(this.storeName, buildKey(id), null)
  }

  async delete(id) {
    await this._ensureReady()
    return indexedDBService.delete(this.storeName, buildKey(id))
  }

  async clear() {
    await this._ensureReady()
    return indexedDBService.clear(this.storeName)
  }

  async list({ category = 'all', limit = 250 } = {}) {
    await this._ensureReady()
    const entries = await indexedDBService.getAll(this.storeName, limit > 0 ? limit : 0)
    const data = entries.map(entry => entry.data)
    if (!category || category === 'all') {
      return data
    }
    return data.filter(item => item.category === category)
  }

  async count() {
    await this._ensureReady()
    return indexedDBService.count(this.storeName)
  }

  async exportAll() {
    await this._ensureReady()
    const entries = await indexedDBService.getAll(this.storeName)
    return entries.map(entry => entry.data)
  }

  async getStats() {
    const transactions = await this.list({ limit: 0 })
    return transactions.reduce((stats, tx) => {
      if (tx.amount >= 0) {
        stats.credits += tx.amount
      } else {
        stats.debits += tx.amount
      }
      return stats
    }, {
      credits: 0,
      debits: 0
    })
  }
}

export const transactionsV2Repository = new TransactionsV2Repository()
