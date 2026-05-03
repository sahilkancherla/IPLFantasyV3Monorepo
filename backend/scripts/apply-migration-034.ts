import 'dotenv/config'
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = resolve(__dirname, '..', '..', 'supabase', 'migrations', '034_ipl_teams.sql')

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const sql = readFileSync(sqlPath, 'utf8')
  await pool.query(sql)
  const { rows } = await pool.query<{ slug: string; name: string; abbrev: string }>(
    `SELECT slug, name, abbrev FROM ipl_teams ORDER BY display_order`
  )
  console.log(`✓ migration applied — ${rows.length} teams seeded`)
  for (const r of rows) console.log(`  ${r.abbrev.padEnd(5)} ${r.name}`)
  await pool.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
