import * as cbe from './cbe.js'

const registry = [
  { code: 'CBE', name: 'Commercial Bank of Ethiopia', scrape: cbe.scrape },
]

export function getScrapers() {
  return registry
}

export function getScraper(code) {
  return registry.find((s) => s.code === code.toUpperCase()) || null
}
