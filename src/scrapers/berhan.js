import axios from 'axios'
import * as cheerio from 'cheerio'
import { hasRatesForToday } from '../../db/db.js'

const PAGE_URL = 'https://berhanbanksc.com/exchange-rates/'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
}

export async function scrape() {
  if (hasRatesForToday('BERHAN')) {
    console.log('[berhan] Already scraped today, skipping')
    return []
  }
  try {
    const { data: html } = await axios.get(PAGE_URL, {
      headers: HEADERS,
      timeout: 25000,
    })

    const $ = cheerio.load(html)
    const rates = []

    $('.row.customRow').each((_, row) => {
      const imgSrc = $(row).find('.col-6 img.roundedImage').attr('src') || ''
      const codeMatch = imgSrc.match(/\/([A-Z]{3})\.png/i)
      const code = codeMatch ? codeMatch[1].toUpperCase() : null
      if (!code) return

      const buyingCell = $(row).find('.col-3').first()
      const sellingCell = $(row).find('.col-3').last()
      const buying = parseFloat(buyingCell.text().trim()) || null
      const selling = parseFloat(sellingCell.text().trim()) || null

      if (buying === null && selling === null) return

      rates.push({ currency: code, buying, selling })
    })

    const scrapedAt = new Date().toISOString()
    return rates.map((r) => ({
      bank: 'BERHAN',
      currency: r.currency,
      cash_buying: r.buying,
      cash_selling: r.selling,
      transactional_buying: r.buying,
      transactional_selling: r.selling,
      scraped_at: scrapedAt,
    }))
  } catch (err) {
    console.error('[berhan] Scrape failed:', err.message)
    return []
  }
}
