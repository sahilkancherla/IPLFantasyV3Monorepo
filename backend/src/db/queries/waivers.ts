import pg from 'pg'
import { pool, withTransaction } from '../client.js'
import { clearUncompletedLineups } from './lineups.js'

export interface WaiverClaim {
  id: string
  league_id: string
  claimant_id: string
  claim_player_id: string
  drop_player_id: string
  status: 'pending' | 'granted' | 'denied' | 'cancelled'
  priority_at_submission: number
  created_at: string
  resolved_at: string | null
  // joined
  claim_player_name: string
  claim_player_role: string
  claim_player_ipl_team: string
  drop_player_name: string
  drop_player_role: string
  claimant_username: string
  claimant_full_name: string
}

export async function getFreeAgents(leagueId: string) {
  const { rows } = await pool.query(
    `SELECT p.* FROM players p
     WHERE p.is_active = TRUE
       AND p.id NOT IN (
         SELECT player_id FROM team_rosters WHERE league_id = $1
       )
     ORDER BY p.name`,
    [leagueId]
  )
  return rows
}

export async function getPendingClaims(leagueId: string): Promise<WaiverClaim[]> {
  const { rows } = await pool.query<WaiverClaim>(
    `SELECT wc.*,
            cp.name AS claim_player_name, cp.role AS claim_player_role, cp.ipl_team AS claim_player_ipl_team,
            dp.name AS drop_player_name, dp.role AS drop_player_role,
            pr.username AS claimant_username, pr.full_name AS claimant_full_name
     FROM waiver_claims wc
     JOIN players cp ON cp.id = wc.claim_player_id
     JOIN players dp ON dp.id = wc.drop_player_id
     JOIN profiles pr ON pr.id = wc.claimant_id
     WHERE wc.league_id = $1 AND wc.status = 'pending'
     ORDER BY wc.priority_at_submission ASC, wc.created_at ASC`,
    [leagueId]
  )
  return rows
}

export async function getMyClaims(leagueId: string, userId: string): Promise<WaiverClaim[]> {
  const { rows } = await pool.query<WaiverClaim>(
    `SELECT wc.*,
            cp.name AS claim_player_name, cp.role AS claim_player_role, cp.ipl_team AS claim_player_ipl_team,
            dp.name AS drop_player_name, dp.role AS drop_player_role,
            pr.username AS claimant_username, pr.full_name AS claimant_full_name
     FROM waiver_claims wc
     JOIN players cp ON cp.id = wc.claim_player_id
     JOIN players dp ON dp.id = wc.drop_player_id
     JOIN profiles pr ON pr.id = wc.claimant_id
     WHERE wc.league_id = $1 AND wc.claimant_id = $2
     ORDER BY wc.created_at DESC`,
    [leagueId, userId]
  )
  return rows
}

export async function submitClaim(data: {
  leagueId: string
  claimantId: string
  claimPlayerId: string
  dropPlayerId: string
  priority: number
}): Promise<WaiverClaim> {
  const { rows } = await pool.query<WaiverClaim>(
    `INSERT INTO waiver_claims
       (league_id, claimant_id, claim_player_id, drop_player_id, priority_at_submission)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.leagueId, data.claimantId, data.claimPlayerId, data.dropPlayerId, data.priority]
  )
  return rows[0]
}

export async function cancelClaim(claimId: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE waiver_claims SET status = 'cancelled', resolved_at = NOW()
     WHERE id = $1 AND claimant_id = $2 AND status = 'pending'`,
    [claimId, userId]
  )
}

// Process all pending claims for a league in priority order
export async function processWaiverClaims(leagueId: string): Promise<void> {
  const claims = await getPendingClaims(leagueId)

  // Track which players have been claimed this cycle (can't be claimed twice)
  const claimedPlayerIds = new Set<string>()
  // Track which managers have already had a successful claim (reset priority)
  const managersWithGrant = new Set<string>()

  for (const claim of claims) {
    // Skip if this player was already claimed by someone else this cycle
    if (claimedPlayerIds.has(claim.claim_player_id)) {
      await pool.query(
        `UPDATE waiver_claims SET status = 'denied', resolved_at = NOW() WHERE id = $1`,
        [claim.id]
      )
      continue
    }

    // Check player is still a free agent
    const { rows: onRoster } = await pool.query(
      `SELECT 1 FROM team_rosters WHERE league_id = $1 AND player_id = $2`,
      [leagueId, claim.claim_player_id]
    )
    if (onRoster.length > 0) {
      await pool.query(
        `UPDATE waiver_claims SET status = 'denied', resolved_at = NOW() WHERE id = $1`,
        [claim.id]
      )
      continue
    }

    // Check drop player is still on claimant's roster
    const { rows: ownsDrop } = await pool.query(
      `SELECT 1 FROM team_rosters WHERE league_id = $1 AND user_id = $2 AND player_id = $3`,
      [leagueId, claim.claimant_id, claim.drop_player_id]
    )
    if (ownsDrop.length === 0) {
      await pool.query(
        `UPDATE waiver_claims SET status = 'denied', resolved_at = NOW() WHERE id = $1`,
        [claim.id]
      )
      continue
    }

    // Grant: execute roster swap atomically
    await withTransaction(async (client: pg.PoolClient) => {
      // Remove dropped player
      await client.query(
        `DELETE FROM team_rosters WHERE league_id = $1 AND user_id = $2 AND player_id = $3`,
        [leagueId, claim.claimant_id, claim.drop_player_id]
      )
      // Add claimed player
      await client.query(
        `INSERT INTO team_rosters (league_id, user_id, player_id, price_paid)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (league_id, player_id) DO NOTHING`,
        [leagueId, claim.claimant_id, claim.claim_player_id]
      )
      // Mark claim granted
      await client.query(
        `UPDATE waiver_claims SET status = 'granted', resolved_at = NOW() WHERE id = $1`,
        [claim.id]
      )
      // Drop manager's waiver priority to lowest (send to back of queue)
      await client.query(
        `UPDATE league_members SET waiver_priority = (
           SELECT MAX(waiver_priority) + 1 FROM league_members WHERE league_id = $1
         ) WHERE league_id = $1 AND user_id = $2`,
        [leagueId, claim.claimant_id]
      )
      // Clear lineups for all non-finalized weeks so the manager must re-set
      // their lineup with the updated roster. Completed week lineups are preserved.
      await clearUncompletedLineups(leagueId, claim.claimant_id, client)
    })

    claimedPlayerIds.add(claim.claim_player_id)
    managersWithGrant.add(claim.claimant_id)
  }
}
