# Ethiopian Bank Exchange Rate API

Scrapes daily forex rates from 9 Ethiopian banks, stores them in SQLite, exposes them via REST.

[![Node](https://img.shields.io/badge/node-22-339933)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-4-000000)](https://expressjs.com)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED)](https://www.docker.com)
[![SQLite](https://img.shields.io/badge/sqlite-WAL-003B57)](https://www.sqlite.org/wal.html)

**Live:** [eth-rates.duckdns.org](https://eth-rates.duckdns.org) &nbsp;·&nbsp; **Docs:** [/docs](https://eth-rates.duckdns.org/docs)

```bash
curl https://eth-rates.duckdns.org/health
# {"status":"ok","time":"2026-06-02T09:00:00.000Z"}
```

## What it does

Runs a daily scrape of Ethiopian bank websites — some are JSON APIs, others need AJAX or HTML parsing — normalizes everything into one schema, saves to SQLite, and serves it up with Swagger docs.

## Supported banks

| Code | Bank | Source type |
| --- | --- | --- |
| CBE | Commercial Bank of Ethiopia | Public JSON API |
| AWASH | Awash Bank | WordPress AJAX (nonce-authenticated) |
| DASHEN | Dashen Bank | HTML table |
| ZAMZAM | ZamZam Bank | HTML table |
| BERHAN | Berhan Bank | HTML grid |
| ZEMEN | Zemen Bank | HTML panels |
| SIINQEE | Siinqee Bank | HTML table |
| ABYSSINIA | Bank of Abyssinia | TablePress HTML |
| COOP | Cooperative Bank of Oromia | Skeleton (source TBD) |

## Quick start

```bash
npm install
npm run dev      # node --watch, hot reload
# open http://localhost:3000/docs
```

On startup it scrapes every bank immediately, then repeats daily at `0 9 * * *`.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/banks` | List supported banks |
| `GET` | `/rates/:bank?currency=USD,EUR` | Latest rates for a bank (optional currency filter) |
| `GET` | `/compare/:currency` | Compare a currency across all banks (sorted by cash buying desc) |
| `GET` | `/best/:currency?type=buying` | Best rate for a currency (`buying`, `selling`, `transactional_buying`, `transactional_selling`) |
| `GET` | `/rates/:bank/:currency/history?from=&to=` | Date-filtered history (`YYYY-MM-DD`) |
| `GET` | `/health` | Liveness check |
| `GET` | `/docs` | Interactive Swagger UI |

### Examples

```bash
# Latest USD/EUR rates from CBE
curl https://eth-rates.duckdns.org/rates/CBE?currency=USD,EUR

# Compare USD buying rates across all banks
curl https://eth-rates.duckdns.org/compare/USD

# Best USD selling rate
curl 'https://eth-rates.duckdns.org/best/USD?type=selling'

# 30-day USD history from Awash
curl 'https://eth-rates.duckdns.org/rates/AWASH/USD/history?from=2026-05-01&to=2026-05-31'
```

### Response shape

```json
{
  "bank": "CBE",
  "scraped_at": "2026-06-02T09:00:12.000Z",
  "rates": [
    {
      "currency": "USD",
      "cash_buying": 126.45,
      "cash_selling": 128.90,
      "transactional_buying": 127.15,
      "transactional_selling": 128.50
    }
  ]
}
```

Rate fields are nullable — not every bank publishes all four. `/compare/:currency` is current-day only. `/best/:currency` goes off the most recent scrape per bank regardless of date.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `db/rates.db` | SQLite database file |
| `SCRAPE_CRON` | `0 9 * * *` | node-cron schedule |

## Architecture

```
  Bank websites (JSON / AJAX / HTML)
            │
            ▼
   src/scrapers/*.js   (one file per bank)
            │
            ▼
   src/scheduler.js    (cron + skip-if-today + abort on shutdown)
            │
            ▼
   db/rates.db         (better-sqlite3, WAL mode)
            │
            ▼
   src/api/app.js      (Express + OpenAPI/Swagger UI)
```

`server.js` handles `SIGTERM`/`SIGINT` graceful shutdown with a 10s forced-exit fallback.

## Deployment

```bash
docker compose up -d
```

Image at `ghcr.io/nebiyuu/exchange`. The compose file mounts a named volume at `/data` and sets `DB_PATH=/data/rates.db`, so history survives container restarts. GitHub Actions builds on push to `main` and deploys via SSH.

## Development

### Project layout

```
server.js                  # entrypoint, graceful shutdown
src/api/app.js             # Express routes + OpenAPI annotations
src/api/openapi.js         # OpenAPI 3 spec
src/scheduler.js           # cron loop, calls every scraper
src/scrapers/index.js      # registry — add new scrapers here
src/scrapers/<bank>.js     # one file per bank
db/db.js                   # schema, queries, prepared statements
```

### Scraper patterns

Three categories, pick one for the bank you're adding:

- **Public JSON API** — hit a REST endpoint and map the response. Simplest path. See `cbe.js`.
- **WordPress AJAX** — fetch the page to grab a nonce from the bundled JS, then POST to `wp-admin/admin-ajax.php`. See `awash.js`.
- **Rendered HTML** — load with cheerio and walk the DOM (tables, panels, grids, image filenames). See `dashen.js`, `zamzam.js`, `zemen.js`, `siinqee.js`, `berhan.js`, `abyssinia.js`.

### Adding a bank

1. Create `src/scrapers/<name>.js` with `export async function scrape()`.
2. Add it to `src/scrapers/index.js` — import the module, push a `{ code, name, scrape }` entry.
3. Return rows matching the schema below. The scheduler takes care of persistence and skip-if-today.

### Conventions

- ESM only. `"type": "module"`. No CommonJS.
- Scrapers don't throw. The body goes inside `try { ... } catch { return [] }`. One bank breaking shouldn't take down the rest.
- All rate fields use `parseFloat(x) || null`. Null is normal.
- Bank codes are uppercased everywhere — code, DB, API responses.
- Every `axios` call gets a real browser User-Agent and a 15s timeout.

### Schema

What a scraper must return (maps 1:1 to the `rates` table):

```js
{
  bank: 'CODE',
  currency: 'USD',
  cash_buying: 126.45,
  cash_selling: 128.90,
  transactional_buying: 127.15,
  transactional_selling: 128.50,
  scraped_at: '2026-06-02T09:00:12.000Z'
}
```

All numeric fields can be `null`.

### Database helpers

`db/db.js` has these — use them instead of raw SQL:

- `saveRates(records)`
- `getRatesByBank(bank, currencies?)`
- `getRatesByCurrency(currency)`
- `getBestRate(currency, type)`
- `getRateHistory(bank, currency, from?, to?)`
- `hasRatesForToday(bank)`
- `getLatestScrapeTime(bank)`
