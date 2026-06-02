import Database from 'better-sqlite3'
import dotenv from 'dotenv'

dotenv.config()

const db = new Database(process.env.DB_PATH || './db/rates.db')
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank TEXT NOT NULL,
    currency TEXT NOT NULL,
    cash_buying REAL,
    cash_selling REAL,
    transactional_buying REAL,
    transactional_selling REAL,
    scraped_at TEXT NOT NULL
  )
`)

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_rates_bank_scraped
  ON rates(bank, scraped_at DESC)
`)

export function saveRates(records) {
  if (!records.length) return

  const stmt = db.prepare(`
    INSERT INTO rates (bank, currency, cash_buying, cash_selling, transactional_buying, transactional_selling, scraped_at)
    VALUES (@bank, @currency, @cash_buying, @cash_selling, @transactional_buying, @transactional_selling, @scraped_at)
  `)

  const insertMany = db.transaction((rows) => {
    for (const row of rows) stmt.run(row)
  })

  insertMany(records)
}

export function getRatesByBank(bank) {
  const rows = db.prepare(`
    SELECT currency, cash_buying, cash_selling, transactional_buying, transactional_selling, scraped_at
    FROM rates
    WHERE bank = ?
    AND scraped_at = (
      SELECT MAX(scraped_at) FROM rates WHERE bank = ?
    )
  `).all(bank, bank)

  return rows
}

export function hasRatesForToday(bank) {
  const row = db.prepare(`
    SELECT scraped_at FROM rates
    WHERE bank = ?
    AND date(scraped_at) = date('now')
    LIMIT 1
  `).get(bank)

  return !!row
}

export function getRateHistory(bank, currency, from, to) {
  let query = `
    SELECT cash_buying, cash_selling, transactional_buying, transactional_selling, scraped_at
    FROM rates
    WHERE bank = ? AND currency = ?
  `
  const params = [bank, currency]

  if (from) {
    query += ` AND date(scraped_at) >= date(?)`
    params.push(from)
  }

  if (to) {
    query += ` AND date(scraped_at) <= date(?)`
    params.push(to)
  }

  query += ` ORDER BY scraped_at DESC`

  return db.prepare(query).all(...params)
}

export function getRatesByCurrency(currency) {
  const rows = db.prepare(`
    SELECT r.bank, r.currency, r.cash_buying, r.cash_selling, r.transactional_buying, r.transactional_selling, r.scraped_at
    FROM rates r
    INNER JOIN (
      SELECT bank, MAX(scraped_at) as max_scraped
      FROM rates
      WHERE currency = ?
      GROUP BY bank
    ) latest ON r.bank = latest.bank AND r.scraped_at = latest.max_scraped
<<<<<<< Updated upstream
    WHERE r.currency = ?
    ORDER BY r.cash_buying DESC
=======
    WHERE r.currency = ? AND r.${column} IS NOT NULL
    ORDER BY r.${column} ${order}
    LIMIT 1
  `).get(currency, currency)

  return row || null
}

export function getRatesByCurrency(currency, sort = 'cash_buying', order = 'DESC') {
  const allowedSorts = ['cash_buying', 'cash_selling', 'transactional_buying', 'transactional_selling', 'bank']
  if (!allowedSorts.includes(sort)) sort = 'cash_buying'
  order = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  let orderClause
  if (sort === 'bank') {
    orderClause = `ORDER BY r.bank COLLATE NOCASE ${order}`
  } else {
    orderClause = `ORDER BY r.${sort} ${order}`
  }

  const rows = db.prepare(`
    SELECT r.bank, r.currency, r.cash_buying, r.cash_selling, r.transactional_buying, r.transactional_selling, r.scraped_at
    FROM rates r
    INNER JOIN (
      SELECT bank, MAX(scraped_at) as max_scraped
      FROM rates
      WHERE currency = ? AND date(scraped_at) = date('now')
      GROUP BY bank
    ) latest ON r.bank = latest.bank AND r.scraped_at = latest.max_scraped
    WHERE r.currency = ? AND date(r.scraped_at) = date('now')
    ${orderClause}
>>>>>>> Stashed changes
  `).all(currency, currency)

  return rows
}

export function getLatestScrapeTime(bank) {
  const row = db.prepare(`
    SELECT scraped_at FROM rates
    WHERE bank = ?
    ORDER BY scraped_at DESC
    LIMIT 1
  `).get(bank)

  return row ? row.scraped_at : null
}

export function closeDb() {
  db.close()
}
