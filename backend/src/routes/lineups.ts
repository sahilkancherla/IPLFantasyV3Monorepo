import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember, getLeagueById } from '../db/queries/leagues.js'
import { getLineup, validateLineup, setLineup, autoSetLineup, getGameBreakdown } from '../db/queries/lineups.js'
import { isWeekLocked, getCurrentWeek } from '../services/schedule.service.js'

const setLineupSchema = z.object({
  weekNum: z.number().int().min(1),
  entries: z.array(
    z.object({
      playerId: z.string().uuid(),
      slotRole: z.enum(['batsman', 'wicket_keeper', 'all_rounder', 'bowler', 'flex']),
    })
  ).max(11),
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
    if (!body.success) {
      req.log.warn({ err: body.error.flatten() }, 'setLineup schema validation failed')
      return reply.code(400).send({ error: body.error.flatten() })
    }

    const { weekNum, entries } = body.data

    const locked = await isWeekLocked(weekNum)
    if (locked) return reply.code(409).send({ error: 'Lineup is locked for this week' })

    const validation = await validateLineup(leagueId, req.authUser!.id, entries)
    if (!validation.valid) {
      req.log.warn({ err: validation.error, leagueId, userId: req.authUser!.id, weekNum, entries }, 'setLineup validation failed')
      return reply.code(400).send({ error: validation.error })
    }

    await setLineup(leagueId, req.authUser!.id, weekNum, entries)
    const lineup = await getLineup(leagueId, req.authUser!.id, weekNum)
    return reply.send({ lineup })
  })

  // GET /lineups/:leagueId/game-breakdown — per-game points for caller (or userId) vs opponent
  app.get<{ Params: { leagueId: string }; Querystring: { week?: string; opponentId?: string; userId?: string } }>(
    '/lineups/:leagueId/game-breakdown',
    async (req, reply) => {
      const { leagueId } = req.params
      const { week, opponentId, userId } = req.query

      if (!opponentId) return reply.code(400).send({ error: 'opponentId required' })

      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      let weekNum: number
      if (week) {
        weekNum = parseInt(week, 10)
        if (isNaN(weekNum)) return reply.code(400).send({ error: 'Invalid week' })
      } else {
        const current = await getCurrentWeek()
        if (!current) return reply.code(404).send({ error: 'No active week' })
        weekNum = current.week_num
      }

      // userId param lets any league member view another matchup's breakdown
      const subjectId = userId ?? req.authUser!.id
      const games = await getGameBreakdown(leagueId, subjectId, opponentId, weekNum)
      return reply.send({ games })
    }
  )

  // GET /lineups/:leagueId/all-totals — runtime-computed weekly fantasy points
  // for every member of the league. Sums match_scores.fantasy_points for the
  // starting XI of each user/week (no DB cache), plus any admin overrides.
  app.get<{ Params: { leagueId: string } }>(
    '/lineups/:leagueId/all-totals',
    async (req, reply) => {
      const { leagueId } = req.params
      const isMember = await isLeagueMember(leagueId, req.authUser!.id)
      if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

      const { pool } = await import('../db/client.js')
      const { rows } = await pool.query<{ user_id: string; week_num: number; points: string }>(
        `WITH starter_pts AS (
           SELECT wl.user_id, wl.week_num,
                  COALESCE(SUM(ms.fantasy_points), 0) AS points
           FROM weekly_lineups wl
           JOIN ipl_matches im ON im.week_num = wl.week_num
           LEFT JOIN match_scores ms
             ON ms.player_id = wl.player_id AND ms.match_id = im.match_id
           WHERE wl.league_id = $1
           GROUP BY wl.user_id, wl.week_num
         ),
         overrides AS (
           SELECT user_id, week_num, points
           FROM league_points_overrides
           WHERE league_id = $1
         )
         SELECT
           COALESCE(s.user_id, o.user_id)   AS user_id,
           COALESCE(s.week_num, o.week_num) AS week_num,
           COALESCE(s.points, 0) + COALESCE(o.points, 0) AS points
         FROM starter_pts s
         FULL OUTER JOIN overrides o
           ON o.user_id = s.user_id AND o.week_num = s.week_num`,
        [leagueId]
      )
      const totals = rows.map((r) => ({
        userId: r.user_id,
        weekNum: Number(r.week_num),
        points: parseFloat(r.points) || 0,
      }))
      return reply.send({ totals })
    }
  )

  // PUT /lineups/:leagueId/user/:userId — admin sets lineup for another member
  app.put<{ Params: { leagueId: string; userId: string } }>('/lineups/:leagueId/user/:userId', async (req, reply) => {
    const { leagueId, userId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const league = await getLeagueById(leagueId)
    if (!league || league.admin_id !== req.authUser!.id) {
      return reply.code(403).send({ error: 'Only the league admin can set lineups for other members' })
    }

    const body = setLineupSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { weekNum, entries } = body.data

    const validation = await validateLineup(leagueId, userId, entries)
    if (!validation.valid) return reply.code(400).send({ error: validation.error })

    await setLineup(leagueId, userId, weekNum, entries)
    const lineup = await getLineup(leagueId, userId, weekNum)
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
