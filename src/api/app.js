import express from 'express'
import { getRatesByBank } from '../../db/db.js'
import { getScrapers } from '../scrapers/index.js'

const app = express()
app.use(express.json())

app.get('/banks', (_req, res) => {
  const banks = getScrapers().map(({ code, name }) => ({ code, name }))
  res.json({ banks })
})

app.get('/rates/:bank', (req, res) => {
  const bank = req.params.bank.toUpperCase()
  const rows = getRatesByBank(bank)

  if (!rows.length) {
    return res.status(404).json({ error: `No rates found for bank: ${bank}` })
  }

  res.json({
    bank,
    scraped_at: rows[0].scraped_at,
    rates: rows.map((r) => ({
      currency: r.currency,
      cash_buying: r.cash_buying,
      cash_selling: r.cash_selling,
      transactional_buying: r.transactional_buying,
      transactional_selling: r.transactional_selling,
    })),
  })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

export default app
