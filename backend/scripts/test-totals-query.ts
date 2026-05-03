import 'dotenv/config'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  // Pick the first active league
  const { rows: leagues } = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM leagues WHERE status IN ('league_active','league_complete') LIMIT 1`
  )
  if (leagues.length === 0) { console.log('no active leagues'); await pool.end(); return }
  const leagueId = leagues[0].id
  console.log(`testing on league: ${leagues[0].name} (${leagueId})\n`)

  const { rows } = await pool.query(
    `WITH starter_pts AS (
       SELECT wl.user_id, wl.week_num,
              COALESCE(SUM(ms.fantasy_points), 0) AS points
       FROM weekly_lineups wl
       JOIN ipl_matches im ON im.week_num = wl.week_num
       LEFT JOIN match_scores ms
         ON ms.player_id = wl.player_id AND ms.match_id = im.match_id
       WHERE wl.league_id = $1
       GROUP BY wl.user_id, wl.week_num
     ),
     overrides AS (
       SELECT user_id, week_num, points
       FROM league_points_overrides
       WHERE league_id = $1
     )
     SELECT
       COALESCE(s.user_id, o.user_id)   AS user_id,
       COALESCE(s.week_num, o.week_num) AS week_num,
       COALESCE(s.points, 0) + COALESCE(o.points, 0) AS points
     FROM starter_pts s
     FULL OUTER JOIN overrides o
       ON o.user_id = s.user_id AND o.week_num = s.week_num
     ORDER BY week_num, user_id`,
    [leagueId]
  )
  console.log(`${rows.length} (user, week, points) rows:`)
  for (const r of rows) console.log(`  week ${r.week_num} | ${r.user_id.slice(0,8)} → ${r.points}`)
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
