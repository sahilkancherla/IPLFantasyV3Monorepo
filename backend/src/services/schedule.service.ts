import { pool } from '../db/client.js'

// Trigger round-robin schedule generation via the DB function
export async function generateLeagueSchedule(leagueId: string): Promise<void> {
  await pool.query(`SELECT generate_schedule($1)`, [leagueId])
}

// Get the current active IPL week.
// Priority: explicit system_settings.current_week → ipl_weeks.status='live' → date-based fallback.
export async function getCurrentWeek(): Promise<{
  week_num: number
  label: string
  start_date: string
  end_date: string
  lock_time: string
  is_playoff: boolean
} | null> {
  // 1. Explicit admin override
  const { rows: settings } = await pool.query(
    `SELECT value FROM system_settings WHERE key = 'current_week' LIMIT 1`
  )
  const explicitNum = settings[0]?.value ? parseInt(settings[0].value, 10) : null
  if (explicitNum) {
    const { rows } = await pool.query(
      `SELECT * FROM ipl_weeks WHERE week_num = $1 LIMIT 1`,
      [explicitNum]
    )
    if (rows[0]) return rows[0]
  }

  // 2. Week marked live via status column
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ipl_weeks WHERE status = 'live' LIMIT 1`
    )
    if (rows[0]) return rows[0]
  } catch { /* status column may not exist yet */ }

  // 3. Date-based fallback
  const now = new Date().toISOString().slice(0, 10)
  const { rows } = await pool.query(
    `SELECT * FROM ipl_weeks WHERE start_date <= $1 AND end_date >= $1 ORDER BY week_num LIMIT 1`,
    [now]
  )
  return rows[0] ?? null
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
