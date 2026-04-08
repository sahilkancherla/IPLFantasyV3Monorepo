import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember, getLeagueById } from '../db/queries/leagues.js'
import { pool } from '../db/client.js'
import {
  getAuctionSession,
  createAuctionSession,
  setupAuctionQueue,
  startAuctionSession,
  updateSessionStatus,
  getAuctionQueue,
  toggleInterest,
  getMyInterests,
  getInterestCounts,
  getNextQueuedPlayer,
  assignPlayerToTeam,
  movePlayerBetweenTeams,
} from '../db/queries/auction.js'
import {
  getRoom,
  getOrCreateRoom,
  broadcast,
  clearTimer,
  pauseTimer,
  resumeTimer,
  handleNominate,
  handlePass,
  handleTimerExpired,
  buildSessionState,
} from '../services/auction.service.js'

const setupSchema = z.object({
  playerIds: z.array(z.string().uuid()).min(1).max(300),
})

async function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
  leagueId: string
): Promise<boolean> {
  const league = await getLeagueById(leagueId)
  if (!league) {
    reply.code(404).send({ error: 'League not found' })
    return false
  }
  if (league.admin_id !== req.authUser!.id) {
    reply.code(403).send({ error: 'Admin only' })
    return false
  }
  return true
}

export async function auctionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /auction/:leagueId/session
  app.get<{ Params: { leagueId: string } }>('/auction/:leagueId/session', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member' })

    const session = await getAuctionSession(leagueId)
    if (!session) return reply.code(404).send({ error: 'No session found' })

    const queue = await getAuctionQueue(leagueId)
    return reply.send({ session, queue })
  })

  // POST /auction/:leagueId/setup
  app.post<{ Params: { leagueId: string } }>('/auction/:leagueId/setup', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    const body = setupSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    await setupAuctionQueue(leagueId, body.data.playerIds)
    await createAuctionSession(leagueId)

    return reply.send({ success: true })
  })

  // POST /auction/:leagueId/start
  app.post<{ Params: { leagueId: string } }>('/auction/:leagueId/start', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    // Auto-populate queue with all active players (random order) if queue is empty
    const existingQueue = await getAuctionQueue(leagueId)
    if (existingQueue.length === 0) {
      const { rows: players } = await pool.query<{ id: string }>(
        `SELECT id FROM players WHERE is_active = true ORDER BY random()`
      )
      if (players.length === 0) {
        return reply.code(409).send({ error: 'No active players found. Add players to the database first.' })
      }
      await setupAuctionQueue(leagueId, players.map(p => p.id))
    }

    const league = await getLeagueById(leagueId)
    const session = await startAuctionSession(leagueId)

    const room = getOrCreateRoom(leagueId, session.id, league!.bid_timeout_secs)
    room.status = 'live'

    broadcast(room, { type: 'SESSION_STATUS', status: 'live' })
    return reply.send({ session })
  })

  // POST /auction/:leagueId/pause
  app.post<{ Params: { leagueId: string } }>('/auction/:leagueId/pause', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    await updateSessionStatus(leagueId, 'paused')
    const room = getRoom(leagueId)
    if (room) {
      room.status = 'paused'
      pauseTimer(room)  // stops countdown and saves remaining ms
      // Clear timer_expires_at in DB so a server restart doesn't re-fire it
      await pool.query(
        `UPDATE auction_sessions SET timer_expires_at = NULL WHERE league_id = $1`,
        [leagueId]
      )
      broadcast(room, { type: 'SESSION_STATUS', status: 'paused' })
    }

    return reply.send({ success: true })
  })

  // POST /auction/:leagueId/resume
  app.post<{ Params: { leagueId: string } }>('/auction/:leagueId/resume', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    await updateSessionStatus(leagueId, 'live')
    const room = getRoom(leagueId)
    if (room) {
      room.status = 'live'
      const newExpiresAt = resumeTimer(room, () => handleTimerExpired(room))
      if (newExpiresAt) {
        // Persist the new expiry so clients and a potential server restart are in sync
        await pool.query(
          `UPDATE auction_sessions SET timer_expires_at = $1 WHERE league_id = $2`,
          [newExpiresAt.toISOString(), leagueId]
        )
      }
      // Broadcast full session state so all clients get the updated timerExpiresAt
      const state = await buildSessionState(room)
      broadcast(room, state)
    }

    return reply.send({ success: true })
  })

  // POST /auction/:leagueId/nominate (HTTP fallback — primary is via WS)
  app.post<{ Params: { leagueId: string } }>('/auction/:leagueId/nominate', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    const body = z.object({ playerId: z.string().uuid() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const room = getRoom(leagueId)
    if (!room) return reply.code(409).send({ error: 'No active room' })

    await handleNominate(room, body.data.playerId, req.authUser!.id)
    return reply.send({ success: true })
  })

  // POST /auction/:leagueId/pass
  app.post<{ Params: { leagueId: string } }>('/auction/:leagueId/pass', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    const room = getRoom(leagueId)
    if (!room) return reply.code(409).send({ error: 'No active room' })

    await handlePass(room)
    return reply.send({ success: true })
  })

  // POST /auction/:leagueId/interests/:playerId — toggle interest
  app.post<{ Params: { leagueId: string; playerId: string } }>(
    '/auction/:leagueId/interests/:playerId',
    async (req, reply) => {
      const { leagueId, playerId } = req.params

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member' })

      const added = await toggleInterest(leagueId, req.authUser!.id, playerId)
      return reply.send({ interested: added })
    }
  )

  // GET /auction/:leagueId/interests — my interests + all interest counts
  app.get<{ Params: { leagueId: string } }>('/auction/:leagueId/interests', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member' })

    const [myInterests, counts] = await Promise.all([
      getMyInterests(leagueId, req.authUser!.id),
      getInterestCounts(leagueId),
    ])

    return reply.send({ myInterests, counts })
  })

  // GET /auction/:leagueId/available — all players with queue status + interest counts
  app.get<{ Params: { leagueId: string } }>('/auction/:leagueId/available', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member' })

    const { rows } = await pool.query(
      `SELECT q.player_id, q.queue_position,
              CASE WHEN tr.player_id IS NOT NULL THEN 'sold' ELSE q.status END AS status,
              COALESCE(tr.user_id, q.sold_to) AS sold_to,
              COALESCE(tr.price_paid, q.sold_price) AS sold_price,
              p.name, p.ipl_team, p.role, p.base_price, p.nationality, p.image_url,
              COALESCE(i.interest_count, 0) AS interest_count,
              COALESCE((
                SELECT SUM(ms.fantasy_points)
                FROM match_scores ms
                WHERE ms.player_id = q.player_id
              ), 0) AS total_points,
              COALESCE((
                SELECT COUNT(*)
                FROM ipl_matches im
                WHERE (im.home_team = p.ipl_team OR im.away_team = p.ipl_team)
                  AND im.status = 'completed'
              ), 0) AS team_games_played
       FROM auction_player_queue q
       JOIN players p ON p.id = q.player_id
       LEFT JOIN team_rosters tr ON tr.league_id = $1 AND tr.player_id = q.player_id
       LEFT JOIN (
         SELECT player_id, COUNT(*) AS interest_count
         FROM player_interests
         WHERE league_id = $1
         GROUP BY player_id
       ) i ON i.player_id = q.player_id
       WHERE q.league_id = $1
       ORDER BY
         CASE
           WHEN tr.player_id IS NOT NULL THEN 3
           WHEN q.status = 'pending' THEN 0
           WHEN q.status = 'live' THEN 1
           WHEN q.status = 'unsold' THEN 2
           ELSE 4
         END,
         COALESCE(i.interest_count, 0) DESC,
         q.queue_position ASC`,
      [leagueId]
    )

    return reply.send({ players: rows })
  })

  // GET /auction/:leagueId/next-player — next pending player for nomination
  app.get<{ Params: { leagueId: string } }>('/auction/:leagueId/next-player', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    const next = await getNextQueuedPlayer(leagueId)
    return reply.send({ player: next ?? null })
  })

  // PATCH /auction/:leagueId/bid-timeout — update bid timer for future nominations
  app.patch<{ Params: { leagueId: string } }>('/auction/:leagueId/bid-timeout', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    const body = z.object({ bidTimeoutSecs: z.number().int().min(5).max(120) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    await pool.query(
      `UPDATE leagues SET bid_timeout_secs = $1 WHERE id = $2`,
      [body.data.bidTimeoutSecs, leagueId]
    )

    // Update in-memory room so next nomination uses the new timeout
    const room = getRoom(leagueId)
    if (room) room.bidTimeoutSecs = body.data.bidTimeoutSecs

    return reply.send({ bidTimeoutSecs: body.data.bidTimeoutSecs })
  })

  // POST /auction/:leagueId/admin/assign — assign a pending/unsold player directly to a team
  app.post<{ Params: { leagueId: string } }>('/auction/:leagueId/admin/assign', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    const body = z.object({
      playerId: z.string().uuid(),
      userId: z.string().uuid(),
      price: z.number().int().min(0),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const session = await getAuctionSession(leagueId)
    if (!session) return reply.code(409).send({ error: 'No auction session found' })

    const isMember = await isLeagueMember(leagueId, body.data.userId)
    if (!isMember) return reply.code(400).send({ error: 'Target user is not a league member' })

    await assignPlayerToTeam({
      leagueId,
      sessionId: session.id,
      playerId: body.data.playerId,
      userId: body.data.userId,
      price: body.data.price,
    })

    const room = getRoom(leagueId)
    if (room) {
      const state = await buildSessionState(room)
      broadcast(room, state)
    }

    return reply.send({ success: true })
  })

  // POST /auction/:leagueId/admin/move — move an already-assigned player to a different team
  app.post<{ Params: { leagueId: string } }>('/auction/:leagueId/admin/move', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    const body = z.object({
      playerId: z.string().uuid(),
      toUserId: z.string().uuid(),
      price: z.number().int().min(0),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const isMember = await isLeagueMember(leagueId, body.data.toUserId)
    if (!isMember) return reply.code(400).send({ error: 'Target user is not a league member' })

    await movePlayerBetweenTeams({
      leagueId,
      playerId: body.data.playerId,
      toUserId: body.data.toUserId,
      price: body.data.price,
    })

    const room = getRoom(leagueId)
    if (room) {
      const state = await buildSessionState(room)
      broadcast(room, state)
    }

    return reply.send({ success: true })
  })

  // POST /auction/:leagueId/end — admin force-ends auction and advances league to active phase
  app.post<{ Params: { leagueId: string } }>('/auction/:leagueId/end', async (req, reply) => {
    const { leagueId } = req.params
    if (!(await requireAdmin(req as never, reply, leagueId))) return

    const room = getRoom(leagueId)
    if (room) {
      clearTimer(room)
      room.status = 'completed'
      room.currentPlayer = null
      room.currentBid = null
      room.currentBidderId = null
      room.timerExpiresAt = null
      room.awaitingConfirmation = false
    }

    // Mark auction session completed
    await updateSessionStatus(leagueId, 'completed')

    // Transition league draft_active → league_active
    await pool.query(
      `UPDATE leagues SET status = 'league_active' WHERE id = $1 AND status = 'draft_active'`,
      [leagueId]
    )

    // Generate H2H matchup schedule
    await pool.query(`SELECT generate_schedule($1)`, [leagueId])

    if (room) {
      broadcast(room, { type: 'SESSION_STATUS', status: 'completed' })
    }

    return reply.send({ success: true })
  })
}
