import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember } from '../db/queries/leagues.js'
import { getLineup, validateLineup, setLineup, autoSetLineup } from '../db/queries/lineups.js'
import { isWeekLocked, getCurrentWeek } from '../services/schedule.service.js'

const setLineupSchema = z.object({
  weekNum: z.number().int().min(1),
  entries: z.array(
    z.object({
      playerId: z.string().uuid(),
      slotRole: z.enum(['batsman', 'wicket_keeper', 'all_rounder', 'bowler']),
    })
  ).length(11),
})

export async function lineupRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /lineups/:leagueId — caller's lineup for current week (or ?week=N)
  app.get<{ Params: { leagueId: string }; Querystring: { week?: string } }>(
    '/lineups/:leagueId',
    async (req, reply) => {
      const { leagueId } = req.params

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      let weekNum: number
      if (req.query.week) {
        weekNum = parseInt(req.query.week, 10)
        if (isNaN(weekNum)) return reply.code(400).send({ error: 'Invalid week' })
      } else {
        const current = await getCurrentWeek()
        if (!current) return reply.code(404).send({ error: 'No active week' })
        weekNum = current.week_num
      }

      const lineup = await getLineup(leagueId, req.authUser!.id, weekNum)
      const locked = await isWeekLocked(weekNum)
      return reply.send({ lineup, weekNum, locked })
    }
  )

  // GET /lineups/:leagueId/user/:userId — any member's lineup (for matchup view)
  app.get<{ Params: { leagueId: string; userId: string }; Querystring: { week?: string } }>(
    '/lineups/:leagueId/user/:userId',
    async (req, reply) => {
      const { leagueId, userId } = req.params

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      let weekNum: number
      if (req.query.week) {
        weekNum = parseInt(req.query.week, 10)
        if (isNaN(weekNum)) return reply.code(400).send({ error: 'Invalid week' })
      } else {
        const current = await getCurrentWeek()
        if (!current) return reply.code(404).send({ error: 'No active week' })
        weekNum = current.week_num
      }

      const lineup = await getLineup(leagueId, userId, weekNum)
      return reply.send({ lineup, weekNum })
    }
  )

  // PUT /lineups/:leagueId — set lineup for a week
  app.put<{ Params: { leagueId: string } }>('/lineups/:leagueId', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const body = setLineupSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { weekNum, entries } = body.data

    const locked = await isWeekLocked(weekNum)
    if (locked) return reply.code(409).send({ error: 'Lineup is locked for this week' })

    const validation = await validateLineup(leagueId, req.authUser!.id, entries)
    if (!validation.valid) return reply.code(400).send({ error: validation.error })

    await setLineup(leagueId, req.authUser!.id, weekNum, entries)
    const lineup = await getLineup(leagueId, req.authUser!.id, weekNum)
    return reply.send({ lineup })
  })

  // POST /lineups/:leagueId/auto — auto-set from previous week (admin triggers before lock)
  app.post<{ Params: { leagueId: string } }>('/lineups/:leagueId/auto', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const current = await getCurrentWeek()
    if (!current) return reply.code(404).send({ error: 'No active week' })

    await autoSetLineup(leagueId, req.authUser!.id, current.week_num)
    const lineup = await getLineup(leagueId, req.authUser!.id, current.week_num)
    return reply.send({ lineup })
  })
}
