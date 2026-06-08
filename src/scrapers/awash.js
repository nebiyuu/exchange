import axios from 'axios'
import { hasRatesForToday } from '../../db/db.js'

const PAGE_URL = 'https://awashbank.com/exchange-historical/'
const AJAX_URL = 'https://awashbank.com/wp-admin/admin-ajax.php'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

function extractNonce(js) {
  const match = js.match(
    /exchangeRatesVars\s*=\s*({[^;]+})/
  )
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1])
    return parsed.nonce || null
  } catch {
    return null
  }
}

function extractBundleUrl(html) {
  const match = html.match(
    /<script[^>]+data-src="([^"]*litespeed\/js\/[^"]+\.js[^"]*)"/
  )
  return match ? match[1] : null
}

export async function scrape() {
  if (hasRatesForToday('AWASH')) {
    console.log('[awash] Already scraped today, skipping')
    return { records: [], error: null }
  }
  try {
    const pageResp = await axios.get(PAGE_URL, {
      headers: HEADERS,
      timeout: 25000,
    })
    const html = pageResp.data

    const bundleUrl = extractBundleUrl(html)
    if (!bundleUrl) {
      console.error('[awash] Could not find LiteSpeed bundle URL')
      return { records: [], error: 'Could not find LiteSpeed bundle URL' }
    }

    const jsResp = await axios.get(bundleUrl, {
      headers: {
        'User-Agent': HEADERS['User-Agent'],
        Accept: '*/*',
      },
      timeout: 30000,
    })
    const js = typeof jsResp.data === 'string' ? jsResp.data : jsResp.data.toString()

    const nonce = extractNonce(js)
    if (!nonce) {
      console.error('[awash] Could not extract nonce from bundle JS')
      return { records: [], error: 'Could not extract nonce from bundle JS' }
    }

    const formData = new URLSearchParams()
    formData.append('action', 'get_exchange_rates')
    formData.append('nonce', nonce)
    formData.append('shortcode_type', 'exchange_rates')

    const ajaxResp = await axios.post(AJAX_URL, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': HEADERS['User-Agent'],
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
        Origin: 'https://awashbank.com',
        Referer: PAGE_URL,
      },
      timeout: 20000,
    })

    const body = ajaxResp.data
    if (!body.success) {
      console.error('[awash] AJAX request failed:', body.data || body)
      return { records: [], error: 'AJAX request failed: ' + (body.data || body) }
    }

    const rates = body.data && body.data.rates
    if (!rates || typeof rates !== 'object') {
      console.error('[awash] Unexpected response format')
      return { records: [], error: 'Unexpected response format' }
    }

    const scrapedAt = new Date().toISOString()

    const records = Object.entries(rates)
      .map(([currency, entry]) => ({
        bank: 'AWASH',
        currency: currency.toUpperCase().trim(),
        cash_buying: parseFloat(entry.buying) || null,
        cash_selling: parseFloat(entry.selling) || null,
        transactional_buying: parseFloat(entry.transaction_buying) || null,
        transactional_selling: parseFloat(entry.transaction_selling) || null,
        scraped_at: scrapedAt,
      }))
      .filter((r) => r.currency)

    return { records, error: null }
  } catch (err) {
    console.error('[awash] Scrape failed:', err.message)
    return { records: [], error: err.message }
  }
}
