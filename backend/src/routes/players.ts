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

  // GET /players/:id/stats — all match performances for a player
  app.get<{ Params: { id: string } }>('/players/:id/stats', async (req, reply) => {
    const { pool } = await import('../db/client.js')
    const { rows } = await pool.query(
      `SELECT
         ms.match_id,
         ms.fantasy_points       AS points,
         ms.runs_scored,
         ms.balls_faced,
         ms.fours,
         ms.sixes,
         ms.is_out,
         ms.balls_bowled,
         ms.runs_conceded,
         ms.wickets_taken,
         ms.maidens,
         ms.catches,
         ms.stumpings,
         ms.run_outs_direct,
         ms.run_outs_indirect,
         COALESCE(ms.is_in_xi, true)             AS is_in_xi,
         COALESCE(im.match_number, ms.ipl_week)  AS match_number,
         im.home_team,
         im.away_team,
         COALESCE(im.match_date::text, ms.match_date::text) AS match_date,
         im.start_time_utc,
         COALESCE(im.status, 'completed')         AS status,
         p.ipl_team               AS player_ipl_team,
         COALESCE(im.week_num, ms.ipl_week)       AS week_num,
         iw.label                                 AS week_label
       FROM match_scores ms
       LEFT JOIN ipl_matches im ON im.match_id = ms.match_id
       LEFT JOIN ipl_weeks iw ON iw.week_num = COALESCE(im.week_num, ms.ipl_week)
       JOIN players p ON p.id = ms.player_id
       WHERE ms.player_id = $1
       ORDER BY COALESCE(im.match_date, ms.match_date) DESC, im.start_time_utc DESC NULLS LAST`,
      [req.params.id]
    )
    const stats = rows.map((r: Record<string, unknown>) => ({
      matchId: r.match_id,
      matchNumber: r.match_number ?? null,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      matchDate: r.match_date,
      startTimeUtc: r.start_time_utc ?? null,
      status: r.status,
      playerIplTeam: r.player_ipl_team,
      weekNum: r.week_num != null ? Number(r.week_num) : null,
      weekLabel: r.week_label ?? null,
      points: parseFloat(r.points as string) || 0,
      runsScored: parseInt(r.runs_scored as string, 10) || 0,
      ballsFaced: parseInt(r.balls_faced as string, 10) || 0,
      fours: parseInt(r.fours as string, 10) || 0,
      sixes: parseInt(r.sixes as string, 10) || 0,
      isOut: r.is_out ?? false,
      ballsBowled: parseInt(r.balls_bowled as string, 10) || 0,
      runsConceded: parseInt(r.runs_conceded as string, 10) || 0,
      wicketsTaken: parseInt(r.wickets_taken as string, 10) || 0,
      maidens: parseInt(r.maidens as string, 10) || 0,
      catches: parseInt(r.catches as string, 10) || 0,
      stumpings: parseInt(r.stumpings as string, 10) || 0,
      runOutsDirect: parseInt(r.run_outs_direct as string, 10) || 0,
      runOutsIndirect: parseInt(r.run_outs_indirect as string, 10) || 0,
      isInXI: r.is_in_xi !== false,
    }))
    return reply.send({ stats })
  })

  // GET /players/:id/upcoming — future matches for the player's IPL team
  app.get<{ Params: { id: string } }>('/players/:id/upcoming', async (req, reply) => {
    const { pool } = await import('../db/client.js')
    const { rows } = await pool.query(
      `SELECT im.match_id, im.match_number, im.home_team, im.away_team,
              im.match_date::text AS match_date, im.start_time_utc, im.status, im.venue,
              p.ipl_team AS player_ipl_team,
              im.week_num,
              iw.label AS week_label
       FROM players p
       JOIN ipl_matches im
         ON im.home_team = p.ipl_team OR im.away_team = p.ipl_team
       LEFT JOIN ipl_weeks iw ON iw.week_num = im.week_num
       WHERE p.id = $1
         AND im.status IN ('pending', 'upcoming')
       ORDER BY im.match_date ASC, im.start_time_utc ASC NULLS LAST
       LIMIT 10`,
      [req.params.id]
    )
    const matches = rows.map((r: Record<string, unknown>) => ({
      matchId: r.match_id,
      matchNumber: r.match_number ?? null,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      matchDate: r.match_date,
      startTimeUtc: r.start_time_utc ?? null,
      status: r.status,
      venue: r.venue ?? null,
      playerIplTeam: r.player_ipl_team,
      weekNum: r.week_num != null ? Number(r.week_num) : null,
      weekLabel: r.week_label ?? null,
    }))
    return reply.send({ matches })
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
