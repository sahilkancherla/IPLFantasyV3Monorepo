import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { pool } from '../db/client.js'

export async function iplTeamRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /ipl-teams — full lookup table for IPL franchise metadata.
  // Mobile fetches once at app boot (5min stale) and renders logos/abbrevs.
  app.get('/ipl-teams', async (_req, reply) => {
    const { rows } = await pool.query<{
      slug: string
      name: string
      abbrev: string
      logo_path: string
      display_order: number
    }>(
      `SELECT slug, name, abbrev, logo_path, display_order
       FROM ipl_teams
       ORDER BY display_order ASC, name ASC`
    )
    return reply.send({ teams: rows })
  })
}
