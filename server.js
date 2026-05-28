import dotenv from 'dotenv'
dotenv.config()

import app from './src/api/app.js'
import { runNow, stopScheduler } from './src/scheduler.js'
import { closeDb } from './db/db.js'

const PORT = process.env.PORT || 3000

let shuttingDown = false

async function gracefulShutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n[shutdown] Received ${signal}, shutting down gracefully...`)

  stopScheduler()

  server.close(() => {
    console.log('[shutdown] HTTP server closed')
    closeDb()
    console.log('[shutdown] Database closed')
    process.exit(0)
  })

  setTimeout(() => {
    console.error('[shutdown] Forced exit after timeout')
    process.exit(1)
  }, 10000).unref()
}

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  runNow()
})

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
