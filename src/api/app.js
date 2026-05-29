import express from 'express'
import swaggerUi from 'swagger-ui-express'
import openapiSpec from './openapi.js'
import { getRatesByBank, getRatesByCurrency, getRateHistory, getBestRate } from '../../db/db.js'
import { getScrapers } from '../scrapers/index.js'

const app = express()
app.use(express.json())

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))

app.get('/docs.json', (_req, res) => {
  res.json(openapiSpec)
})

/**
 * @openapi
 * /banks:
 *   get:
 *     summary: List all supported banks
 *     tags: [Banks]
 *     responses:
 *       200:
 *         description: List of banks with their codes and names
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 banks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bank'
 */
app.get('/banks', (_req, res) => {
  const banks = getScrapers().map(({ code, name }) => ({ code, name }))
  res.json({ banks })
})

/**
 * @openapi
 * /rates/{bank}:
 *   get:
 *     summary: Get latest exchange rates for a bank
 *     tags: [Rates]
 *     parameters:
 *       - in: path
 *         name: bank
 *         required: true
 *         schema:
 *           type: string
 *         description: Bank code (e.g. CBE, AWASH, DASHEN)
 *         example: CBE
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Comma-separated currency codes to filter (e.g. USD,EUR)
 *         example: USD,EUR
 *     responses:
 *       200:
 *         description: Latest exchange rates for the requested bank
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BankRatesResponse'
 *       404:
 *         description: No rates found for the given bank code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/rates/:bank', (req, res) => {
  const bank = req.params.bank.toUpperCase()
  const currencies = req.query.currency
    ? req.query.currency.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
    : []
  const rows = getRatesByBank(bank, currencies)

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

/**
 * @openapi
 * /compare/{currency}:
 *   get:
 *     summary: Compare exchange rates across all banks for a currency
 *     tags: [Rates]
 *     parameters:
 *       - in: path
 *         name: currency
 *         required: true
 *         schema:
 *           type: string
 *         description: Currency code (e.g. USD, EUR, GBP)
 *         example: USD
 *     responses:
 *       200:
 *         description: Comparison of rates across all banks sorted by cash_buying descending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompareResponse'
 *       404:
 *         description: No rates found for the given currency
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/compare/:currency', (req, res) => {
  const currency = req.params.currency.toUpperCase()
  const rows = getRatesByCurrency(currency)

  if (!rows.length) {
    return res.status(404).json({ error: `No rates found for currency: ${currency}` })
  }

  const banks = Object.fromEntries(
    getScrapers().map(({ code, name }) => [code, name])
  )

  res.json({
    currency,
    rates: rows.map((r) => ({
      bank: { code: r.bank, name: banks[r.bank] || r.bank },
      cash_buying: r.cash_buying,
      cash_selling: r.cash_selling,
      transactional_buying: r.transactional_buying,
      transactional_selling: r.transactional_selling,
      scraped_at: r.scraped_at,
    })),
  })
})

/**
 * @openapi
 * /best/{currency}:
 *   get:
 *     summary: Get the best rate for a currency across all banks
 *     tags: [Rates]
 *     parameters:
 *       - in: path
 *         name: currency
 *         required: true
 *         schema:
 *           type: string
 *         description: Currency code (e.g. USD, EUR, GBP)
 *         example: USD
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [buying, selling, transactional_buying, transactional_selling]
 *           default: buying
 *         description: Rate type to compare (buying=highest cash buying, selling=lowest cash selling)
 *         example: buying
 *     responses:
 *       200:
 *         description: Best bank and rate for the requested currency and rate type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BestRateResponse'
 *       400:
 *         description: Invalid rate type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No rates found for the given currency
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/best/:currency', (req, res) => {
  const currency = req.params.currency.toUpperCase()
  const type = req.query.type || 'buying'

  const validTypes = ['buying', 'selling', 'transactional_buying', 'transactional_selling']
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type: ${type}. Valid: ${validTypes.join(', ')}` })
  }

  const row = getBestRate(currency, type)
  if (!row) {
    return res.status(404).json({ error: `No rates found for currency: ${currency}` })
  }

  const banks = Object.fromEntries(
    getScrapers().map(({ code, name }) => [code, name])
  )

  res.json({
    currency,
    type,
    bank: { code: row.bank, name: banks[row.bank] || row.bank },
    rate: row[type.includes('selling')
      ? (type === 'selling' ? 'cash_selling' : 'transactional_selling')
      : (type === 'buying' ? 'cash_buying' : 'transactional_buying')],
    cash_buying: row.cash_buying,
    cash_selling: row.cash_selling,
    transactional_buying: row.transactional_buying,
    transactional_selling: row.transactional_selling,
    scraped_at: row.scraped_at,
  })
})

/**
 * @openapi
 * /rates/{bank}/{currency}/history:
 *   get:
 *     summary: Get rate history for a bank and currency
 *     tags: [History]
 *     parameters:
 *       - in: path
 *         name: bank
 *         required: true
 *         schema:
 *           type: string
 *         description: Bank code (e.g. CBE, AWASH, DASHEN)
 *         example: CBE
 *       - in: path
 *         name: currency
 *         required: true
 *         schema:
 *           type: string
 *         description: Currency code (e.g. USD, EUR, GBP)
 *         example: USD
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD) for filtering
 *         example: '2026-05-01'
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD) for filtering
 *         example: '2026-05-21'
 *     responses:
 *       200:
 *         description: Rate history for the bank and currency
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateHistoryResponse'
 *       404:
 *         description: No rates found for the given bank and currency
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/rates/:bank/:currency/history', (req, res) => {
  const bank = req.params.bank.toUpperCase()
  const currency = req.params.currency.toUpperCase()
  const { from, to } = req.query

  const history = getRateHistory(bank, currency, from || null, to || null)

  if (!history.length) {
    return res.status(404).json({ error: `No rates found for ${bank} ${currency}` })
  }

  res.json({
    bank,
    currency,
    history: history.map((r) => ({
      scraped_at: r.scraped_at,
      cash_buying: r.cash_buying,
      cash_selling: r.cash_selling,
      transactional_buying: r.transactional_buying,
      transactional_selling: r.transactional_selling,
    })),
  })
})

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 time:
 *                   type: string
 *                   format: date-time
 *                   example: '2026-05-18T12:00:00.000Z'
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

export default app
