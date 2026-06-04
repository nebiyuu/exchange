import cron from 'node-cron'
import { getScrapers } from './scrapers/index.js'
import { saveRates, hasRatesForToday, logScrapeAttempt } from '../db/db.js'
import dotenv from 'dotenv'

dotenv.config()

const CRON_SCHEDULE = process.env.SCRAPE_CRON || '0 9 * * *'
const MAX_RETRIES = parseInt(process.env.SCRAPE_RETRIES || '2', 10)
let aborted = false

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function scrapeBank({ code, name, scrape }) {
  if (aborted) return

  if (hasRatesForToday(code)) {
    console.log(`[scheduler] ${code}: already scraped today, skipping`)
    logScrapeAttempt({ bank: code, status: 'skipped' })
    return
  }

  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt) * 1000
      console.log(`[scheduler] ${code}: retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`)
      await sleep(delay)
    }

    if (aborted) {
      console.log('[scheduler] Aborted during scrape')
      return
    }

    console.log(`[scheduler] Scraping ${code} (${name})...`)
    const start = Date.now()

    let records, error
    try {
      const result = await scrape()
      records = result.records || []
      error = result.error || null
    } catch (err) {
      records = []
      error = err.message
    }

    const durationMs = Date.now() - start

    if (aborted) {
      console.log('[scheduler] Aborted after scrape, discarding results')
      return
    }

    if (records.length > 0) {
      saveRates(records)
      console.log(`[scheduler] ${code}: saved ${records.length} rates (${durationMs}ms)`)
      logScrapeAttempt({ bank: code, status: 'success', ratesCount: records.length, durationMs })
      return
    }

    lastError = error
    console.warn(`[scheduler] ${code}: attempt ${attempt + 1} failed${error ? ' - ' + error : ''} (${durationMs}ms)`)
  }

  console.error(`[scheduler] ${code}: all ${MAX_RETRIES + 1} attempts failed`)
  logScrapeAttempt({
    bank: code,
    status: 'failure',
    errorMessage: lastError || 'no data returned',
  })
}

async function scrapeAll() {
  const scrapers = getScrapers()

  for (const scraper of scrapers) {
    if (scraper.active === false) {
      console.log(`[scheduler] ${scraper.code}: inactive, skipping`)
      continue
    }
    if (aborted) {
      console.log('[scheduler] Aborted, stopping scrape')
      return
    }
    await scrapeBank(scraper)
  }
}

const task = cron.schedule(CRON_SCHEDULE, scrapeAll)
console.log(`[scheduler] Scrape cron set: ${CRON_SCHEDULE}`)

export async function runNow() {
  console.log('[scheduler] Running initial scrape...')
  await scrapeAll()
}

export function stopScheduler() {
  aborted = true
  task.stop()
}
