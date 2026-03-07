import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember, getLeagueById } from '../db/queries/leagues.js'
import { getUserTeam, getAllTeams } from '../db/queries/teams.js'

export async function teamRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /teams/:leagueId
  app.get<{ Params: { leagueId: string } }>('/teams/:leagueId', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member' })

    const roster = await getUserTeam(leagueId, req.authUser!.id)
    return reply.send({ roster })
  })

  // GET /teams/:leagueId/all
  app.get<{ Params: { leagueId: string } }>('/teams/:leagueId/all', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member' })

    const league = await getLeagueById(leagueId)
    if (league?.status === 'draft_pending' || league?.status === 'draft_active') {
      return reply.code(403).send({ error: 'Teams are only visible after the draft' })
    }

    const rosters = await getAllTeams(leagueId)
    return reply.send({ rosters })
  })
}
