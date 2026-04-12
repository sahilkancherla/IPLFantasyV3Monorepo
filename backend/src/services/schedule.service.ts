import { pool } from '../db/client.js'

// Trigger round-robin schedule generation via the DB function
export async function generateLeagueSchedule(leagueId: string): Promise<void> {
  await pool.query(`SELECT generate_schedule($1)`, [leagueId])
}

// Get the current active IPL week using window_start / window_end.
export async function getCurrentWeek(): Promise<{
  week_num: number
  label: string
  start_date: string
  end_date: string
  lock_time: string
  is_playoff: boolean
  window_start: string | null
  window_end: string | null
} | null> {
  // 1. Active fantasy window
  const { rows: active } = await pool.query(
    `SELECT * FROM ipl_weeks
     WHERE window_start IS NOT NULL AND window_end IS NOT NULL
       AND NOW() BETWEEN window_start AND window_end
     LIMIT 1`
  )
  if (active[0]) return active[0]

  // 2. Next upcoming window
  const { rows: next } = await pool.query(
    `SELECT * FROM ipl_weeks
     WHERE window_start IS NOT NULL AND window_start > NOW()
     ORDER BY window_start ASC LIMIT 1`
  )
  if (next[0]) return next[0]

  // 3. Most recently completed window
  const { rows: last } = await pool.query(
    `SELECT * FROM ipl_weeks
     WHERE window_end IS NOT NULL AND window_end < NOW()
     ORDER BY window_end DESC LIMIT 1`
  )
  return last[0] ?? null
}

export async function getAllWeeks() {
  const { rows } = await pool.query(
    `SELECT * FROM ipl_weeks ORDER BY week_num`
  )
  return rows
}

// Check if a week's lineup is locked (lock_time has passed)
export async function isWeekLocked(weekNum: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT lock_time FROM ipl_weeks WHERE week_num = $1`,
    [weekNum]
  )
  if (!rows[0]) return false
  return new Date(rows[0].lock_time) <= new Date()
}

// Reset waiver priorities when a new week starts
// (lowest standing = priority 1, etc.)
export async function resetWaiverPriorities(leagueId: string): Promise<void> {
  await pool.query(
    `WITH ranked AS (
       SELECT user_id,
              ROW_NUMBER() OVER (
                ORDER BY wins ASC, total_points ASC
              ) AS new_priority
       FROM leaderboard_cache
       WHERE league_id = $1
     )
     UPDATE league_members lm
     SET waiver_priority = r.new_priority
     FROM ranked r
     WHERE lm.league_id = $1 AND lm.user_id = r.user_id`,
    [leagueId]
  )
}
