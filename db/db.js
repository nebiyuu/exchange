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

db.exec(`
  CREATE TABLE IF NOT EXISTS scrape_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank TEXT NOT NULL,
    status TEXT NOT NULL,
    rates_count INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER,
    attempted_at TEXT NOT NULL
  )
`)

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_scrape_audit_bank
  ON scrape_audit(bank, attempted_at DESC)
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
    WHERE r.currency = ?
    ORDER BY r.cash_buying DESC
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

export function logScrapeAttempt({ bank, status, ratesCount = 0, errorMessage = null, durationMs = 0 }) {
  db.prepare(`
    INSERT INTO scrape_audit (bank, status, rates_count, error_message, duration_ms, attempted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(bank, status, ratesCount, errorMessage, durationMs, new Date().toISOString())
}

export function getScrapersStatus() {
  const rows = db.prepare(`
    SELECT a.bank, a.status, a.rates_count, a.error_message, a.duration_ms, a.attempted_at,
      (SELECT MAX(attempted_at) FROM scrape_audit WHERE bank = a.bank AND status = 'success') as last_success_at
    FROM scrape_audit a
    WHERE a.id IN (SELECT MAX(id) FROM scrape_audit GROUP BY bank)
  `).all()

  const today = new Date().toISOString().slice(0, 10)
  return rows.map(r => ({
    bank: r.bank,
    status: r.attempted_at && r.attempted_at.startsWith(today) ? r.status : 'pending',
    rates_count: r.rates_count,
    error: r.error_message || null,
    duration_ms: r.duration_ms,
    last_success_at: r.last_success_at || null,
    last_attempt_at: r.attempted_at || null,
  }))
}

export function closeDb() {
  db.close()
}
