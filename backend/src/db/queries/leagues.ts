import { pool } from '../client.js'

export interface League {
  id: string
  name: string
  invite_code: string
  admin_id: string
  starting_budget: number
  max_squad_size: number
  max_teams: number
  roster_size: number
  max_batsmen: number
  max_wicket_keepers: number
  max_all_rounders: number
  max_bowlers: number
  currency: 'usd' | 'lakhs'
  trade_deadline_week: number | null
  veto_hours: number
  status: 'draft_pending' | 'draft_active' | 'league_active' | 'league_complete'
  bid_timeout_secs: number
  created_at: string
}

export interface LeagueMember {
  id: string
  league_id: string
  user_id: string
  remaining_budget: number
  roster_count: number
  waiver_priority: number
  joined_at: string
  username: string
  full_name: string
  display_name: string | null
  avatar_url: string | null
}

export async function getUserLeagues(userId: string): Promise<League[]> {
  const { rows } = await pool.query<League>(
    `SELECT l.* FROM leagues l
     JOIN league_members lm ON lm.league_id = l.id
     WHERE lm.user_id = $1
     ORDER BY l.created_at DESC`,
    [userId]
  )
  return rows
}

export async function getLeagueById(id: string): Promise<League | null> {
  const { rows } = await pool.query<League>(
    `SELECT * FROM leagues WHERE id = $1`,
    [id]
  )
  return rows[0] ?? null
}

export async function getLeagueByInviteCode(code: string): Promise<League | null> {
  const { rows } = await pool.query<League>(
    `SELECT * FROM leagues WHERE invite_code = $1`,
    [code]
  )
  return rows[0] ?? null
}

export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  const { rows } = await pool.query<LeagueMember>(
    `SELECT lm.*, p.username, p.full_name, p.display_name, p.avatar_url
     FROM league_members lm
     JOIN profiles p ON p.id = lm.user_id
     WHERE lm.league_id = $1
     ORDER BY lm.joined_at`,
    [leagueId]
  )
  return rows
}

export async function isLeagueMember(leagueId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM league_members WHERE league_id = $1 AND user_id = $2`,
    [leagueId, userId]
  )
  return rows.length > 0
}

export async function createLeague(data: {
  name: string
  adminId: string
  startingBudget: number
  maxSquadSize: number
  maxTeams: number
  rosterSize: number
  maxBatsmen: number
  maxWicketKeepers: number
  maxAllRounders: number
  maxBowlers: number
  currency: 'usd' | 'lakhs'
  bidTimeoutSecs: number
  vetoHours: number
}): Promise<League> {
  const inviteCode = await generateInviteCode()

  const { rows } = await pool.query<League>(
    `INSERT INTO leagues
       (name, invite_code, admin_id, starting_budget, max_squad_size, max_teams, roster_size,
        max_batsmen, max_wicket_keepers, max_all_rounders, max_bowlers,
        currency, bid_timeout_secs, veto_hours, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft_pending')
     RETURNING *`,
    [
      data.name, inviteCode, data.adminId, data.startingBudget,
      data.maxSquadSize, data.maxTeams, data.rosterSize,
      data.maxBatsmen, data.maxWicketKeepers, data.maxAllRounders, data.maxBowlers,
      data.currency, data.bidTimeoutSecs, data.vetoHours,
    ]
  )

  // Admin auto-joins
  await pool.query(
    `INSERT INTO league_members (league_id, user_id, remaining_budget)
     VALUES ($1, $2, $3)`,
    [rows[0].id, data.adminId, data.startingBudget]
  )

  return rows[0]
}

export async function joinLeague(leagueId: string, userId: string, startingBudget: number): Promise<LeagueMember> {
  const { rows } = await pool.query<LeagueMember>(
    `INSERT INTO league_members (league_id, user_id, remaining_budget)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [leagueId, userId, startingBudget]
  )
  return rows[0]
}

export async function leaveLeague(leagueId: string, userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM league_members WHERE league_id = $1 AND user_id = $2`,
    [leagueId, userId]
  )
}

async function generateInviteCode(): Promise<string> {
  // Keep generating until we get a unique one
  for (let attempts = 0; attempts < 10; attempts++) {
    const { rows } = await pool.query<{ code: string }>(
      `SELECT upper(substring(md5(random()::text) FROM 1 FOR 6)) AS code`
    )
    const code = rows[0].code
    const { rows: existing } = await pool.query(
      `SELECT 1 FROM leagues WHERE invite_code = $1`,
      [code]
    )
    if (existing.length === 0) return code
  }
  throw new Error('Could not generate unique invite code')
}
