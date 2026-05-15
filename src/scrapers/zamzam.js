import axios from 'axios'
import * as cheerio from 'cheerio'
import { hasRatesForToday } from '../../db/db.js'

const PAGE_URL = 'https://zamzambank.com/exchange-rate/'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
}

export async function scrape() {
  if (hasRatesForToday('ZAMZAM')) {
    console.log('[zamzam] Already scraped today, skipping')
    return []
  }
  try {
    const { data: html } = await axios.get(PAGE_URL, {
      headers: HEADERS,
      timeout: 25000,
    })

    const $ = cheerio.load(html)
    const rateMap = {}

    $('.zzb-fx-table tbody tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length < 5) return
      const name = $(cells[0]).text().trim()
      const codeMatch = name.match(/^([A-Z]{3})\b/)
      if (!codeMatch) return
      const code = codeMatch[1]
      const cashBuy = parseFloat($(cells[1]).text().trim()) || null
      const cashSell = parseFloat($(cells[2]).text().trim()) || null
      const transBuy = parseFloat($(cells[3]).text().trim()) || null
      const transSell = parseFloat($(cells[4]).text().trim()) || null
      rateMap[code] = { cash_buying: cashBuy, cash_selling: cashSell, transactional_buying: transBuy, transactional_selling: transSell }
    })

    const scrapedAt = new Date().toISOString()
    return Object.entries(rateMap)
      .map(([currency, rates]) => ({
        bank: 'ZAMZAM',
        currency,
        ...rates,
        scraped_at: scrapedAt,
      }))
      .filter((r) => r.currency)
  } catch (err) {
    console.error('[zamzam] Scrape failed:', err.message)
    return []
  }
}
