import { pool } from '../client.js'

export interface Player {
  id: string
  name: string
  ipl_team: string
  role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper'
  base_price: number
  base_price_usd: number
  nationality: string
  image_url: string | null
  ipl_season: number
  is_active: boolean
}

export async function getAllPlayers(filters: {
  role?: string
  team?: string
  search?: string
}): Promise<Player[]> {
  const conditions = ['is_active = TRUE']
  const params: unknown[] = []
  let i = 1

  if (filters.role) {
    conditions.push(`role = $${i++}`)
    params.push(filters.role)
  }
  if (filters.team) {
    conditions.push(`ipl_team ILIKE $${i++}`)
    params.push(`%${filters.team}%`)
  }
  if (filters.search) {
    conditions.push(`name ILIKE $${i++}`)
    params.push(`%${filters.search}%`)
  }

  const { rows } = await pool.query<Player>(
    `SELECT id, name, ipl_team, role, base_price, base_price_usd, nationality, image_url, ipl_season, is_active
     FROM players
     WHERE ${conditions.join(' AND ')}
     ORDER BY name`,
    params
  )
  return rows
}

export async function getAvailablePlayers(leagueId: string): Promise<Player[]> {
  const { rows } = await pool.query<Player>(
    `SELECT p.id, p.name, p.ipl_team, p.role, p.base_price, p.base_price_usd, p.nationality, p.image_url, p.ipl_season, p.is_active
     FROM players p
     WHERE p.is_active = TRUE
       AND p.id NOT IN (
         SELECT player_id FROM auction_player_queue
         WHERE league_id = $1 AND status IN ('sold', 'live')
       )
     ORDER BY p.name`,
    [leagueId]
  )
  return rows
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const { rows } = await pool.query<Player>(
    `SELECT id, name, ipl_team, role, base_price, base_price_usd, nationality, image_url, ipl_season, is_active
     FROM players WHERE id = $1`,
    [id]
  )
  return rows[0] ?? null
}
