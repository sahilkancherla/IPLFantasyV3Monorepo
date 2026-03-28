import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { pool } from '../db/client.js'
import { config } from '../config.js'
import { calcFantasyPoints, getWeekForDate } from '../services/scoring.service.js'
import { getAllWeeks } from '../services/schedule.service.js'
import { getRoom, getMemberStates, getAllRooms } from '../services/auction.service.js'

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  const secret = req.headers['x-admin-secret']
  if (!secret || secret !== config.ADMIN_SECRET) {
    reply.code(401).send({ error: 'Unauthorized' })
    return false
  }
  return true
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/settings — current_week + all ipl_weeks
  app.get('/admin/settings', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const [settingsRes, weeksRes] = await Promise.all([
      pool.query(`SELECT key, value FROM system_settings`),
      pool.query(`SELECT * FROM ipl_weeks ORDER BY week_num`),
    ])

    const settings: Record<string, string> = {}
    for (const row of settingsRes.rows) settings[row.key] = row.value

    return reply.send({ settings, weeks: weeksRes.rows })
  })

  // PATCH /admin/settings — update a single setting
  app.patch('/admin/settings', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = z.object({ key: z.string().min(1), value: z.string() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [body.data.key, body.data.value]
    )

    return reply.send({ success: true })
  })

  // GET /admin/teams — distinct ipl_team values from players
  app.get('/admin/teams', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { rows } = await pool.query(
      `SELECT DISTINCT ipl_team FROM players WHERE is_active = true ORDER BY ipl_team`
    )
    return reply.send({ teams: rows.map((r: { ipl_team: string }) => r.ipl_team) })
  })

  // GET /admin/matches — list all matches ordered by date desc
  app.get('/admin/matches', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { rows } = await pool.query(
      `SELECT * FROM ipl_matches ORDER BY match_date DESC, created_at DESC`
    )
    return reply.send({ matches: rows })
  })

  // POST /admin/matches — create a new match
  app.post('/admin/matches', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = z.object({
      homeTeam: z.string().min(1),
      awayTeam: z.string().min(1),
      matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      weekNum: z.number().int().min(1).optional(),
      venue: z.string().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const matchId = randomUUID()

    const { rows } = await pool.query(
      `INSERT INTO ipl_matches (match_id, home_team, away_team, match_date, week_num, venue)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        matchId,
        body.data.homeTeam,
        body.data.awayTeam,
        body.data.matchDate,
        body.data.weekNum ?? null,
        body.data.venue ?? null,
      ]
    )

    return reply.code(201).send({ match: rows[0] })
  })

  // DELETE /admin/matches/:matchId — delete a match and its scores
  app.delete<{ Params: { matchId: string } }>('/admin/matches/:matchId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { rows } = await pool.query(
      `SELECT match_id FROM ipl_matches WHERE id = $1`,
      [req.params.matchId]
    )
    if (rows.length > 0) {
      await pool.query(`DELETE FROM match_scores WHERE match_id = $1`, [rows[0].match_id])
    }
    await pool.query(`DELETE FROM ipl_matches WHERE id = $1`, [req.params.matchId])

    return reply.send({ success: true })
  })

  // GET /admin/matches/:matchId — match details + both teams' players + existing stats
  app.get<{ Params: { matchId: string } }>('/admin/matches/:matchId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { rows: matchRows } = await pool.query(
      `SELECT * FROM ipl_matches WHERE id = $1`,
      [req.params.matchId]
    )
    if (matchRows.length === 0) return reply.code(404).send({ error: 'Match not found' })
    const match = matchRows[0]

    const [homeRes, awayRes, statsRes] = await Promise.all([
      pool.query(
        `SELECT id, name, role, ipl_team FROM players
         WHERE ipl_team = $1 AND is_active = true
         ORDER BY
           CASE role WHEN 'batsman' THEN 1 WHEN 'wicket_keeper' THEN 2
                     WHEN 'all_rounder' THEN 3 WHEN 'bowler' THEN 4 ELSE 5 END,
           name`,
        [match.home_team]
      ),
      pool.query(
        `SELECT id, name, role, ipl_team FROM players
         WHERE ipl_team = $1 AND is_active = true
         ORDER BY
           CASE role WHEN 'batsman' THEN 1 WHEN 'wicket_keeper' THEN 2
                     WHEN 'all_rounder' THEN 3 WHEN 'bowler' THEN 4 ELSE 5 END,
           name`,
        [match.away_team]
      ),
      pool.query(
        `SELECT * FROM match_scores WHERE match_id = $1`,
        [match.match_id]
      ),
    ])

    const statsMap: Record<string, unknown> = {}
    for (const row of statsRes.rows) statsMap[row.player_id] = row

    return reply.send({
      match,
      homePlayers: homeRes.rows,
      awayPlayers: awayRes.rows,
      stats: statsMap,
    })
  })

  // POST /admin/matches/:matchId/stats — save player stats for a match
  app.post<{ Params: { matchId: string } }>('/admin/matches/:matchId/stats', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const statSchema = z.object({
      playerId: z.string().uuid(),
      runs: z.number().int().min(0).default(0),
      ballsFaced: z.number().int().min(0).default(0),
      fours: z.number().int().min(0).default(0),
      sixes: z.number().int().min(0).default(0),
      isOut: z.boolean().default(false),
      wickets: z.number().int().min(0).default(0),
      ballsBowled: z.number().int().min(0).default(0),
      runsConceded: z.number().int().min(0).default(0),
      maidens: z.number().int().min(0).default(0),
      catches: z.number().int().min(0).default(0),
      stumpings: z.number().int().min(0).default(0),
      runOutsDirect: z.number().int().min(0).default(0),
      runOutsIndirect: z.number().int().min(0).default(0),
    })

    const body = z.object({ playerStats: z.array(statSchema) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { rows: matchRows } = await pool.query(
      `SELECT * FROM ipl_matches WHERE id = $1`,
      [req.params.matchId]
    )
    if (matchRows.length === 0) return reply.code(404).send({ error: 'Match not found' })
    const match = matchRows[0]

    const weeks = await getAllWeeks()
    const iplWeek = getWeekForDate(new Date(match.match_date), weeks)

    const results: Array<{ playerId: string; points: number }> = []

    for (const s of body.data.playerStats) {
      const fantasyPoints = calcFantasyPoints({
        runs: s.runs,
        ballsFaced: s.ballsFaced,
        fours: s.fours,
        sixes: s.sixes,
        isOut: s.isOut,
        wickets: s.wickets,
        ballsBowled: s.ballsBowled,
        runsConceded: s.runsConceded,
        maidens: s.maidens,
        catches: s.catches,
        stumpings: s.stumpings,
        runOutsDirect: s.runOutsDirect,
        runOutsIndirect: s.runOutsIndirect,
      })

      await pool.query(
        `INSERT INTO match_scores (
           player_id, match_id, match_date, ipl_week,
           runs_scored, balls_faced, fours, sixes, is_out,
           wickets_taken, balls_bowled, runs_conceded, maidens,
           catches, stumpings, run_outs_direct, run_outs_indirect,
           fantasy_points
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (player_id, match_id) DO UPDATE SET
           ipl_week          = EXCLUDED.ipl_week,
           runs_scored       = EXCLUDED.runs_scored,
           balls_faced       = EXCLUDED.balls_faced,
           fours             = EXCLUDED.fours,
           sixes             = EXCLUDED.sixes,
           is_out            = EXCLUDED.is_out,
           wickets_taken     = EXCLUDED.wickets_taken,
           balls_bowled      = EXCLUDED.balls_bowled,
           runs_conceded     = EXCLUDED.runs_conceded,
           maidens           = EXCLUDED.maidens,
           catches           = EXCLUDED.catches,
           stumpings         = EXCLUDED.stumpings,
           run_outs_direct   = EXCLUDED.run_outs_direct,
           run_outs_indirect = EXCLUDED.run_outs_indirect,
           fantasy_points    = EXCLUDED.fantasy_points`,
        [
          s.playerId, match.match_id, match.match_date, iplWeek,
          s.runs, s.ballsFaced, s.fours, s.sixes, s.isOut,
          s.wickets, s.ballsBowled, s.runsConceded, s.maidens,
          s.catches, s.stumpings, s.runOutsDirect, s.runOutsIndirect,
          fantasyPoints,
        ]
      )

      results.push({ playerId: s.playerId, points: fantasyPoints })
    }

    // Mark match as completed
    await pool.query(
      `UPDATE ipl_matches SET is_completed = true WHERE id = $1`,
      [req.params.matchId]
    )

    return reply.send({ saved: results.length, results })
  })

  // ── Player management ──────────────────────────────────────────────────────

  // GET /admin/players?team=xxx — list players, optionally filtered by team
  app.get('/admin/players', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const query = req.query as { team?: string }
    const params: unknown[] = []
    let sql = `SELECT * FROM players`
    if (query.team) {
      params.push(query.team)
      sql += ` WHERE ipl_team = $1`
    }
    sql += ` ORDER BY
      CASE role WHEN 'batsman' THEN 1 WHEN 'wicket_keeper' THEN 2
                WHEN 'all_rounder' THEN 3 WHEN 'bowler' THEN 4 ELSE 5 END,
      name`

    const { rows } = await pool.query(sql, params)
    return reply.send({ players: rows })
  })

  // POST /admin/players — create a new player
  app.post('/admin/players', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = z.object({
      name: z.string().min(1),
      iplTeam: z.string().min(1),
      role: z.enum(['batsman', 'bowler', 'all_rounder', 'wicket_keeper']),
      basePrice: z.number().int().min(0).default(200),
      nationality: z.string().default('Indian'),
      imageUrl: z.string().url().nullable().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { rows } = await pool.query(
      `INSERT INTO players (name, ipl_team, role, base_price, nationality, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        body.data.name, body.data.iplTeam, body.data.role,
        body.data.basePrice, body.data.nationality, body.data.imageUrl ?? null,
      ]
    )
    return reply.code(201).send({ player: rows[0] })
  })

  // PATCH /admin/players/:playerId — update player fields
  app.patch<{ Params: { playerId: string } }>('/admin/players/:playerId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = z.object({
      name: z.string().min(1).optional(),
      iplTeam: z.string().min(1).optional(),
      role: z.enum(['batsman', 'bowler', 'all_rounder', 'wicket_keeper']).optional(),
      basePrice: z.number().int().min(0).optional(),
      nationality: z.string().optional(),
      imageUrl: z.string().url().nullable().optional(),
      isActive: z.boolean().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const d = body.data
    const updates: string[] = []
    const params: unknown[] = []

    const add = (col: string, val: unknown) => { params.push(val); updates.push(`${col} = $${params.length}`) }
    if (d.name !== undefined) add('name', d.name)
    if (d.iplTeam !== undefined) add('ipl_team', d.iplTeam)
    if (d.role !== undefined) add('role', d.role)
    if (d.basePrice !== undefined) add('base_price', d.basePrice)
    if (d.nationality !== undefined) add('nationality', d.nationality)
    if (d.imageUrl !== undefined) add('image_url', d.imageUrl)
    if (d.isActive !== undefined) add('is_active', d.isActive)

    if (updates.length === 0) return reply.code(400).send({ error: 'Nothing to update' })

    params.push(req.params.playerId)
    const { rows } = await pool.query(
      `UPDATE players SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    )
    if (rows.length === 0) return reply.code(404).send({ error: 'Player not found' })
    return reply.send({ player: rows[0] })
  })

  // DELETE /admin/players/:playerId — permanently delete a player
  app.delete<{ Params: { playerId: string } }>('/admin/players/:playerId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    await pool.query(`DELETE FROM players WHERE id = $1`, [req.params.playerId])
    return reply.send({ success: true })
  })

  // ── Leagues & Auctions ───────────────────────────────────────────────────

  // GET /admin/leagues — list all leagues
  app.get('/admin/leagues', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { rows } = await pool.query(`
      SELECT l.id, l.name, l.status, l.currency, l.starting_budget, l.created_at,
             COUNT(lm.id)::int AS member_count
      FROM leagues l
      LEFT JOIN league_members lm ON lm.league_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `)

    const liveLeagueIds = new Set(getAllRooms().map(r => r.leagueId))
    return reply.send({ leagues: rows.map(r => ({ ...r, is_live: liveLeagueIds.has(r.id) })) })
  })

  // GET /admin/leagues/:id — league detail: members + rosters
  app.get<{ Params: { id: string } }>('/admin/leagues/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const { id } = req.params

    const [leagueRes, membersRes, rostersRes] = await Promise.all([
      pool.query(`SELECT * FROM leagues WHERE id = $1`, [id]),
      pool.query(`
        SELECT lm.user_id, lm.remaining_budget, lm.roster_count,
               p.username, p.display_name
        FROM league_members lm
        JOIN profiles p ON p.id = lm.user_id
        WHERE lm.league_id = $1
        ORDER BY lm.remaining_budget DESC
      `, [id]),
      pool.query(`
        SELECT tr.user_id, tr.price_paid,
               pl.id AS player_id, pl.name, pl.role, pl.ipl_team, pl.nationality
        FROM team_rosters tr
        JOIN players pl ON pl.id = tr.player_id
        WHERE tr.league_id = $1
        ORDER BY
          CASE pl.role WHEN 'batsman' THEN 1 WHEN 'wicket_keeper' THEN 2
                       WHEN 'all_rounder' THEN 3 WHEN 'bowler' THEN 4 ELSE 5 END,
          pl.name
      `, [id]),
    ])

    if (leagueRes.rows.length === 0) return reply.code(404).send({ error: 'League not found' })

    return reply.send({
      league: leagueRes.rows[0],
      members: membersRes.rows,
      rosters: rostersRes.rows,
    })
  })

  // GET /admin/leagues/:id/live — in-memory auction room state
  app.get<{ Params: { id: string } }>('/admin/leagues/:id/live', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const room = getRoom(req.params.id)
    if (!room) return reply.send({ live: false })

    return reply.send({
      live: true,
      status: room.status,
      currentPlayer: room.currentPlayer,
      currentBid: room.currentBid,
      currentBidderId: room.currentBidderId,
      timerExpiresAt: room.timerExpiresAt,
      awaitingConfirmation: room.awaitingConfirmation,
      queueRemaining: room.queueRemaining,
      members: getMemberStates(room),
    })
  })
}
