import 'dotenv/config'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const TEAMS = [
  'Chennai Super Kings', 'Delhi Capitals', 'Gujarat Titans', 'Kolkata Knight Riders',
  'Lucknow Super Giants', 'Mumbai Indians', 'Punjab Kings', 'Rajasthan Royals',
  'Royal Challengers Bengaluru', 'Sunrisers Hyderabad',
]

async function main() {
  for (const t of TEAMS) {
    const { rows } = await pool.query<{ name: string }>(
      `SELECT name FROM players WHERE ipl_team = $1 AND (image_url IS NULL OR image_url = '') ORDER BY name`,
      [t]
    )
    if (rows.length) {
      console.log(`\n--- ${t} (${rows.length} without images) ---`)
      for (const r of rows) console.log(`  ${r.name}`)
    }
  }
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
