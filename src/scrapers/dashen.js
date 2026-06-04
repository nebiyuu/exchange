import axios from 'axios'
import * as cheerio from 'cheerio'
import { hasRatesForToday } from '../../db/db.js'

const PAGE_URL = 'https://dashenbanksc.com/daily-exchange-rates/'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
}

export async function scrape() {
  if (hasRatesForToday('DASHEN')) {
    console.log('[dashen] Already scraped today, skipping')
    return { records: [], error: null }
  }
  try {
    const { data: html } = await axios.get(PAGE_URL, {
      headers: HEADERS,
      timeout: 25000,
    })

    const $ = cheerio.load(html)
    const rateMap = {}

    $('table').each((_, table) => {
      let tableType = null

      $(table)
        .find('tr')
        .each((_, row) => {
          const cells = $(row).find('td')
          if (cells.length < 3) return

          const firstCell = $(cells[0]).text().trim()

          if (firstCell.includes('Currency Code')) {
            const headerText = $(row).text()
            if (headerText.includes('Transaction Buying')) tableType = 'transaction'
            else if (headerText.includes('Cash Buying')) tableType = 'cash'
            else tableType = null
            return
          }

          if (firstCell.includes('Weighted Average')) {
            tableType = null
            return
          }

          if (!tableType) return

          const codeMatch = firstCell.match(/\b([A-Z]{3})\b/)
          if (!codeMatch) return

          const currency = codeMatch[1]

          const buyingCell = $(cells[2]).text().trim()
          const sellingCell = $(cells[3]).text().trim()
          const buying = parseFloat(buyingCell) || null
          const selling = parseFloat(sellingCell) || null

          if (buying === null && selling === null) return

          if (!rateMap[currency]) {
            rateMap[currency] = {
              cash_buying: null,
              cash_selling: null,
              transactional_buying: null,
              transactional_selling: null,
            }
          }

          if (tableType === 'transaction') {
            rateMap[currency].transactional_buying = buying
            rateMap[currency].transactional_selling = selling
          } else if (tableType === 'cash') {
            rateMap[currency].cash_buying = buying
            rateMap[currency].cash_selling = selling
          }
        })
    })

    const scrapedAt = new Date().toISOString()

    const records = Object.entries(rateMap)
      .map(([currency, rates]) => ({
        bank: 'DASHEN',
        currency,
        cash_buying: rates.cash_buying,
        cash_selling: rates.cash_selling,
        transactional_buying: rates.transactional_buying,
        transactional_selling: rates.transactional_selling,
        scraped_at: scrapedAt,
      }))
      .filter((r) => r.currency)

    return { records, error: null }
  } catch (err) {
    console.error('[dashen] Scrape failed:', err.message)
    return { records: [], error: err.message }
  }
}
