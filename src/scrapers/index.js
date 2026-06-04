import * as cbe from './cbe.js'
import * as awash from './awash.js'
import * as dashen from './dashen.js'
import * as zamzam from './zamzam.js'
import * as berhan from './berhan.js'
import * as zemen from './zemen.js'
import * as siinqee from './siinqee.js'
import * as abyssinia from './abyssinia.js'
import * as coop from './coop.js'

const registry = [
  { code: 'CBE', name: 'Commercial Bank of Ethiopia', scrape: cbe.scrape },
  { code: 'AWASH', name: 'Awash Bank', scrape: awash.scrape },
  { code: 'DASHEN', name: 'Dashen Bank', scrape: dashen.scrape },
  { code: 'ZAMZAM', name: 'ZamZam Bank', scrape: zamzam.scrape },
  { code: 'BERHAN', name: 'Berhan Bank', scrape: berhan.scrape },
  { code: 'ZEMEN', name: 'Zemen Bank', scrape: zemen.scrape },
  { code: 'SIINQEE', name: 'Siinqee Bank', scrape: siinqee.scrape },
  { code: 'ABYSSINIA', name: 'Bank of Abyssinia', scrape: abyssinia.scrape },
  { code: 'COOP', name: 'Cooperative Bank of Oromia', scrape: coop.scrape, active: false },
]

export function getScrapers() {
  return registry
}

export function getScraper(code) {
  return registry.find((s) => s.code === code.toUpperCase()) || null
}
