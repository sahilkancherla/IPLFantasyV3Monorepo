import { buildApp } from './app.js'
import { config } from './config.js'
import { pool } from './db/client.js'

async function main() {
  const app = await buildApp()

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
    console.log(`🚀 Server running on port ${config.PORT}`)
  } catch (err) {
    app.log.error(err)
    await pool.end()
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await pool.end()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await pool.end()
  process.exit(0)
})

main()
