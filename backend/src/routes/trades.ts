import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember, getLeagueById } from '../db/queries/leagues.js'
import {
  proposeTrade,
  getTradeById,
  getTradeItems,
  getLeagueTrades,
  getMyTrades,
  respondToTrade,
  cancelTrade,
  vetoTrade,
} from '../db/queries/trades.js'

const proposeTradeSchema = z.object({
  receiverId: z.string().uuid(),
  note: z.string().max(500).optional(),
  // items: players the proposer sends TO receiver, plus players receiver sends TO proposer
  items: z.array(
    z.object({
      playerId: z.string().uuid(),
      fromUser: z.string().uuid(),
      toUser: z.string().uuid(),
    })
  ).min(1),
})

export async function tradeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /trades/:leagueId — all trades in the league
  app.get<{ Params: { leagueId: string } }>('/trades/:leagueId', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const trades = await getLeagueTrades(leagueId)
    return reply.send({ trades })
  })

  // GET /trades/:leagueId/mine — caller's trades
  app.get<{ Params: { leagueId: string } }>('/trades/:leagueId/mine', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const trades = await getMyTrades(leagueId, req.authUser!.id)
    return reply.send({ trades })
  })

  // GET /trades/:leagueId/:tradeId — single trade detail with items
  app.get<{ Params: { leagueId: string; tradeId: string } }>(
    '/trades/:leagueId/:tradeId',
    async (req, reply) => {
      const { leagueId, tradeId } = req.params

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      const trade = await getTradeById(tradeId)
      if (!trade || trade.league_id !== leagueId) return reply.code(404).send({ error: 'Trade not found' })

      const items = await getTradeItems(tradeId)
      return reply.send({ trade, items })
    }
  )

  // POST /trades/:leagueId — propose a trade
  app.post<{ Params: { leagueId: string } }>('/trades/:leagueId', async (req, reply) => {
    const { leagueId } = req.params
    const userId = req.authUser!.id

    const league = await getLeagueById(leagueId)
    if (!league) return reply.code(404).send({ error: 'League not found' })
    if (league.status !== 'league_active') {
      return reply.code(409).send({ error: 'Trades are only available during an active season' })
    }

    // Check trade deadline
    if (league.trade_deadline_week) {
      const { getCurrentWeek } = await import('../services/schedule.service.js')
      const current = await getCurrentWeek()
      if (current && current.week_num >= league.trade_deadline_week) {
        return reply.code(409).send({ error: 'Trade deadline has passed' })
      }
    }

    const isMember = await isLeagueMember(leagueId, userId)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const body = proposeTradeSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { receiverId, note, items } = body.data

    if (receiverId === userId) {
      return reply.code(400).send({ error: 'Cannot trade with yourself' })
    }

    const isReceiverMember = await isLeagueMember(leagueId, receiverId)
    if (!isReceiverMember) return reply.code(400).send({ error: 'Receiver is not in this league' })

    // Validate all from/to users are proposer or receiver
    for (const item of items) {
      if (![userId, receiverId].includes(item.fromUser) || ![userId, receiverId].includes(item.toUser)) {
        return reply.code(400).send({ error: 'Trade items must be between proposer and receiver' })
      }
    }

    const trade = await proposeTrade({
      leagueId,
      proposerId: userId,
      receiverId,
      note,
      vetoHours: league.veto_hours,
      items,
    })

    return reply.code(201).send({ trade })
  })

  // POST /trades/:leagueId/:tradeId/accept — receiver accepts
  app.post<{ Params: { leagueId: string; tradeId: string } }>(
    '/trades/:leagueId/:tradeId/accept',
    async (req, reply) => {
      const { leagueId, tradeId } = req.params

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      const result = await respondToTrade(tradeId, req.authUser!.id, 'accepted')
      if (!result.ok) return reply.code(409).send({ error: result.error })

      return reply.send({ ok: true })
    }
  )

  // POST /trades/:leagueId/:tradeId/reject — receiver rejects
  app.post<{ Params: { leagueId: string; tradeId: string } }>(
    '/trades/:leagueId/:tradeId/reject',
    async (req, reply) => {
      const { leagueId, tradeId } = req.params

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      const result = await respondToTrade(tradeId, req.authUser!.id, 'rejected')
      if (!result.ok) return reply.code(409).send({ error: result.error })

      return reply.code(204).send()
    }
  )

  // DELETE /trades/:leagueId/:tradeId — proposer cancels
  app.delete<{ Params: { leagueId: string; tradeId: string } }>(
    '/trades/:leagueId/:tradeId',
    async (req, reply) => {
      const { leagueId, tradeId } = req.params

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      const ok = await cancelTrade(tradeId, req.authUser!.id)
      if (!ok) return reply.code(409).send({ error: 'Trade not found or cannot be cancelled' })

      return reply.code(204).send()
    }
  )

  // POST /trades/:leagueId/:tradeId/veto — admin vetos an accepted trade within veto window
  app.post<{ Params: { leagueId: string; tradeId: string } }>(
    '/trades/:leagueId/:tradeId/veto',
    async (req, reply) => {
      const { leagueId, tradeId } = req.params

      const league = await getLeagueById(leagueId)
      if (!league) return reply.code(404).send({ error: 'League not found' })
      if (league.admin_id !== req.authUser!.id) return reply.code(403).send({ error: 'Admin only' })

      const ok = await vetoTrade(tradeId)
      if (!ok) return reply.code(409).send({ error: 'Trade not found, already resolved, or veto window expired' })

      return reply.send({ ok: true })
    }
  )
}
