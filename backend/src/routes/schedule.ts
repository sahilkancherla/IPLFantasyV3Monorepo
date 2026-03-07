import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember, getLeagueById } from '../db/queries/leagues.js'
import { getLeagueSchedule, getMatchupForWeek, getAllWeeks, getCurrentWeekRow } from '../db/queries/schedule.js'
import { getCurrentWeek, isWeekLocked } from '../services/schedule.service.js'

export async function scheduleRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /schedule/weeks — all IPL weeks
  app.get('/schedule/weeks', async (_req, reply) => {
    const weeks = await getAllWeeks()
    return reply.send({ weeks })
  })

  // GET /schedule/weeks/current — current active week
  app.get('/schedule/weeks/current', async (_req, reply) => {
    const week = await getCurrentWeek()
    return reply.send({ week })
  })

  // GET /schedule/:leagueId — full league schedule
  app.get<{ Params: { leagueId: string } }>('/schedule/:leagueId', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) {
      return reply.code(403).send({ error: 'Not a member of this league' })
    }

    const matchups = await getLeagueSchedule(leagueId)
    return reply.send({ matchups })
  })

  // GET /schedule/:leagueId/week/:weekNum — caller's matchup for a week
  app.get<{ Params: { leagueId: string; weekNum: string } }>(
    '/schedule/:leagueId/week/:weekNum',
    async (req, reply) => {
      const { leagueId, weekNum } = req.params
      const week = parseInt(weekNum, 10)
      if (isNaN(week)) return reply.code(400).send({ error: 'Invalid week number' })

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      const matchup = await getMatchupForWeek(leagueId, week, req.authUser!.id)
      const locked = await isWeekLocked(week)
      return reply.send({ matchup, locked })
    }
  )

  // POST /schedule/:leagueId/generate — admin generates schedule when transitioning to league_active
  app.post<{ Params: { leagueId: string } }>('/schedule/:leagueId/generate', async (req, reply) => {
    const { leagueId } = req.params

    const league = await getLeagueById(leagueId)
    if (!league) return reply.code(404).send({ error: 'League not found' })
    if (league.admin_id !== req.authUser!.id) return reply.code(403).send({ error: 'Admin only' })
    if (league.status !== 'league_active') {
      return reply.code(409).send({ error: 'League must be in league_active status' })
    }

    const { generateLeagueSchedule } = await import('../services/schedule.service.js')
    await generateLeagueSchedule(leagueId)
    const matchups = await getLeagueSchedule(leagueId)
    return reply.send({ matchups })
  })

  // POST /schedule/:leagueId/week/:weekNum/finalize — admin finalizes a week
  app.post<{ Params: { leagueId: string; weekNum: string } }>(
    '/schedule/:leagueId/week/:weekNum/finalize',
    async (req, reply) => {
      const { leagueId, weekNum } = req.params
      const week = parseInt(weekNum, 10)
      if (isNaN(week)) return reply.code(400).send({ error: 'Invalid week number' })

      const league = await getLeagueById(leagueId)
      if (!league) return reply.code(404).send({ error: 'League not found' })
      if (league.admin_id !== req.authUser!.id) return reply.code(403).send({ error: 'Admin only' })

      const { pool } = await import('../db/client.js')
      await pool.query(`SELECT finalize_week($1, $2)`, [leagueId, week])
      return reply.send({ ok: true })
    }
  )
}
