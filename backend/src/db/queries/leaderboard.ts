import { pool } from '../client.js'

export interface LeaderboardEntry {
  league_id: string
  user_id: string
  total_points: number
  wins: number
  losses: number
  last_updated: string
  team_name: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export async function getLeaderboard(leagueId: string): Promise<LeaderboardEntry[]> {
  const { rows } = await pool.query<LeaderboardEntry>(
    `SELECT lc.*, lm.team_name, p.username, p.display_name, p.avatar_url
     FROM leaderboard_cache lc
     JOIN profiles p ON p.id = lc.user_id
     LEFT JOIN league_members lm ON lm.league_id = lc.league_id AND lm.user_id = lc.user_id
     WHERE lc.league_id = $1
     ORDER BY lc.total_points DESC`,
    [leagueId]
  )
  return rows
}

export async function refreshLeaderboard(leagueId: string): Promise<void> {
  await pool.query(
    `SELECT refresh_leaderboard($1)`,
    [leagueId]
  )
}

export async function syncMatchScores(data: Array<{
  playerId: string
  matchId: string
  matchDate: string
  fantasyPoints: number
  runsScored?: number
  wicketsTaken?: number
  catches?: number
  stumpings?: number
  runOuts?: number
  rawData?: unknown
}>): Promise<void> {
  for (const score of data) {
    await pool.query(
      `INSERT INTO match_scores (player_id, match_id, match_date, fantasy_points,
        runs_scored, wickets_taken, catches, stumpings, run_outs, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (player_id, match_id)
       DO UPDATE SET fantasy_points = EXCLUDED.fantasy_points,
         runs_scored = EXCLUDED.runs_scored, wickets_taken = EXCLUDED.wickets_taken,
         catches = EXCLUDED.catches, stumpings = EXCLUDED.stumpings,
         run_outs = EXCLUDED.run_outs, raw_data = EXCLUDED.raw_data`,
      [
        score.playerId, score.matchId, score.matchDate, score.fantasyPoints,
        score.runsScored ?? 0, score.wicketsTaken ?? 0, score.catches ?? 0,
        score.stumpings ?? 0, score.runOuts ?? 0, score.rawData ?? null,
      ]
    )
  }
}
