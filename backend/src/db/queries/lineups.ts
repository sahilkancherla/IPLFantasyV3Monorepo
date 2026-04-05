import pg from 'pg'
import { pool } from '../client.js'

export interface LineupEntry {
  id: string
  league_id: string
  user_id: string
  week_num: number
  player_id: string
  slot_role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper' | 'flex'
  is_locked: boolean
  set_at: string
  // joined
  player_name: string
  player_ipl_team: string
  player_role: string
  player_image_url: string | null
  // optional: week points (joined from match_scores)
  week_points?: number
}

export const SLOT_COUNTS = {
  batsman: 3,
  wicket_keeper: 1,
  all_rounder: 1,
  bowler: 3,
  flex: 3,
} as const

export async function getLineup(
  leagueId: string,
  userId: string,
  weekNum: number
): Promise<LineupEntry[]> {
  const { rows } = await pool.query<LineupEntry>(
    `SELECT wl.*,
            p.name AS player_name, p.ipl_team AS player_ipl_team,
            p.role AS player_role, p.image_url AS player_image_url,
            COALESCE(SUM(ms.fantasy_points), 0) AS week_points
     FROM weekly_lineups wl
     JOIN players p ON p.id = wl.player_id
     LEFT JOIN match_scores ms ON ms.player_id = wl.player_id AND ms.ipl_week = $3
     WHERE wl.league_id = $1 AND wl.user_id = $2 AND wl.week_num = $3
     GROUP BY wl.id, p.name, p.ipl_team, p.role, p.image_url
     ORDER BY wl.slot_role`,
    [leagueId, userId, weekNum]
  )
  return rows
}

export async function getAllLineupsForWeek(
  leagueId: string,
  weekNum: number
): Promise<LineupEntry[]> {
  const { rows } = await pool.query<LineupEntry>(
    `SELECT wl.*,
            p.name AS player_name, p.ipl_team AS player_ipl_team,
            p.role AS player_role, p.image_url AS player_image_url,
            COALESCE(SUM(ms.fantasy_points), 0) AS week_points
     FROM weekly_lineups wl
     JOIN players p ON p.id = wl.player_id
     LEFT JOIN match_scores ms ON ms.player_id = wl.player_id AND ms.ipl_week = $2
     WHERE wl.league_id = $1 AND wl.week_num = $2
     GROUP BY wl.id, p.name, p.ipl_team, p.role, p.image_url
     ORDER BY wl.user_id, wl.slot_role`,
    [leagueId, weekNum]
  )
  return rows
}

// Validate lineup: all players on roster, no duplicates, per-slot caps respected
export async function validateLineup(
  leagueId: string,
  userId: string,
  entries: Array<{ playerId: string; slotRole: string }>
): Promise<{ valid: boolean; error?: string }> {
  const validSlots = new Set(Object.keys(SLOT_COUNTS))
  const counts: Record<string, number> = { batsman: 0, wicket_keeper: 0, all_rounder: 0, bowler: 0, flex: 0 }

  for (const e of entries) {
    if (!validSlots.has(e.slotRole)) {
      return { valid: false, error: `Invalid slot role: ${e.slotRole}` }
    }
    counts[e.slotRole]++
  }

  // Per-slot caps (can have fewer, not more)
  for (const [role, max] of Object.entries(SLOT_COUNTS)) {
    if (counts[role] > max) {
      return { valid: false, error: `Too many ${role}(s): max ${max}, got ${counts[role]}` }
    }
  }

  // No duplicate players
  const playerIds = entries.map((e) => e.playerId)
  if (new Set(playerIds).size !== playerIds.length) {
    return { valid: false, error: 'Duplicate players in lineup' }
  }

  // All players must be on the roster
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM team_rosters
     WHERE league_id = $1 AND user_id = $2 AND player_id = ANY($3::uuid[])`,
    [leagueId, userId, playerIds]
  )
  if (parseInt(rows[0].cnt, 10) !== playerIds.length) {
    return { valid: false, error: 'Some players are not on your roster' }
  }

  return { valid: true }
}

export async function setLineup(
  leagueId: string,
  userId: string,
  weekNum: number,
  entries: Array<{ playerId: string; slotRole: string }>
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `DELETE FROM weekly_lineups
       WHERE league_id = $1 AND user_id = $2 AND week_num = $3 AND is_locked = FALSE`,
      [leagueId, userId, weekNum]
    )

    // Build a single multi-row insert
    const valuePlaceholders = entries.map(
      (_, i) => `($1, $2, $3, $${4 + i * 2}, $${5 + i * 2})`
    ).join(', ')
    const values: unknown[] = [leagueId, userId, weekNum]
    for (const e of entries) values.push(e.playerId, e.slotRole)

    await client.query(
      `INSERT INTO weekly_lineups (league_id, user_id, week_num, player_id, slot_role)
       VALUES ${valuePlaceholders}`,
      values
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function lockLineup(leagueId: string, weekNum: number): Promise<void> {
  await pool.query(
    `UPDATE weekly_lineups SET is_locked = TRUE
     WHERE league_id = $1 AND week_num = $2`,
    [leagueId, weekNum]
  )
}

// Auto-set lineup if not submitted (carry forward previous week, or best eligible)
export interface GamePlayer {
  playerId: string
  playerName: string
  playerTeam: string
  playerRole: string
  slotRole: string
  points: number
  // batting
  runsScored: number
  ballsFaced: number
  fours: number
  sixes: number
  isOut: boolean
  // bowling
  ballsBowled: number
  runsConceded: number
  wicketsTaken: number
  maidens: number
  lbwBowledWickets: number
  // fielding
  catches: number
  stumpings: number
  runOutsDirect: number
  runOutsIndirect: number
}

export interface GameBreakdownData {
  matchId: string
  homeTeam: string
  awayTeam: string
  matchDate: string
  startTimeUtc: string | null
  isCompleted: boolean
  myPoints: number
  oppPoints: number
  myPlayers: GamePlayer[]
  oppPlayers: GamePlayer[]
}

export async function getGameBreakdown(
  leagueId: string,
  userId: string,
  opponentId: string,
  weekNum: number
): Promise<GameBreakdownData[]> {
  // All IPL matches this week
  const { rows: matches } = await pool.query(
    `SELECT match_id, home_team, away_team, match_date::text, start_time_utc, is_completed, match_number
     FROM ipl_matches WHERE week_num = $1 ORDER BY match_date, start_time_utc NULLS LAST`,
    [weekNum]
  )
  if (matches.length === 0) return []

  // Lineup players for both users, joined to matches where their team plays
  const { rows: playerRows } = await pool.query(
    `SELECT
       im.match_id,
       wl.user_id,
       wl.player_id,
       p.name              AS player_name,
       p.ipl_team          AS player_ipl_team,
       p.role              AS player_role,
       wl.slot_role,
       COALESCE(ms.fantasy_points,   0)     AS points,
       COALESCE(ms.runs_scored,      0)     AS runs_scored,
       COALESCE(ms.balls_faced,      0)     AS balls_faced,
       COALESCE(ms.fours,            0)     AS fours,
       COALESCE(ms.sixes,            0)     AS sixes,
       COALESCE(ms.is_out,           false) AS is_out,
       COALESCE(ms.balls_bowled,     0)     AS balls_bowled,
       COALESCE(ms.runs_conceded,    0)     AS runs_conceded,
       COALESCE(ms.wickets_taken,    0)     AS wickets_taken,
       COALESCE(ms.maidens,          0)     AS maidens,
       COALESCE(ms.catches,          0)     AS catches,
       COALESCE(ms.stumpings,        0)     AS stumpings,
       COALESCE(ms.run_outs_direct,      0)     AS run_outs_direct,
       COALESCE(ms.run_outs_indirect,    0)     AS run_outs_indirect,
       COALESCE(ms.lbw_bowled_wickets,   0)     AS lbw_bowled_wickets
     FROM weekly_lineups wl
     JOIN players p ON p.id = wl.player_id
     JOIN ipl_matches im
       ON im.week_num = $3
      AND p.ipl_team IN (im.home_team, im.away_team)
     LEFT JOIN match_scores ms
       ON ms.player_id = wl.player_id AND ms.match_id = im.match_id
     WHERE wl.league_id = $1 AND wl.user_id IN ($2, $4) AND wl.week_num = $3
     ORDER BY COALESCE(ms.fantasy_points, 0) DESC`,
    [leagueId, userId, weekNum, opponentId]
  )

  // Group by match
  const grouped = new Map<string, { myPlayers: GamePlayer[]; oppPlayers: GamePlayer[] }>(
    matches.map((m: { match_id: string }) => [m.match_id, { myPlayers: [], oppPlayers: [] }])
  )
  for (const row of playerRows) {
    const g = grouped.get(row.match_id)
    if (!g) continue
    const player: GamePlayer = {
      playerId: row.player_id,
      playerName: row.player_name,
      playerTeam: row.player_ipl_team,
      playerRole: row.player_role,
      slotRole: row.slot_role,
      points: parseFloat(row.points),
      runsScored: parseInt(row.runs_scored, 10),
      ballsFaced: parseInt(row.balls_faced, 10),
      fours: parseInt(row.fours, 10),
      sixes: parseInt(row.sixes, 10),
      isOut: row.is_out,
      ballsBowled: parseInt(row.balls_bowled, 10),
      runsConceded: parseInt(row.runs_conceded, 10),
      wicketsTaken: parseInt(row.wickets_taken, 10),
      maidens: parseInt(row.maidens, 10),
      catches: parseInt(row.catches, 10),
      stumpings: parseInt(row.stumpings, 10),
      runOutsDirect: parseInt(row.run_outs_direct, 10),
      runOutsIndirect: parseInt(row.run_outs_indirect, 10),
      lbwBowledWickets: parseInt(row.lbw_bowled_wickets, 10),
    }
    if (row.user_id === userId) g.myPlayers.push(player)
    else g.oppPlayers.push(player)
  }

  return matches.map((m: { match_id: string; home_team: string; away_team: string; match_date: string; start_time_utc: string | null; is_completed: boolean; match_number: number | null }) => {
    const g = grouped.get(m.match_id) ?? { myPlayers: [], oppPlayers: [] }
    return {
      matchId: m.match_id,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      matchDate: m.match_date,
      startTimeUtc: m.start_time_utc,
      isCompleted: m.is_completed,
      matchNumber: m.match_number,
      myPoints: g.myPlayers.reduce((s, p) => s + p.points, 0),
      oppPoints: g.oppPlayers.reduce((s, p) => s + p.points, 0),
      myPlayers: g.myPlayers,
      oppPlayers: g.oppPlayers,
    }
  })
}

export async function autoSetLineup(
  leagueId: string,
  userId: string,
  weekNum: number
): Promise<void> {
  const existing = await getLineup(leagueId, userId, weekNum)
  if (existing.length > 0) return  // already set

  const prevWeek = weekNum - 1
  if (prevWeek >= 1) {
    const prev = await getLineup(leagueId, userId, prevWeek)
    if (prev.length === 11) {
      // Carry forward but verify players are still on roster (not traded/waived)
      const { rows: roster } = await pool.query(
        `SELECT player_id FROM team_rosters WHERE league_id = $1 AND user_id = $2`,
        [leagueId, userId]
      )
      const rosterIds = new Set(roster.map((r: { player_id: string }) => r.player_id))
      const valid = prev.filter((e) => rosterIds.has(e.player_id))

      if (valid.length === 11) {
        await setLineup(
          leagueId, userId, weekNum,
          valid.map((e) => ({ playerId: e.player_id, slotRole: e.slot_role }))
        )
      }
    }
  }
}

/**
 * Delete lineup entries for a user in all non-finalized weeks of a league.
 * Call this whenever a player is added to (or swapped on) a roster so that
 * stale lineups don't persist into uncompleted weeks.
 * Accepts an optional transaction client; falls back to the pool.
 */
export async function clearUncompletedLineups(
  leagueId: string,
  userId: string,
  client?: pg.PoolClient
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `DELETE FROM weekly_lineups
     WHERE league_id = $1
       AND user_id   = $2
       AND week_num NOT IN (
         SELECT wm.week_num
         FROM weekly_matchups wm
         WHERE wm.league_id = $1
           AND (wm.home_user = $2 OR wm.away_user = $2)
           AND wm.is_final = TRUE
       )`,
    [leagueId, userId]
  )
}

/** Returns week numbers where the player appears in a non-finalized lineup for this user. */
export async function getPlayerUncompletedLineupWeeks(
  leagueId: string,
  userId: string,
  playerId: string
): Promise<number[]> {
  const { rows } = await pool.query<{ week_num: number }>(
    `SELECT DISTINCT wl.week_num
     FROM weekly_lineups wl
     WHERE wl.league_id = $1
       AND wl.user_id   = $2
       AND wl.player_id = $3
       AND wl.week_num NOT IN (
         SELECT wm.week_num
         FROM weekly_matchups wm
         WHERE wm.league_id = $1
           AND (wm.home_user = $2 OR wm.away_user = $2)
           AND wm.is_final = TRUE
       )
     ORDER BY wl.week_num`,
    [leagueId, userId, playerId]
  )
  return rows.map(r => r.week_num)
}

/** Removes a specific player from all non-finalized lineup weeks for this user. */
export async function removePlayerFromUncompletedLineups(
  leagueId: string,
  userId: string,
  playerId: string,
  client?: pg.PoolClient
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `DELETE FROM weekly_lineups
     WHERE league_id = $1
       AND user_id   = $2
       AND player_id = $3
       AND week_num NOT IN (
         SELECT wm.week_num
         FROM weekly_matchups wm
         WHERE wm.league_id = $1
           AND (wm.home_user = $2 OR wm.away_user = $2)
           AND wm.is_final = TRUE
       )`,
    [leagueId, userId, playerId]
  )
}
