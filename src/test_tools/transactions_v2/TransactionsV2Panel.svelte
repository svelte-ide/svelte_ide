<script>
  import { transactionsV2Repository } from './TransactionsV2Repository.svelte.js'

  const categories = [
    { value: 'all', label: 'Toutes catégories' },
    { value: 'Alimentation', label: 'Alimentation' },
    { value: 'Transport', label: 'Transport' },
    { value: 'Logement', label: 'Logement' },
    { value: 'Santé', label: 'Santé' },
    { value: 'Loisir', label: 'Loisir' },
    { value: 'Services', label: 'Services' },
    { value: 'Voyage', label: 'Voyage' },
    { value: 'Abonnement', label: 'Abonnement' },
    { value: 'Autre', label: 'Autre' }
  ]

  let loading = $state(true)
  let saving = $state(false)
  let exportInProgress = $state(false)
  let deleting = $state(null)
  let transactions = $state([])
  let categoryFilter = $state('all')
  let stats = $state({ total: 0, credits: 0, debits: 0 })

  let form = $state({
    description: '',
    category: 'Alimentation',
    amount: '',
    direction: 'debit',
    date: new Date().toISOString().slice(0, 10),
    tags: ''
  })

  const currencyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
  const dateFormatter = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  function computeStats(list = []) {
    return list.reduce((acc, tx) => {
      if (tx.amount >= 0) {
        acc.credits += tx.amount
      } else {
        acc.debits += tx.amount
      }
      acc.total += tx.amount
      return acc
    }, { total: 0, credits: 0, debits: 0 })
  }

  async function refresh() {
    loading = true
    try {
      const list = await transactionsV2Repository.list({
        category: categoryFilter,
        limit: 0
      })
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      transactions = list
      stats = computeStats(list)
    } finally {
      loading = false
    }
  }

  async function bootstrap() {
    loading = true
    try {
      await transactionsV2Repository.seedDemoData()
      await refresh()
    } finally {
      loading = false
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault()
    saving = true
    try {
      const tags = form.tags
        ? form.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : []
      await transactionsV2Repository.save({
        description: form.description,
        category: form.category,
        amount: Number(form.amount),
        direction: form.direction,
        date: form.date,
        tags
      })
      form.description = ''
      form.amount = ''
      form.tags = ''
      await refresh()
    } finally {
      saving = false
    }
  }

  async function handleDelete(id) {
    deleting = id
    try {
      await transactionsV2Repository.delete(id)
      await refresh()
    } finally {
      deleting = null
    }
  }

  async function handleExport() {
    exportInProgress = true
    try {
      const snapshot = await transactionsV2Repository.exportAll()
      const payload = {
        exportedAt: new Date().toISOString(),
        total: snapshot.length,
        transactions: snapshot
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `transactions-v2-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      exportInProgress = false
    }
  }

  async function handleReseed() {
    await transactionsV2Repository.clear()
    await transactionsV2Repository.seedDemoData()
    await refresh()
  }

  function formatAmount(value) {
    return currencyFormatter.format(value)
  }

  function formatDate(value) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return dateFormatter.format(date)
  }

  (async () => {
    await bootstrap()
  })()
</script>

<div class="transactions-v2">
  <header class="panel-header">
    <div>
      <h2>Transactions v2 (IndexedDB)</h2>
      <p>
        Données chiffrées via <code>indexedDBService</code>. Chaque opération
        (<code>save</code>, <code>load</code>, <code>getAll</code>, <code>clear</code>)
        passe par le service pour démontrer la persistance sécurisée.
      </p>
    </div>
    <div class="header-actions">
      <button type="button" onclick={handleExport} disabled={exportInProgress || loading}>
        {exportInProgress ? 'Export...' : 'Export JSON'}
      </button>
      <button type="button" class="secondary" onclick={handleReseed} disabled={loading}>
        Réinitialiser la démo
      </button>
    </div>
  </header>

  <section class="stats">
    <div>
      <span class="label">Solde agrégé</span>
      <strong>{formatAmount(stats.total)}</strong>
    </div>
    <div>
      <span class="label">Crédits</span>
      <strong class="credit">{formatAmount(stats.credits)}</strong>
    </div>
    <div>
      <span class="label">Débits</span>
      <strong class="debit">{formatAmount(stats.debits)}</strong>
    </div>
    <div>
      <span class="label">Entrées persistées</span>
      <strong>{transactions.length}</strong>
    </div>
  </section>

  <section class="grid">
    <form class="editor" onsubmit={handleSubmit}>
      <h3>Nouvelle transaction</h3>
      <label>
        Description
        <input
          required
          placeholder="Ex: Café Rivière"
          bind:value={form.description}
        />
      </label>
      <label>
        Catégorie
        <select bind:value={form.category}>
          {#each categories.slice(1) as category}
            <option value={category.value}>{category.label}</option>
          {/each}
        </select>
      </label>
      <label>
        Date
        <input type="date" bind:value={form.date} required />
      </label>
      <label>
        Sens
        <select bind:value={form.direction}>
          <option value="debit">Débit</option>
          <option value="credit">Crédit</option>
        </select>
      </label>
      <label>
        Montant (EUR)
        <input
          type="number"
          step="0.01"
          required
          placeholder="0.00"
          bind:value={form.amount}
        />
      </label>
      <label>
        Tags (séparés par des virgules)
        <input
          placeholder="resto, midi, équipe"
          bind:value={form.tags}
        />
      </label>
      <button type="submit" disabled={saving}>
        {saving ? 'Enregistrement...' : 'Sauvegarder via IndexedDB'}
      </button>
    </form>

    <div class="table-card">
      <div class="table-header">
        <div>
          <h3>Historique</h3>
          <p>
            Résultat de <code>indexedDBService.getAll()</code> filtré par catégorie.
          </p>
        </div>
        <select bind:value={categoryFilter} onchange={async () => { await refresh() }} disabled={loading}>
          {#each categories as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      {#if loading}
        <div class="placeholder">Chargement des transactions...</div>
      {:else if transactions.length === 0}
        <div class="placeholder">Aucune transaction stockée pour ce filtre.</div>
      {:else}
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Catégorie</th>
                <th>Montant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each transactions as tx (tx.id)}
                <tr>
                  <td>{formatDate(tx.date)}</td>
                  <td>{tx.description}</td>
                  <td>{tx.category}</td>
                  <td class:credit={tx.amount >= 0} class:debit={tx.amount < 0}>
                    {formatAmount(tx.amount)}
                  </td>
                  <td class="actions">
                    <button type="button" class="link" onclick={() => handleDelete(tx.id)} disabled={deleting === tx.id}>
                      {deleting === tx.id ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  .transactions-v2 {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    height: 100%;
    color: #f5f5f5;
    background: #1f1f23;
    font-family: 'Segoe UI', sans-serif;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid #2d2d32;
  }

  .panel-header h2 {
    margin-bottom: 4px;
    font-size: 20px;
  }

  .panel-header p {
    color: #c2c2cc;
    font-size: 14px;
    line-height: 1.4;
  }

  .panel-header code {
    background: #2d2d32;
    padding: 0 4px;
    border-radius: 4px;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  button {
    border: none;
    border-radius: 4px;
    padding: 8px 14px;
    background: #007acc;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  button.secondary {
    background: #3a3a41;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .stats div {
    background: #26262c;
    border: 1px solid #2f2f36;
    border-radius: 6px;
    padding: 12px;
  }

  .stats .label {
    display: block;
    font-size: 13px;
    color: #b1b1bb;
  }

  .stats strong {
    display: block;
    margin-top: 6px;
    font-size: 18px;
  }

  .stats .credit {
    color: #4ec9b0;
  }

  .stats .debit {
    color: #f44747;
  }

  .grid {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    gap: 20px;
    flex: 1;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #26262c;
    padding: 16px;
    border-radius: 6px;
    border: 1px solid #2f2f36;
  }

  .editor h3 {
    margin-bottom: 4px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: #c2c2cc;
  }

  input,
  select {
    background: #1b1b1f;
    border: 1px solid #3a3a41;
    color: #f5f5f5;
    border-radius: 4px;
    padding: 8px 10px;
    font-size: 14px;
  }

  .table-card {
    display: flex;
    flex-direction: column;
    background: #26262c;
    border-radius: 6px;
    border: 1px solid #2f2f36;
    min-height: 0;
  }

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #2f2f36;
  }

  .table-header h3 {
    margin-bottom: 4px;
  }

  .table-header p {
    color: #b1b1bb;
    font-size: 13px;
  }

  .table-wrapper {
    flex: 1;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th,
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #2f2f36;
    text-align: left;
  }

  th {
    background: #2d2d32;
    text-transform: uppercase;
    font-size: 12px;
    letter-spacing: 0.05em;
  }

  td.credit {
    color: #4ec9b0;
    text-align: right;
  }

  td.debit {
    color: #f44747;
    text-align: right;
  }

  .actions {
    text-align: right;
  }

  .actions .link {
    background: transparent;
    color: #ff8c8c;
    padding: 0;
  }

  .placeholder {
    padding: 24px;
    color: #c2c2cc;
    text-align: center;
  }

  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
