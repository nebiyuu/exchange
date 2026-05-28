# eth-bank-rates — Ethiopian Bank Exchange Rate Scraper API

## Quick start

```bash
npm install
npm run dev     # node --watch server.js (hot-reload)
npm start       # node server.js
```

- Runs on `PORT` (default 3000).
- On startup, triggers an immediate scrape of all banks, then repeats daily at `SCRAPE_CRON` (`0 9 * * *`).
- `.env` controls: `PORT`, `DB_PATH` (default `db/rates.db`), `SCRAPE_CRON`.

## Architecture

- ES modules only (`"type": "module"`).
- `server.js` — entrypoint, graceful shutdown on SIGTERM/SIGINT.
- `src/api/app.js` — Express app (routes + Swagger UI).
  - `GET /banks` — list supported banks
  - `GET /rates/:bank` — latest rates for one bank (uppercased param)
  - `GET /rates/:bank/:currency/history?from=&to=` — date-filtered history
  - `GET /compare/:currency` — cross-bank comparison sorted by cash_buying desc
  - `GET /health`
  - `GET /docs` — Swagger UI, `GET /docs.json` — raw spec
- `src/scrapers/*.js` — one file per bank (9 total).
  - Registered in `src/scrapers/index.js`. Add a new scraper by adding to both.
  - Each scraper exports an `async function scrape()` that returns `{ bank, currency, cash_buying, cash_selling, transactional_buying, transactional_selling, scraped_at }[]`.
  - Scrapers **never throw** — catch errors and return `[]`.
  - Coop (`coop.js`) is a skeleton (AJAX source not yet reverse-engineered).
- `src/scheduler.js` — iterates all scrapers, skips banks already scraped today, aborts on shutdown.
- `db/db.js` — `better-sqlite3` with WAL mode. Schema includes `cash_buying`, `cash_selling`, `transactional_buying`, `transactional_selling`.

## Important conventions

- **No tests, no lint, no typecheck** — this repo has none.
- Bank codes are uppercased throughout (CBE, AWASH, DASHEN, etc.).
- Rate fields can be `null` if a bank doesn't publish that rate type.
- `.env` is gitignored — never commit secrets.
- `*.db`, `/db/`, and `/foragents/` are gitignored.
- Docker: `docker compose up` (volume `exchange-data:/data`, overrides `DB_PATH` to `/data/rates.db`).

## Adding a bank scraper

1. Create `src/scrapers/<name>.js` with an exported `async function scrape()`.
2. Add it to `src/scrapers/index.js` (import + registry entry).
3. Use axios + cheerio for HTML banks, or plain axios for JSON APIs. 15s timeout, browser User-Agent.
