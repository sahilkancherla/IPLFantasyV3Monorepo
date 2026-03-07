import { pool } from '../client.js'

export interface IplWeek {
  id: string
  week_num: number
  label: string
  start_date: string
  end_date: string
  lock_time: string
  is_playoff: boolean
}

export interface WeeklyMatchup {
  id: string
  league_id: string
  week_num: number
  home_user: string
  away_user: string
  home_points: number
  away_points: number
  winner_id: string | null
  is_final: boolean
  // joined fields
  home_full_name: string
  home_username: string
  home_avatar_url: string | null
  away_full_name: string
  away_username: string
  away_avatar_url: string | null
}

export async function getLeagueSchedule(leagueId: string): Promise<WeeklyMatchup[]> {
  const { rows } = await pool.query<WeeklyMatchup>(
    `SELECT wm.*,
            ph.full_name AS home_full_name, ph.username AS home_username, ph.avatar_url AS home_avatar_url,
            pa.full_name AS away_full_name, pa.username AS away_username, pa.avatar_url AS away_avatar_url
     FROM weekly_matchups wm
     JOIN profiles ph ON ph.id = wm.home_user
     JOIN profiles pa ON pa.id = wm.away_user
     WHERE wm.league_id = $1
     ORDER BY wm.week_num`,
    [leagueId]
  )
  return rows
}

export async function getMatchupForWeek(
  leagueId: string,
  weekNum: number,
  userId: string
): Promise<WeeklyMatchup | null> {
  const { rows } = await pool.query<WeeklyMatchup>(
    `SELECT wm.*,
            ph.full_name AS home_full_name, ph.username AS home_username, ph.avatar_url AS home_avatar_url,
            pa.full_name AS away_full_name, pa.username AS away_username, pa.avatar_url AS away_avatar_url
     FROM weekly_matchups wm
     JOIN profiles ph ON ph.id = wm.home_user
     JOIN profiles pa ON pa.id = wm.away_user
     WHERE wm.league_id = $1
       AND wm.week_num  = $2
       AND (wm.home_user = $3 OR wm.away_user = $3)
     LIMIT 1`,
    [leagueId, weekNum, userId]
  )
  return rows[0] ?? null
}

export async function getAllWeeks(): Promise<IplWeek[]> {
  const { rows } = await pool.query<IplWeek>(`SELECT * FROM ipl_weeks ORDER BY week_num`)
  return rows
}

export async function getCurrentWeekRow(): Promise<IplWeek | null> {
  const { rows } = await pool.query<IplWeek>(
    `SELECT * FROM ipl_weeks
     WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
     ORDER BY week_num LIMIT 1`
  )
  return rows[0] ?? null
}
