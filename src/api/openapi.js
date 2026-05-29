import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ETH Bank Rates API',
      version: '1.0.0',
      description: 'REST API providing daily exchange rates scraped from Ethiopian banks. Supports cash and transactional buying/selling rates for multiple currencies across 9 banks.',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Local development',
      },
      {
        url: 'https://eth-rates.duckdns.org',
        description: 'Production',
      },
    ],
    tags: [
      { name: 'Banks', description: 'Bank listing and discovery' },
      { name: 'Rates', description: 'Exchange rate queries' },
      { name: 'History', description: 'Historical rate data' },
      { name: 'System', description: 'Health and utility endpoints' },
    ],
    components: {
      schemas: {
        Bank: {
          type: 'object',
          required: ['code', 'name'],
          properties: {
            code: { type: 'string', example: 'CBE', description: 'Short bank code' },
            name: { type: 'string', example: 'Commercial Bank of Ethiopia', description: 'Full bank name' },
          },
        },
        Rate: {
          type: 'object',
          required: ['currency'],
          properties: {
            currency: { type: 'string', example: 'USD', description: 'Currency code (ISO 4217)' },
            cash_buying: { type: 'number', nullable: true, example: 126.45, description: 'Cash buying rate (bank buys foreign currency)' },
            cash_selling: { type: 'number', nullable: true, example: 128.90, description: 'Cash selling rate (bank sells foreign currency)' },
            transactional_buying: { type: 'number', nullable: true, example: 127.15, description: 'Transactional/telegraphic buying rate' },
            transactional_selling: { type: 'number', nullable: true, example: 128.50, description: 'Transactional/telegraphic selling rate' },
          },
        },
        BankRatesResponse: {
          type: 'object',
          required: ['bank', 'scraped_at', 'rates'],
          properties: {
            bank: { type: 'string', example: 'CBE', description: 'Bank code' },
            scraped_at: { type: 'string', format: 'date-time', example: '2026-05-18T09:00:00.000Z', description: 'ISO timestamp of when rates were scraped' },
            rates: {
              type: 'array',
              items: { $ref: '#/components/schemas/Rate' },
              description: 'List of currency exchange rates',
            },
          },
        },
        CompareBankRate: {
          type: 'object',
          required: ['bank', 'cash_buying', 'cash_selling', 'transactional_buying', 'transactional_selling', 'scraped_at'],
          properties: {
            bank: { $ref: '#/components/schemas/Bank' },
            cash_buying: { type: 'number', nullable: true, example: 126.45, description: 'Cash buying rate' },
            cash_selling: { type: 'number', nullable: true, example: 128.90, description: 'Cash selling rate' },
            transactional_buying: { type: 'number', nullable: true, example: 127.15, description: 'Transactional buying rate' },
            transactional_selling: { type: 'number', nullable: true, example: 128.50, description: 'Transactional selling rate' },
            scraped_at: { type: 'string', format: 'date-time', example: '2026-05-18T09:00:00.000Z', description: 'ISO timestamp of when this bank was scraped' },
          },
        },
        CompareResponse: {
          type: 'object',
          required: ['currency', 'rates'],
          properties: {
            currency: { type: 'string', example: 'USD', description: 'Currency code (ISO 4217)' },
            rates: {
              type: 'array',
              items: { $ref: '#/components/schemas/CompareBankRate' },
              description: 'List of bank rates for the currency, sorted by cash_buying descending',
            },
          },
        },
        BestRateResponse: {
          type: 'object',
          required: ['currency', 'type', 'bank', 'rate', 'cash_buying', 'cash_selling', 'transactional_buying', 'transactional_selling', 'scraped_at'],
          properties: {
            currency: { type: 'string', example: 'USD', description: 'Currency code (ISO 4217)' },
            type: { type: 'string', enum: ['buying', 'selling', 'transactional_buying', 'transactional_selling'], example: 'buying', description: 'Rate type used for comparison' },
            bank: { $ref: '#/components/schemas/Bank' },
            rate: { type: 'number', example: 127.5, description: 'Winning rate value for the requested type' },
            cash_buying: { type: 'number', nullable: true, example: 127.5, description: 'Cash buying rate from the winning bank' },
            cash_selling: { type: 'number', nullable: true, example: 128.9, description: 'Cash selling rate from the winning bank' },
            transactional_buying: { type: 'number', nullable: true, example: 125.8, description: 'Transactional buying rate from the winning bank' },
            transactional_selling: { type: 'number', nullable: true, example: 128.5, description: 'Transactional selling rate from the winning bank' },
            scraped_at: { type: 'string', format: 'date-time', example: '2026-05-29T09:00:00.000Z', description: 'ISO timestamp of when the winning bank was scraped' },
          },
        },
        RateHistoryEntry: {
          type: 'object',
          required: ['scraped_at', 'cash_buying', 'cash_selling', 'transactional_buying', 'transactional_selling'],
          properties: {
            scraped_at: { type: 'string', format: 'date-time', example: '2026-05-21T09:00:00.000Z', description: 'ISO timestamp of when rates were scraped' },
            cash_buying: { type: 'number', nullable: true, example: 154.12, description: 'Cash buying rate' },
            cash_selling: { type: 'number', nullable: true, example: 157.20, description: 'Cash selling rate' },
            transactional_buying: { type: 'number', nullable: true, example: 154.12, description: 'Transactional buying rate' },
            transactional_selling: { type: 'number', nullable: true, example: 157.20, description: 'Transactional selling rate' },
          },
        },
        RateHistoryResponse: {
          type: 'object',
          required: ['bank', 'currency', 'history'],
          properties: {
            bank: { type: 'string', example: 'CBE', description: 'Bank code' },
            currency: { type: 'string', example: 'USD', description: 'Currency code (ISO 4217)' },
            history: {
              type: 'array',
              items: { $ref: '#/components/schemas/RateHistoryEntry' },
              description: 'Historical rate entries ordered by scraped_at descending',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string', example: 'No rates found for bank: XYZ', description: 'Error message' },
          },
        },
      },
    },
  },
  apis: ['./src/api/app.js'],
}

const openapiSpec = swaggerJsdoc(options)

export default openapiSpec
