import { pool } from '../client.js'

export interface RosterEntry {
  id: string
  league_id: string
  user_id: string
  player_id: string
  price_paid: number
  acquired_at: string
  player_name: string
  player_ipl_team: string
  player_role: string
  player_image_url: string | null
  total_points: number
  team_games_played: number
}

const rosterSelect = `
  SELECT tr.*, p.name AS player_name, p.ipl_team AS player_ipl_team,
         p.role AS player_role, p.image_url AS player_image_url,
         COALESCE((
           SELECT SUM(ms.fantasy_points) FROM match_scores ms WHERE ms.player_id = tr.player_id
         ), 0) AS total_points,
         COALESCE((
           SELECT COUNT(*) FROM ipl_matches im
           WHERE (im.home_team = p.ipl_team OR im.away_team = p.ipl_team)
             AND im.status = 'completed'
         ), 0) AS team_games_played
  FROM team_rosters tr
  JOIN players p ON p.id = tr.player_id`

export async function getUserTeam(leagueId: string, userId: string): Promise<RosterEntry[]> {
  const { rows } = await pool.query<RosterEntry>(
    `${rosterSelect} WHERE tr.league_id = $1 AND tr.user_id = $2 ORDER BY tr.acquired_at`,
    [leagueId, userId]
  )
  return rows
}

export async function getAllTeams(leagueId: string): Promise<RosterEntry[]> {
  const { rows } = await pool.query<RosterEntry>(
    `${rosterSelect} WHERE tr.league_id = $1 ORDER BY tr.user_id, tr.acquired_at`,
    [leagueId]
  )
  return rows
}
