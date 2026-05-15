import axios from 'axios'
import { hasRatesForToday } from '../../db/db.js'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
}

export async function scrape() {
  if (hasRatesForToday('COOP')) {
    console.log('[coop] Already scraped today, skipping')
    return []
  }
  console.warn('[coop] Exchange rate data source not yet discovered, skipping')
  return []
}
