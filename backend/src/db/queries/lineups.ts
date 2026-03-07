import { pool } from '../client.js'

export interface LineupEntry {
  id: string
  league_id: string
  user_id: string
  week_num: number
  player_id: string
  slot_role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper'
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
  batsman: 5,
  wicket_keeper: 1,
  all_rounder: 2,
  bowler: 3,
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

// Validate 11 players: 5 batsmen, 1 WK, 2 AR, 3 bowlers — all on roster
export async function validateLineup(
  leagueId: string,
  userId: string,
  entries: Array<{ playerId: string; slotRole: string }>
): Promise<{ valid: boolean; error?: string }> {
  if (entries.length !== 11) {
    return { valid: false, error: 'Lineup must have exactly 11 players' }
  }

  const counts: Record<string, number> = { batsman: 0, wicket_keeper: 0, all_rounder: 0, bowler: 0 }
  for (const e of entries) {
    if (!(e.slotRole in counts)) {
      return { valid: false, error: `Invalid slot role: ${e.slotRole}` }
    }
    counts[e.slotRole]++
  }

  const required = SLOT_COUNTS
  for (const [role, required_count] of Object.entries(required)) {
    if (counts[role] !== required_count) {
      return {
        valid: false,
        error: `Need ${required_count} ${role}(s), got ${counts[role]}`,
      }
    }
  }

  // All players must be on the roster
  const playerIds = entries.map((e) => e.playerId)
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM team_rosters
     WHERE league_id = $1 AND user_id = $2 AND player_id = ANY($3::uuid[])`,
    [leagueId, userId, playerIds]
  )
  if (parseInt(rows[0].cnt, 10) !== 11) {
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
  // Delete existing unlocked lineup for this week
  await pool.query(
    `DELETE FROM weekly_lineups
     WHERE league_id = $1 AND user_id = $2 AND week_num = $3 AND is_locked = FALSE`,
    [leagueId, userId, weekNum]
  )

  for (const e of entries) {
    await pool.query(
      `INSERT INTO weekly_lineups (league_id, user_id, week_num, player_id, slot_role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (league_id, user_id, week_num, player_id) DO UPDATE
         SET slot_role = EXCLUDED.slot_role, set_at = NOW()`,
      [leagueId, userId, weekNum, e.playerId, e.slotRole]
    )
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
export async function autoSetLineup(
  leagueId: string,
  userId: string,
  weekNum: number
): Promise<void> {
  const existing = await getLineup(leagueId, userId, weekNum)
  if (existing.length === 11) return  // already set

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
