import axios from 'axios'
import { hasRatesForToday } from '../../db/db.js'

const BASE_URL = 'https://combanketh.et/cbeapi/daily-exchange-rates'

export async function scrape() {
  if (hasRatesForToday('CBE')) {
    console.log('[cbe] Already scraped today, skipping')
    return { records: [], error: null }
  }
  try {
    const { data } = await axios.get(BASE_URL, {
      params: {
        _limit: 1,
        _sort: 'Date:DESC',
      },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      timeout: 15000,
    })

    if (!Array.isArray(data) || data.length === 0) {
      console.error('[cbe] No exchange rate data returned')
      return { records: [], error: 'No exchange rate data returned' }
    }

    const latest = data[0]
    const rates = latest.ExchangeRate || []
    const scrapedAt = new Date().toISOString()

    const records = rates
      .map((entry) => ({
        bank: 'CBE',
        currency: entry.currency?.CurrencyCode?.toUpperCase().trim() || '',
        cash_buying: parseFloat(entry.cashBuying) || null,
        cash_selling: parseFloat(entry.cashSelling) || null,
        transactional_buying: parseFloat(entry.transactionalBuying) || null,
        transactional_selling: parseFloat(entry.transactionalSelling) || null,
        scraped_at: scrapedAt,
      }))
      .filter((r) => r.currency)

    return { records, error: null }
  } catch (err) {
    console.error('[cbe] Scrape failed:', err.message)
    return { records: [], error: err.message }
  }
}
