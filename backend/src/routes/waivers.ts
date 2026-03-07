import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember, getLeagueById } from '../db/queries/leagues.js'
import {
  getFreeAgents,
  getPendingClaims,
  getMyClaims,
  submitClaim,
  cancelClaim,
  processWaiverClaims,
} from '../db/queries/waivers.js'
import { pool } from '../db/client.js'

const submitClaimSchema = z.object({
  claimPlayerId: z.string().uuid(),
  dropPlayerId: z.string().uuid(),
})

export async function waiverRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /waivers/:leagueId/free-agents — players not on any roster
  app.get<{ Params: { leagueId: string } }>('/waivers/:leagueId/free-agents', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const players = await getFreeAgents(leagueId)
    return reply.send({ players })
  })

  // GET /waivers/:leagueId/claims — pending claims (all members can see for priority transparency)
  app.get<{ Params: { leagueId: string } }>('/waivers/:leagueId/claims', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const claims = await getPendingClaims(leagueId)
    return reply.send({ claims })
  })

  // GET /waivers/:leagueId/my-claims — caller's claim history
  app.get<{ Params: { leagueId: string } }>('/waivers/:leagueId/my-claims', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const claims = await getMyClaims(leagueId, req.authUser!.id)
    return reply.send({ claims })
  })

  // POST /waivers/:leagueId/claims — submit a waiver claim
  app.post<{ Params: { leagueId: string } }>('/waivers/:leagueId/claims', async (req, reply) => {
    const { leagueId } = req.params
    const userId = req.authUser!.id

    const league = await getLeagueById(leagueId)
    if (!league) return reply.code(404).send({ error: 'League not found' })
    if (league.status !== 'league_active') {
      return reply.code(409).send({ error: 'Waivers are only available during an active season' })
    }

    const isMember = await isLeagueMember(leagueId, userId)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const body = submitClaimSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { claimPlayerId, dropPlayerId } = body.data

    // Verify claim player is a free agent
    const { rows: onRoster } = await pool.query(
      `SELECT 1 FROM team_rosters WHERE league_id = $1 AND player_id = $2`,
      [leagueId, claimPlayerId]
    )
    if (onRoster.length > 0) {
      return reply.code(409).send({ error: 'That player is already on a roster' })
    }

    // Verify drop player is on caller's roster
    const { rows: ownsDrop } = await pool.query(
      `SELECT 1 FROM team_rosters WHERE league_id = $1 AND user_id = $2 AND player_id = $3`,
      [leagueId, userId, dropPlayerId]
    )
    if (ownsDrop.length === 0) {
      return reply.code(409).send({ error: 'Drop player is not on your roster' })
    }

    // Get caller's current waiver priority
    const { rows: member } = await pool.query(
      `SELECT waiver_priority FROM league_members WHERE league_id = $1 AND user_id = $2`,
      [leagueId, userId]
    )
    const priority = member[0]?.waiver_priority ?? 0

    const claim = await submitClaim({
      leagueId,
      claimantId: userId,
      claimPlayerId,
      dropPlayerId,
      priority,
    })

    return reply.code(201).send({ claim })
  })

  // DELETE /waivers/:leagueId/claims/:claimId — cancel a pending claim
  app.delete<{ Params: { leagueId: string; claimId: string } }>(
    '/waivers/:leagueId/claims/:claimId',
    async (req, reply) => {
      const { leagueId, claimId } = req.params

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      await cancelClaim(claimId, req.authUser!.id)
      return reply.code(204).send()
    }
  )

  // POST /waivers/:leagueId/process — admin processes all pending claims (runs on weekly cron)
  app.post<{ Params: { leagueId: string } }>('/waivers/:leagueId/process', async (req, reply) => {
    const { leagueId } = req.params

    const league = await getLeagueById(leagueId)
    if (!league) return reply.code(404).send({ error: 'League not found' })
    if (league.admin_id !== req.authUser!.id) return reply.code(403).send({ error: 'Admin only' })

    await processWaiverClaims(leagueId)
    return reply.send({ ok: true })
  })
}
