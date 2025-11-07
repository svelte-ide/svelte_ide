const categories = [
  'Alimentation',
  'Transport',
  'Logement',
  'Santé',
  'Loisir',
  'Services',
  'Voyage',
  'Abonnement'
]

const merchants = [
  'Marché Central',
  'Studio Flow',
  'LibreTaxi',
  'Pharmacie Horizon',
  'Energie+',
  'Bibliothèque Nova',
  'Atelier Café',
  'Cinema Lumière',
  'Musée Métropole',
  'Station Alpha',
  'Vélo Express',
  'CloudStorage'
]

function createGenerator(seed) {
  let value = seed % 2147483647
  if (value <= 0) {
    value += 2147483646
  }
  return () => {
    value = value * 16807 % 2147483647
    return (value - 1) / 2147483646
  }
}

function rounded(value) {
  return Math.round(value * 100) / 100
}

function buildRecord(random, index) {
  const direction = random() > 0.35 ? 'debit' : 'credit'
  const amountBase = rounded(random() * (direction === 'credit' ? 800 : 280))
  const amount = direction === 'credit' ? amountBase : -amountBase
  const dayOffset = Math.floor(random() * 180)
  const date = new Date(Date.now() - dayOffset * 86400000).toISOString()
  const category = categories[Math.floor(random() * categories.length)]
  const merchant = merchants[Math.floor(random() * merchants.length)]

  return {
    id: `seed-${index}-${category.toLowerCase().replace(/\s+/g, '-')}`,
    date,
    description: `${direction === 'credit' ? 'Crédit' : 'Paiement'} - ${merchant}`,
    category,
    direction,
    amount,
    tags: [merchant],
    source: 'seed'
  }
}

export function buildSeedTransactions(count = 120) {
  const random = createGenerator(13991)
  const records = []
  for (let index = 0; index < count; index += 1) {
    records.push(buildRecord(random, index + 1))
  }
  return records
}
