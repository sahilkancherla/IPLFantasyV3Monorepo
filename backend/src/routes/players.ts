import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { getAllPlayers, getAvailablePlayers, getPlayerById } from '../db/queries/players.js'
import { isLeagueMember } from '../db/queries/leagues.js'

export async function playerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /players
  app.get('/players', async (req, reply) => {
    const query = req.query as { role?: string; team?: string; search?: string }
    const players = await getAllPlayers({
      role: query.role,
      team: query.team,
      search: query.search,
    })
    return reply.send({ players })
  })

  // GET /players/:id
  app.get<{ Params: { id: string } }>('/players/:id', async (req, reply) => {
    const player = await getPlayerById(req.params.id)
    if (!player) return reply.code(404).send({ error: 'Player not found' })
    return reply.send({ player })
  })

  // GET /leagues/:id/players/available
  app.get<{ Params: { id: string } }>('/leagues/:id/players/available', async (req, reply) => {
    const { id } = req.params

    const isMember = await isLeagueMember(id, req.authUser!.id)
    if (!isMember) {
      return reply.code(403).send({ error: 'Not a member of this league' })
    }

    const players = await getAvailablePlayers(id)
    return reply.send({ players })
  })
}
