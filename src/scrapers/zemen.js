import axios from 'axios'
import * as cheerio from 'cheerio'
import { hasRatesForToday } from '../../db/db.js'

const PAGE_URL = 'https://www.zemenbank.com/exchange-rate/'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
}

export async function scrape() {
  if (hasRatesForToday('ZEMEN')) {
    console.log('[zemen] Already scraped today, skipping')
    return { records: [], error: null }
  }
  try {
    const { data: html } = await axios.get(PAGE_URL, {
      headers: HEADERS,
      timeout: 25000,
    })

    const $ = cheerio.load(html)
    const rateMap = {}

    $('.exr-tab-panel').each((_, panel) => {
      const panelType = $(panel).attr('data-panel')
      let rateType = null
      if (panelType === 'today') rateType = 'transaction'
      else if (panelType === 'cash') rateType = 'cash'
      else return

      $(panel).find('.exr-row').each((_, row) => {
        const code = $(row).find('.exr-currency-code').text().trim().toUpperCase()
        if (!code || code.length !== 3) return

        const cols = $(row).find('.exr-column')
        const buying = parseFloat($(cols[1]).text().trim()) || null
        const selling = parseFloat($(cols[2]).text().trim()) || null

        if (!rateMap[code]) {
          rateMap[code] = {
            cash_buying: null,
            cash_selling: null,
            transactional_buying: null,
            transactional_selling: null,
          }
        }

        if (rateType === 'cash') {
          rateMap[code].cash_buying = buying
          rateMap[code].cash_selling = selling
        } else {
          rateMap[code].transactional_buying = buying
          rateMap[code].transactional_selling = selling
        }
      })
    })

    const scrapedAt = new Date().toISOString()
    const records = Object.entries(rateMap)
      .map(([currency, rates]) => ({
        bank: 'ZEMEN',
        currency,
        ...rates,
        scraped_at: scrapedAt,
      }))
      .filter((r) => r.currency)
    return { records, error: null }
  } catch (err) {
    console.error('[zemen] Scrape failed:', err.message)
    return { records: [], error: err.message }
  }
}
