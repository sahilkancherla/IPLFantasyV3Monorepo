import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember } from '../db/queries/leagues.js'
import { getLeaderboard } from '../db/queries/leaderboard.js'

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  // GET /leaderboard/:leagueId — requires auth + membership
  app.get<{ Params: { leagueId: string } }>(
    '/leaderboard/:leagueId',
    { preHandler: authenticate },
    async (req, reply) => {
      const { leagueId } = req.params

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member' })

      const leaderboard = await getLeaderboard(leagueId)
      return reply.send({ leaderboard })
    }
  )
}
