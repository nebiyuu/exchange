import axios from 'axios'
import * as cheerio from 'cheerio'
import { hasRatesForToday } from '../../db/db.js'

const PAGE_URL = 'https://www.bankofabyssinia.com/exchange-rate-2/'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
}

export async function scrape() {
  if (hasRatesForToday('ABYSSINIA')) {
    console.log('[abyssinia] Already scraped today, skipping')
    return []
  }
  try {
    const { data: html } = await axios.get(PAGE_URL, {
      headers: HEADERS,
      timeout: 25000,
    })

    const $ = cheerio.load(html)
    const rateMap = {}
    let section = null

    $('.tablepress tbody tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length < 3) return
      const first = $(cells[0]).text().trim()

      if (first === 'Cash Rates') { section = 'cash'; return }
      if (first === 'Transaction Rates') { section = 'transaction'; return }
      if (first === 'Currency type') return
      if (!section) return

      const codeMatch = first.match(/^([A-Z]{3})$/)
      if (!codeMatch) return
      const code = codeMatch[1]
      const buying = parseFloat($(cells[1]).text().trim()) || null
      const selling = parseFloat($(cells[2]).text().trim()) || null

      if (!rateMap[code]) {
        rateMap[code] = {
          cash_buying: null, cash_selling: null,
          transactional_buying: null, transactional_selling: null,
        }
      }

      if (section === 'cash') {
        rateMap[code].cash_buying = buying
        rateMap[code].cash_selling = selling
      } else {
        rateMap[code].transactional_buying = buying
        rateMap[code].transactional_selling = selling
      }
    })

    const scrapedAt = new Date().toISOString()
    return Object.entries(rateMap)
      .map(([currency, rates]) => ({
        bank: 'ABYSSINIA',
        currency,
        ...rates,
        scraped_at: scrapedAt,
      }))
      .filter((r) => r.currency)
  } catch (err) {
    console.error('[abyssinia] Scrape failed:', err.message)
    return []
  }
}
