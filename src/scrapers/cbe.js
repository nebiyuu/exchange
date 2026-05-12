import axios from 'axios'

const BASE_URL = 'https://combanketh.et/cbeapi/daily-exchange-rates'

export async function scrape() {
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
      return []
    }

    const latest = data[0]
    const rates = latest.ExchangeRate || []
    const scrapedAt = new Date().toISOString()

    return rates
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
  } catch (err) {
    console.error('[cbe] Scrape failed:', err.message)
    return []
  }
}
