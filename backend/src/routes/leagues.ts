import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware.js'
import {
  getUserLeagues,
  getLeagueById,
  getLeagueByInviteCode,
  getLeagueMembers,
  isLeagueMember,
  createLeague,
  joinLeague,
  leaveLeague,
  updateTeamName,
} from '../db/queries/leagues.js'

const createLeagueSchema = z.object({
  name: z.string().min(3).max(50),
  teamName: z.string().min(2).max(50),
  startingBudget: z.number().int().min(100).max(10000).default(1000),
  maxSquadSize: z.number().int().min(5).max(25).default(15),
  maxTeams: z.number().int().min(2).max(6).default(6),
  rosterSize: z.number().int().min(11).max(20).default(16),
  maxBatsmen: z.number().int().min(1).max(15).default(6),
  maxWicketKeepers: z.number().int().min(1).max(5).default(2),
  maxAllRounders: z.number().int().min(1).max(10).default(4),
  maxBowlers: z.number().int().min(1).max(15).default(6),
  currency: z.enum(['usd', 'lakhs']).default('lakhs'),
  bidTimeoutSecs: z.number().int().min(5).max(120).default(15),
  vetoHours: z.number().int().min(0).max(72).default(24),
})

const joinLeagueSchema = z.object({
  inviteCode: z.string().length(6).toUpperCase(),
  teamName: z.string().min(2).max(50),
})

export async function leagueRoutes(app: FastifyInstance): Promise<void> {
  // All league routes require auth
  app.addHook('preHandler', authenticate)

  // GET /leagues
  app.get('/leagues', async (req, reply) => {
    const leagues = await getUserLeagues(req.authUser!.id)
    return reply.send({ leagues })
  })

  // POST /leagues
  app.post('/leagues', async (req, reply) => {
    const body = createLeagueSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() })
    }

    const league = await createLeague({
      name: body.data.name,
      adminId: req.authUser!.id,
      teamName: body.data.teamName,
      startingBudget: body.data.startingBudget,
      maxSquadSize: body.data.maxSquadSize,
      maxTeams: body.data.maxTeams,
      rosterSize: body.data.rosterSize,
      maxBatsmen: body.data.maxBatsmen,
      maxWicketKeepers: body.data.maxWicketKeepers,
      maxAllRounders: body.data.maxAllRounders,
      maxBowlers: body.data.maxBowlers,
      currency: body.data.currency,
      bidTimeoutSecs: body.data.bidTimeoutSecs,
      vetoHours: body.data.vetoHours,
    })

    return reply.code(201).send({ league })
  })

  // GET /leagues/:id
  app.get<{ Params: { id: string } }>('/leagues/:id', async (req, reply) => {
    const { id } = req.params
    const league = await getLeagueById(id)

    if (!league) {
      return reply.code(404).send({ error: 'League not found' })
    }

    const isMember = await isLeagueMember(id, req.authUser!.id)
    if (!isMember) {
      return reply.code(403).send({ error: 'Not a member of this league' })
    }

    const members = await getLeagueMembers(id)
    return reply.send({ league, members })
  })

  // POST /leagues/join
  app.post('/leagues/join', async (req, reply) => {
    const body = joinLeagueSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() })
    }

    const league = await getLeagueByInviteCode(body.data.inviteCode)
    if (!league) {
      return reply.code(404).send({ error: 'Invalid invite code' })
    }

    if (league.status !== 'draft_pending') {
      return reply.code(409).send({ error: 'League is not accepting new members' })
    }

    const members = await getLeagueMembers(league.id)
    if (members.length >= league.max_teams) {
      return reply.code(409).send({ error: 'League is full' })
    }

    const alreadyMember = await isLeagueMember(league.id, req.authUser!.id)
    if (alreadyMember) {
      return reply.code(409).send({ error: 'Already a member of this league' })
    }

    const member = await joinLeague(league.id, req.authUser!.id, league.starting_budget, body.data.teamName)
    return reply.code(201).send({ league, member })
  })

  // PATCH /leagues/:id/team-name
  app.patch<{ Params: { id: string } }>('/leagues/:id/team-name', async (req, reply) => {
    const { id } = req.params
    const body = z.object({ teamName: z.string().min(2).max(50) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const isMember = await isLeagueMember(id, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    await updateTeamName(id, req.authUser!.id, body.data.teamName)
    return reply.send({ ok: true })
  })

  // DELETE /leagues/:id/leave
  app.delete<{ Params: { id: string } }>('/leagues/:id/leave', async (req, reply) => {
    const { id } = req.params
    const league = await getLeagueById(id)

    if (!league) {
      return reply.code(404).send({ error: 'League not found' })
    }

    if (league.admin_id === req.authUser!.id) {
      return reply.code(409).send({ error: 'Admin cannot leave their own league' })
    }

    const isMember = await isLeagueMember(id, req.authUser!.id)
    if (!isMember) {
      return reply.code(404).send({ error: 'Not a member of this league' })
    }

    await leaveLeague(id, req.authUser!.id)
    return reply.code(204).send()
  })

  // PATCH /leagues/:id/status — admin advances league stage
  const statusTransitionSchema = z.object({
    status: z.enum(['draft_pending', 'draft_active', 'league_active', 'league_complete']),
  })

  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft_pending:    ['draft_active'],
    draft_active:     ['league_active'],
    league_active:    ['league_complete'],
    league_complete:  [],
  }

  app.patch<{ Params: { id: string } }>('/leagues/:id/status', async (req, reply) => {
    const { id } = req.params
    const league = await getLeagueById(id)

    if (!league) return reply.code(404).send({ error: 'League not found' })
    if (league.admin_id !== req.authUser!.id) return reply.code(403).send({ error: 'Admin only' })

    const body = statusTransitionSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const allowed = VALID_TRANSITIONS[league.status] ?? []
    if (!allowed.includes(body.data.status)) {
      return reply.code(409).send({
        error: `Cannot transition from ${league.status} to ${body.data.status}`,
      })
    }

    const { pool } = await import('../db/client.js')
    const { rows } = await pool.query(
      `UPDATE leagues SET status = $1 WHERE id = $2 RETURNING *`,
      [body.data.status, id]
    )

    // When starting the draft: populate player queue + create live auction session
    if (body.data.status === 'draft_active') {
      const { setupAuctionQueue, getAuctionQueue, createAuctionSession } = await import('../db/queries/auction.js')

      const existingQueue = await getAuctionQueue(id)
      if (existingQueue.length === 0) {
        const { rows: players } = await pool.query<{ id: string }>(
          `SELECT id FROM players WHERE is_active = true ORDER BY random()`,
        )
        if (players.length > 0) {
          await setupAuctionQueue(id, players.map(p => p.id))
        }
      }

      await createAuctionSession(id)
    }

    // When manually advancing to league_active, generate the schedule
    if (body.data.status === 'league_active') {
      await pool.query(`SELECT generate_schedule($1)`, [id])
    }

    return reply.send({ league: rows[0] })
  })

  // DELETE /leagues/:id — admin permanently deletes the league
  app.delete<{ Params: { id: string } }>('/leagues/:id', async (req, reply) => {
    const { id } = req.params

    const league = await getLeagueById(id)
    if (!league) return reply.code(404).send({ error: 'League not found' })
    if (league.admin_id !== req.authUser!.id) return reply.code(403).send({ error: 'Admin only' })

    // Kick any live WS clients and remove in-memory room
    const { getRoom, removeRoom } = await import('../services/auction.service.js')
    const room = getRoom(id)
    if (room) {
      for (const ws of room.connections.keys()) {
        try { ws.close(1000, 'League deleted') } catch {}
      }
      removeRoom(id)
    }

    const { pool } = await import('../db/client.js')
    await pool.query(`DELETE FROM leagues WHERE id = $1`, [id])

    return reply.code(204).send()
  })

  // DELETE /leagues/:id/auction — admin resets the auction back to draft_pending
  app.delete<{ Params: { id: string } }>('/leagues/:id/auction', async (req, reply) => {
    const { id } = req.params
    const { pool } = await import('../db/client.js')

    const league = await getLeagueById(id)
    if (!league) return reply.code(404).send({ error: 'League not found' })
    if (league.admin_id !== req.authUser!.id) return reply.code(403).send({ error: 'Admin only' })

    // Kick all connected WS clients and remove the in-memory room
    const { getRoom, removeRoom } = await import('../services/auction.service.js')
    const room = getRoom(id)
    if (room) {
      for (const ws of room.connections.keys()) {
        try { ws.close(1000, 'Auction deleted') } catch {}
      }
      removeRoom(id)
    }

    // Reset everything in a transaction
    await pool.query('BEGIN')
    try {
      await pool.query(`DELETE FROM auction_sessions       WHERE league_id = $1`, [id])
      await pool.query(`DELETE FROM auction_player_queue   WHERE league_id = $1`, [id])
      await pool.query(`DELETE FROM team_rosters           WHERE league_id = $1`, [id])
      await pool.query(`DELETE FROM weekly_matchups        WHERE league_id = $1`, [id])
      await pool.query(
        `UPDATE league_members
            SET remaining_budget = (SELECT starting_budget FROM leagues WHERE id = $1),
                roster_count = 0
          WHERE league_id = $1`,
        [id]
      )
      await pool.query(`UPDATE leagues SET status = 'draft_pending' WHERE id = $1`, [id])
      await pool.query('COMMIT')
    } catch (err) {
      await pool.query('ROLLBACK')
      throw err
    }

    return reply.code(204).send()
  })
}
