import pg from 'pg'
import { pool, withTransaction } from '../client.js'

export interface TradeProposal {
  id: string
  league_id: string
  proposer_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'vetoed' | 'cancelled' | 'expired'
  veto_deadline: string | null
  note: string | null
  created_at: string
  resolved_at: string | null
  // joined
  proposer_username: string
  proposer_full_name: string
  receiver_username: string
  receiver_full_name: string
}

export interface TradeItem {
  id: string
  trade_id: string
  player_id: string
  from_user: string
  to_user: string
  // joined
  player_name: string
  player_role: string
  player_ipl_team: string
}

export async function proposeTrade(data: {
  leagueId: string
  proposerId: string
  receiverId: string
  note?: string
  vetoHours: number
  items: Array<{ playerId: string; fromUser: string; toUser: string }>
}): Promise<TradeProposal> {
  return withTransaction(async (client: pg.PoolClient) => {
    const vetoDeadline = new Date(Date.now() + data.vetoHours * 60 * 60 * 1000).toISOString()

    const { rows } = await client.query<TradeProposal>(
      `INSERT INTO trade_proposals (league_id, proposer_id, receiver_id, note, veto_deadline)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.leagueId, data.proposerId, data.receiverId, data.note ?? null, vetoDeadline]
    )
    const trade = rows[0]

    for (const item of data.items) {
      await client.query(
        `INSERT INTO trade_items (trade_id, player_id, from_user, to_user)
         VALUES ($1, $2, $3, $4)`,
        [trade.id, item.playerId, item.fromUser, item.toUser]
      )
    }

    return trade
  })
}

export async function getTradeById(tradeId: string): Promise<TradeProposal | null> {
  const { rows } = await pool.query<TradeProposal>(
    `SELECT tp.*,
            pp.username AS proposer_username, pp.full_name AS proposer_full_name,
            rp.username AS receiver_username, rp.full_name AS receiver_full_name
     FROM trade_proposals tp
     JOIN profiles pp ON pp.id = tp.proposer_id
     JOIN profiles rp ON rp.id = tp.receiver_id
     WHERE tp.id = $1`,
    [tradeId]
  )
  return rows[0] ?? null
}

export async function getTradeItems(tradeId: string): Promise<TradeItem[]> {
  const { rows } = await pool.query<TradeItem>(
    `SELECT ti.*, p.name AS player_name, p.role AS player_role, p.ipl_team AS player_ipl_team
     FROM trade_items ti
     JOIN players p ON p.id = ti.player_id
     WHERE ti.trade_id = $1`,
    [tradeId]
  )
  return rows
}

export async function getLeagueTrades(leagueId: string): Promise<TradeProposal[]> {
  const { rows } = await pool.query<TradeProposal>(
    `SELECT tp.*,
            pp.username AS proposer_username, pp.full_name AS proposer_full_name,
            rp.username AS receiver_username, rp.full_name AS receiver_full_name
     FROM trade_proposals tp
     JOIN profiles pp ON pp.id = tp.proposer_id
     JOIN profiles rp ON rp.id = tp.receiver_id
     WHERE tp.league_id = $1
     ORDER BY tp.created_at DESC`,
    [leagueId]
  )
  return rows
}

export async function getMyTrades(leagueId: string, userId: string): Promise<TradeProposal[]> {
  const { rows } = await pool.query<TradeProposal>(
    `SELECT tp.*,
            pp.username AS proposer_username, pp.full_name AS proposer_full_name,
            rp.username AS receiver_username, rp.full_name AS receiver_full_name
     FROM trade_proposals tp
     JOIN profiles pp ON pp.id = tp.proposer_id
     JOIN profiles rp ON rp.id = tp.receiver_id
     WHERE tp.league_id = $1 AND (tp.proposer_id = $2 OR tp.receiver_id = $2)
     ORDER BY tp.created_at DESC`,
    [leagueId, userId]
  )
  return rows
}

export async function respondToTrade(
  tradeId: string,
  userId: string,
  action: 'accepted' | 'rejected'
): Promise<{ ok: boolean; error?: string }> {
  if (action === 'rejected') {
    const { rowCount } = await pool.query(
      `UPDATE trade_proposals SET status = 'rejected', resolved_at = NOW()
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [tradeId, userId]
    )
    return rowCount && rowCount > 0 ? { ok: true } : { ok: false, error: 'Trade not found or not actionable' }
  }

  // Accept: execute roster swaps atomically
  return withTransaction(async (client: pg.PoolClient) => {
    const { rows: proposal } = await client.query(
      `SELECT * FROM trade_proposals WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       FOR UPDATE`,
      [tradeId, userId]
    )
    if (proposal.length === 0) return { ok: false, error: 'Trade not found or not actionable' }
    const trade = proposal[0]

    const { rows: items } = await client.query<TradeItem>(
      `SELECT * FROM trade_items WHERE trade_id = $1`,
      [tradeId]
    )

    for (const item of items) {
      const { rowCount } = await client.query(
        `UPDATE team_rosters SET user_id = $1
         WHERE league_id = $2 AND player_id = $3 AND user_id = $4`,
        [item.to_user, trade.league_id, item.player_id, item.from_user]
      )
      if (!rowCount || rowCount === 0) {
        throw new Error(`Player ${item.player_id} not on expected roster`)
      }
    }

    await client.query(
      `UPDATE trade_proposals SET status = 'accepted', resolved_at = NOW() WHERE id = $1`,
      [tradeId]
    )

    return { ok: true }
  })
}

export async function cancelTrade(tradeId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE trade_proposals SET status = 'cancelled', resolved_at = NOW()
     WHERE id = $1 AND proposer_id = $2 AND status = 'pending'`,
    [tradeId, userId]
  )
  return (rowCount ?? 0) > 0
}

export async function vetoTrade(tradeId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE trade_proposals SET status = 'vetoed', resolved_at = NOW()
     WHERE id = $1 AND status = 'accepted' AND veto_deadline > NOW()`,
    [tradeId]
  )
  return (rowCount ?? 0) > 0
}
