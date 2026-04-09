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
  home_team_name: string
  home_full_name: string
  home_username: string
  home_avatar_url: string | null
  away_team_name: string
  away_full_name: string
  away_username: string
  away_avatar_url: string | null
}

// Subquery that computes live fantasy points for one user in one week
// by summing match_scores for all their lineup players whose team plays that week.
const livePointsSubquery = (userCol: string) => `
  COALESCE((
    SELECT SUM(ms.fantasy_points)
    FROM weekly_lineups wl
    JOIN players p ON p.id = wl.player_id
    JOIN ipl_matches im
      ON im.week_num = wm.week_num
     AND p.ipl_team IN (im.home_team, im.away_team)
    JOIN match_scores ms
      ON ms.player_id = wl.player_id AND ms.match_id = im.match_id
    WHERE wl.league_id = wm.league_id
      AND wl.user_id   = wm.${userCol}
      AND wl.week_num  = wm.week_num
  ), 0)`

export async function getLeagueSchedule(leagueId: string): Promise<WeeklyMatchup[]> {
  const { rows } = await pool.query<WeeklyMatchup>(
    `SELECT wm.id, wm.league_id, wm.week_num, wm.home_user, wm.away_user,
            wm.winner_id, wm.is_final,
            ${livePointsSubquery('home_user')} AS home_points,
            ${livePointsSubquery('away_user')} AS away_points,
            lmh.team_name AS home_team_name,
            ph.full_name AS home_full_name, ph.username AS home_username, ph.avatar_url AS home_avatar_url,
            lma.team_name AS away_team_name,
            pa.full_name AS away_full_name, pa.username AS away_username, pa.avatar_url AS away_avatar_url
     FROM weekly_matchups wm
     JOIN profiles ph ON ph.id = wm.home_user
     JOIN profiles pa ON pa.id = wm.away_user
     LEFT JOIN league_members lmh ON lmh.league_id = wm.league_id AND lmh.user_id = wm.home_user
     LEFT JOIN league_members lma ON lma.league_id = wm.league_id AND lma.user_id = wm.away_user
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
    `SELECT wm.id, wm.league_id, wm.week_num, wm.home_user, wm.away_user,
            wm.winner_id, wm.is_final,
            ${livePointsSubquery('home_user')} AS home_points,
            ${livePointsSubquery('away_user')} AS away_points,
            lmh.team_name AS home_team_name,
            ph.full_name AS home_full_name, ph.username AS home_username, ph.avatar_url AS home_avatar_url,
            lma.team_name AS away_team_name,
            pa.full_name AS away_full_name, pa.username AS away_username, pa.avatar_url AS away_avatar_url
     FROM weekly_matchups wm
     JOIN profiles ph ON ph.id = wm.home_user
     JOIN profiles pa ON pa.id = wm.away_user
     LEFT JOIN league_members lmh ON lmh.league_id = wm.league_id AND lmh.user_id = wm.home_user
     LEFT JOIN league_members lma ON lma.league_id = wm.league_id AND lma.user_id = wm.away_user
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
