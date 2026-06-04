import axios from 'axios'
import * as cheerio from 'cheerio'
import { hasRatesForToday } from '../../db/db.js'

const PAGE_URL = 'https://siinqeebank.com/exchange-rate/'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
}

export async function scrape() {
  if (hasRatesForToday('SIINQEE')) {
    console.log('[siinqee] Already scraped today, skipping')
    return { records: [], error: null }
  }
  try {
    const { data: html } = await axios.get(PAGE_URL, {
      headers: HEADERS,
      timeout: 25000,
      validateStatus: (s) => s < 500,
    })

    const $ = cheerio.load(html)
    const rates = []

    $('.table-2 table tbody tr, table tbody tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length < 3) return
      const cellText = $(cells[0]).text().trim()
      const codeMatch = cellText.match(/\b([A-Z]{3})\b/)
      if (!codeMatch) return
      const buying = parseFloat($(cells[1]).text().trim()) || null
      const selling = parseFloat($(cells[2]).text().trim()) || null
      if (buying === null && selling === null) return
      rates.push({ currency: codeMatch[1], buying, selling })
    })

    const scrapedAt = new Date().toISOString()
    const records = rates.map((r) => ({
      bank: 'SIINQEE',
      currency: r.currency,
      cash_buying: r.buying,
      cash_selling: r.selling,
      transactional_buying: r.buying,
      transactional_selling: r.selling,
      scraped_at: scrapedAt,
    }))
    return { records, error: null }
  } catch (err) {
    console.error('[siinqee] Scrape failed:', err.message)
    return { records: [], error: err.message }
  }
}
