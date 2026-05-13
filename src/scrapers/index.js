import * as cbe from './cbe.js'
import * as awash from './awash.js'
import * as dashen from './dashen.js'

const registry = [
  { code: 'CBE', name: 'Commercial Bank of Ethiopia', scrape: cbe.scrape },
  { code: 'AWASH', name: 'Awash Bank', scrape: awash.scrape },
  { code: 'DASHEN', name: 'Dashen Bank', scrape: dashen.scrape },
]

export function getScrapers() {
  return registry
}

export function getScraper(code) {
  return registry.find((s) => s.code === code.toUpperCase()) || null
}
