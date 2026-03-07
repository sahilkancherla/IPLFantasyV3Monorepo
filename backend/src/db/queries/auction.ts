import pg from 'pg'
import { pool, withTransaction } from '../client.js'

export interface AuctionSession {
  id: string
  league_id: string
  status: 'pending' | 'live' | 'paused' | 'completed'
  current_player_id: string | null
  current_bid: number | null
  current_bidder_id: string | null
  timer_expires_at: string | null
  players_sold: number
  players_unsold: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface AuctionQueueItem {
  id: string
  league_id: string
  player_id: string
  queue_position: number
  status: 'pending' | 'live' | 'sold' | 'unsold'
  sold_to: string | null
  sold_price: number | null
}

export async function getAuctionSession(leagueId: string): Promise<AuctionSession | null> {
  const { rows } = await pool.query<AuctionSession>(
    `SELECT * FROM auction_sessions WHERE league_id = $1`,
    [leagueId]
  )
  return rows[0] ?? null
}

export async function createAuctionSession(leagueId: string): Promise<AuctionSession> {
  const { rows } = await pool.query<AuctionSession>(
    `INSERT INTO auction_sessions (league_id, status, started_at) VALUES ($1, 'live', NOW())
     ON CONFLICT (league_id) DO UPDATE SET status = 'live', started_at = COALESCE(auction_sessions.started_at, NOW())
     RETURNING *`,
    [leagueId]
  )
  return rows[0]
}

export async function setupAuctionQueue(
  leagueId: string,
  playerIds: string[]
): Promise<void> {
  await pool.query(
    `DELETE FROM auction_player_queue WHERE league_id = $1`,
    [leagueId]
  )

  if (playerIds.length === 0) return

  const values = playerIds
    .map((id, idx) => `('${leagueId}', '${id}', ${idx + 1})`)
    .join(',')

  await pool.query(
    `INSERT INTO auction_player_queue (league_id, player_id, queue_position)
     VALUES ${values}`
  )
}

export async function getAuctionQueue(leagueId: string): Promise<AuctionQueueItem[]> {
  const { rows } = await pool.query<AuctionQueueItem>(
    `SELECT * FROM auction_player_queue
     WHERE league_id = $1
     ORDER BY queue_position`,
    [leagueId]
  )
  return rows
}

export interface AuctionHistoryItem {
  type: 'sold' | 'unsold'
  player_id: string
  name: string
  ipl_team: string
  role: string
  base_price: number
  nationality: string
  image_url: string | null
  winner_id: string | null
  winner_username: string | null
  winner_display_name: string | null
  winner_avatar_url: string | null
  sold_price: number | null
}

export async function getAuctionHistory(leagueId: string): Promise<AuctionHistoryItem[]> {
  const { rows } = await pool.query<AuctionHistoryItem>(
    `SELECT q.status AS type, q.player_id, q.sold_price,
            p.name, p.ipl_team, p.role, p.base_price, p.nationality, p.image_url,
            pr.id AS winner_id, pr.username AS winner_username,
            pr.display_name AS winner_display_name, pr.avatar_url AS winner_avatar_url
     FROM auction_player_queue q
     JOIN players p ON p.id = q.player_id
     LEFT JOIN profiles pr ON pr.id = q.sold_to
     WHERE q.league_id = $1 AND q.status IN ('sold', 'unsold')
     ORDER BY q.queue_position ASC`,
    [leagueId]
  )
  return rows
}

export async function getNextQueuedPlayer(leagueId: string): Promise<AuctionQueueItem | null> {
  const { rows } = await pool.query<AuctionQueueItem>(
    `SELECT q.*
     FROM auction_player_queue q
     LEFT JOIN (
       SELECT player_id, COUNT(*) AS interest_count
       FROM player_interests
       WHERE league_id = $1
       GROUP BY player_id
     ) i ON i.player_id = q.player_id
     WHERE q.league_id = $1 AND q.status = 'pending'
     ORDER BY COALESCE(i.interest_count, 0) DESC, q.queue_position ASC
     LIMIT 1`,
    [leagueId]
  )
  return rows[0] ?? null
}

export async function toggleInterest(
  leagueId: string,
  userId: string,
  playerId: string
): Promise<boolean> {
  // Returns true if interest was added, false if removed
  const { rows: existing } = await pool.query(
    `SELECT id FROM player_interests WHERE league_id = $1 AND user_id = $2 AND player_id = $3`,
    [leagueId, userId, playerId]
  )

  if (existing.length > 0) {
    await pool.query(
      `DELETE FROM player_interests WHERE league_id = $1 AND user_id = $2 AND player_id = $3`,
      [leagueId, userId, playerId]
    )
    return false
  } else {
    await pool.query(
      `INSERT INTO player_interests (league_id, user_id, player_id) VALUES ($1, $2, $3)`,
      [leagueId, userId, playerId]
    )
    return true
  }
}

export async function getMyInterests(leagueId: string, userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ player_id: string }>(
    `SELECT player_id FROM player_interests WHERE league_id = $1 AND user_id = $2`,
    [leagueId, userId]
  )
  return rows.map((r) => r.player_id)
}

export async function getInterestCounts(leagueId: string): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ player_id: string; count: string }>(
    `SELECT player_id, COUNT(*) AS count FROM player_interests WHERE league_id = $1 GROUP BY player_id`,
    [leagueId]
  )
  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.player_id] = parseInt(row.count, 10)
  }
  return result
}

export async function startAuctionSession(leagueId: string): Promise<AuctionSession> {
  const { rows } = await pool.query<AuctionSession>(
    `UPDATE auction_sessions
     SET status = 'live', started_at = NOW()
     WHERE league_id = $1
     RETURNING *`,
    [leagueId]
  )
  return rows[0]
}

export async function updateSessionStatus(
  leagueId: string,
  status: 'live' | 'paused' | 'completed'
): Promise<void> {
  const completedAt = status === 'completed' ? 'NOW()' : 'completed_at'
  await pool.query(
    `UPDATE auction_sessions
     SET status = $1, completed_at = ${completedAt}
     WHERE league_id = $2`,
    [status, leagueId]
  )

  // League status (draft_active → league_active etc.) is managed via PATCH /leagues/:id/status
}

export async function nominatePlayer(
  leagueId: string,
  playerId: string,
  _basePrice: number,
  timerExpiresAt: Date
): Promise<void> {
  await pool.query(
    `UPDATE auction_sessions
     SET current_player_id = $1, current_bid = NULL, current_bidder_id = NULL,
         timer_expires_at = $2
     WHERE league_id = $3`,
    [playerId, timerExpiresAt.toISOString(), leagueId]
  )

  await pool.query(
    `UPDATE auction_player_queue SET status = 'live'
     WHERE league_id = $1 AND player_id = $2`,
    [leagueId, playerId]
  )
}

export async function updateCurrentBid(
  leagueId: string,
  bidderId: string,
  amount: number,
  timerExpiresAt: Date
): Promise<void> {
  await pool.query(
    `UPDATE auction_sessions
     SET current_bid = $1, current_bidder_id = $2, timer_expires_at = $3
     WHERE league_id = $4`,
    [amount, bidderId, timerExpiresAt.toISOString(), leagueId]
  )
}

export async function recordPlayerSold(data: {
  leagueId: string
  sessionId: string
  playerId: string
  winnerId: string
  price: number
}): Promise<void> {
  await withTransaction(async (client: pg.PoolClient) => {
    // Mark queue item as sold
    await client.query(
      `UPDATE auction_player_queue
       SET status = 'sold', sold_to = $1, sold_price = $2
       WHERE league_id = $3 AND player_id = $4`,
      [data.winnerId, data.price, data.leagueId, data.playerId]
    )

    // Deduct budget and increment roster count
    await client.query(
      `UPDATE league_members
       SET remaining_budget = remaining_budget - $1, roster_count = roster_count + 1
       WHERE league_id = $2 AND user_id = $3`,
      [data.price, data.leagueId, data.winnerId]
    )

    // Insert into team_rosters
    await client.query(
      `INSERT INTO team_rosters (league_id, user_id, player_id, price_paid)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (league_id, player_id) DO NOTHING`,
      [data.leagueId, data.winnerId, data.playerId, data.price]
    )

    // Update auction session
    await client.query(
      `UPDATE auction_sessions
       SET current_player_id = NULL, current_bid = NULL, current_bidder_id = NULL,
           timer_expires_at = NULL, players_sold = players_sold + 1
       WHERE league_id = $1`,
      [data.leagueId]
    )

    // Record bid in audit log
    await client.query(
      `INSERT INTO bids (session_id, player_id, bidder_id, amount)
       VALUES ($1, $2, $3, $4)`,
      [data.sessionId, data.playerId, data.winnerId, data.price]
    )
  })
}

export async function assignPlayerToTeam(data: {
  leagueId: string
  sessionId: string
  playerId: string
  userId: string
  price: number
}): Promise<void> {
  await withTransaction(async (client: pg.PoolClient) => {
    await client.query(
      `UPDATE auction_player_queue SET status = 'sold', sold_to = $1, sold_price = $2
       WHERE league_id = $3 AND player_id = $4`,
      [data.userId, data.price, data.leagueId, data.playerId]
    )
    await client.query(
      `UPDATE league_members SET remaining_budget = remaining_budget - $1, roster_count = roster_count + 1
       WHERE league_id = $2 AND user_id = $3`,
      [data.price, data.leagueId, data.userId]
    )
    await client.query(
      `INSERT INTO team_rosters (league_id, user_id, player_id, price_paid)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (league_id, player_id) DO UPDATE SET user_id = $2, price_paid = $4`,
      [data.leagueId, data.userId, data.playerId, data.price]
    )
    await client.query(
      `UPDATE auction_sessions SET players_sold = players_sold + 1 WHERE league_id = $1`,
      [data.leagueId]
    )
  })
}

export async function movePlayerBetweenTeams(data: {
  leagueId: string
  playerId: string
  toUserId: string
  price: number
}): Promise<void> {
  await withTransaction(async (client: pg.PoolClient) => {
    const { rows } = await client.query<{ user_id: string; price_paid: number }>(
      `SELECT user_id, price_paid FROM team_rosters WHERE league_id = $1 AND player_id = $2`,
      [data.leagueId, data.playerId]
    )
    if (rows.length === 0) throw new Error('Player is not in any roster')

    const fromUserId = rows[0].user_id
    const oldPrice = rows[0].price_paid

    // Restore old owner's budget
    await client.query(
      `UPDATE league_members SET remaining_budget = remaining_budget + $1, roster_count = roster_count - 1
       WHERE league_id = $2 AND user_id = $3`,
      [oldPrice, data.leagueId, fromUserId]
    )
    await client.query(
      `DELETE FROM team_rosters WHERE league_id = $1 AND player_id = $2`,
      [data.leagueId, data.playerId]
    )
    // Charge new owner
    await client.query(
      `UPDATE league_members SET remaining_budget = remaining_budget - $1, roster_count = roster_count + 1
       WHERE league_id = $2 AND user_id = $3`,
      [data.price, data.leagueId, data.toUserId]
    )
    await client.query(
      `INSERT INTO team_rosters (league_id, user_id, player_id, price_paid) VALUES ($1, $2, $3, $4)`,
      [data.leagueId, data.toUserId, data.playerId, data.price]
    )
    await client.query(
      `UPDATE auction_player_queue SET sold_to = $1, sold_price = $2
       WHERE league_id = $3 AND player_id = $4`,
      [data.toUserId, data.price, data.leagueId, data.playerId]
    )
  })
}

export async function recordPlayerUnsold(leagueId: string, playerId: string): Promise<void> {
  await pool.query(
    `UPDATE auction_player_queue SET status = 'unsold'
     WHERE league_id = $1 AND player_id = $2`,
    [leagueId, playerId]
  )

  await pool.query(
    `UPDATE auction_sessions
     SET current_player_id = NULL, current_bid = NULL, current_bidder_id = NULL,
         timer_expires_at = NULL, players_unsold = players_unsold + 1
     WHERE league_id = $1`,
    [leagueId]
  )
}
