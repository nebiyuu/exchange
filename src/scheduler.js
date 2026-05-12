import cron from 'node-cron'
import { getScrapers } from './scrapers/index.js'
import { saveRates } from '../db/db.js'
import dotenv from 'dotenv'

dotenv.config()

const CRON_SCHEDULE = process.env.SCRAPE_CRON || '0 9 * * *'

async function scrapeAll() {
  const scrapers = getScrapers()

  for (const { code, name, scrape } of scrapers) {
    try {
      console.log(`[scheduler] Scraping ${code} (${name})...`)
      const records = await scrape()
      if (records.length > 0) {
        saveRates(records)
        console.log(`[scheduler] ${code}: saved ${records.length} rates`)
      } else {
        console.warn(`[scheduler] ${code}: no data returned`)
      }
    } catch (err) {
      console.error(`[scheduler] ${code}: error -`, err.message)
    }
  }
}

cron.schedule(CRON_SCHEDULE, scrapeAll)
console.log(`[scheduler] Scrape cron set: ${CRON_SCHEDULE}`)

export async function runNow() {
  console.log('[scheduler] Running initial scrape...')
  await scrapeAll()
}
