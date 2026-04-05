import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
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

  // PATCH /admin/matches/:matchId — update match fields (week_num, venue, match_date)
  app.patch<{ Params: { matchId: string } }>('/admin/matches/:matchId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = z.object({
      venue: z.string().nullable().optional(),
      matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      startTimeUtc: z.string().optional(),
      status: z.enum(['pending', 'live', 'completed']).optional(),
      scorecardUrl: z.string().nullable().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if ('venue' in body.data) { updates.push(`venue = $${idx++}`); values.push(body.data.venue) }
    if (body.data.matchDate !== undefined) { updates.push(`match_date = $${idx++}`); values.push(body.data.matchDate) }
    if (body.data.startTimeUtc !== undefined) { updates.push(`start_time_utc = $${idx++}`); values.push(body.data.startTimeUtc) }
    if (body.data.status !== undefined) { updates.push(`status = $${idx++}`); values.push(body.data.status) }
    if ('scorecardUrl' in body.data) { updates.push(`scorecard_url = $${idx++}`); values.push(body.data.scorecardUrl) }

    if (updates.length === 0) return reply.code(400).send({ error: 'No fields to update' })

    // Enforce only one live match at a time
    if (body.data.status === 'live') {
      await pool.query(`UPDATE ipl_matches SET status = 'pending' WHERE status = 'live' AND id != $1`, [req.params.matchId])
      // Sync system_settings so resolveCurrentMatchAndWeek picks up the new live match
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('current_match', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [req.params.matchId]
      )
    } else if (body.data.status === 'pending' || body.data.status === 'completed') {
      // Clear system_settings if it was pointing to this match
      await pool.query(
        `UPDATE system_settings SET value = '', updated_at = NOW()
         WHERE key = 'current_match' AND value = $1`,
        [req.params.matchId]
      )
    }

    values.push(req.params.matchId)
    const { rows } = await pool.query(
      `UPDATE ipl_matches SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )
    if (rows.length === 0) return reply.code(404).send({ error: 'Match not found' })
    return reply.send({ match: rows[0] })
  })

  // PATCH /admin/weeks/:weekNum — update week details + auto-assign matches by window
  app.patch<{ Params: { weekNum: string } }>('/admin/weeks/:weekNum', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = z.object({
      label: z.string().optional(),
      windowStart: z.string().optional(),
      windowEnd: z.string().optional(),
      lockTime: z.string().optional(),
      weekType: z.enum(['regular', 'playoff', 'finals']).optional(),
      status: z.enum(['pending', 'live', 'completed']).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const weekNumInt = parseInt(req.params.weekNum, 10)
    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (body.data.label !== undefined) { updates.push(`label = $${idx++}`); values.push(body.data.label) }
    if (body.data.windowStart !== undefined) { updates.push(`window_start = $${idx++}`); values.push(body.data.windowStart) }
    if (body.data.windowEnd !== undefined) { updates.push(`window_end = $${idx++}`); values.push(body.data.windowEnd) }
    if (body.data.lockTime !== undefined) { updates.push(`lock_time = $${idx++}`); values.push(body.data.lockTime) }
    if (body.data.weekType !== undefined) {
      updates.push(`week_type = $${idx++}`)
      values.push(body.data.weekType)
      updates.push(`is_playoff = $${idx++}`)
      values.push(body.data.weekType !== 'regular')
    }
    if (body.data.status !== undefined) { updates.push(`status = $${idx++}`); values.push(body.data.status) }

    if (updates.length === 0) return reply.code(400).send({ error: 'No fields to update' })

    // Enforce only one live week at a time + sync system_settings
    if (body.data.status === 'live') {
      await pool.query(`UPDATE ipl_weeks SET status = 'pending' WHERE status = 'live' AND week_num != $1`, [weekNumInt])
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('current_week', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [String(weekNumInt)]
      )
    } else if (body.data.status === 'pending' || body.data.status === 'completed') {
      await pool.query(
        `UPDATE system_settings SET value = '', updated_at = NOW()
         WHERE key = 'current_week' AND value = $1`,
        [String(weekNumInt)]
      )
    }

    values.push(weekNumInt)
    const { rows } = await pool.query(
      `UPDATE ipl_weeks SET ${updates.join(', ')} WHERE week_num = $${idx} RETURNING *`,
      values
    )
    if (rows.length === 0) return reply.code(404).send({ error: 'Week not found' })

    const week = rows[0]

    // Auto-assign matches whose start_time_utc falls within the window
    let assignedCount = 0
    if (week.window_start && week.window_end) {
      const result = await pool.query(
        `UPDATE ipl_matches
         SET week_num = $1
         WHERE start_time_utc >= $2 AND start_time_utc <= $3`,
        [weekNumInt, week.window_start, week.window_end]
      )
      assignedCount = result.rowCount ?? 0
    }

    return reply.send({ week, assignedCount })
  })

  // DELETE /admin/weeks/:weekNum — delete a week (nullifies week_num on any assigned matches)
  app.delete<{ Params: { weekNum: string } }>('/admin/weeks/:weekNum', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const weekNumInt = parseInt(req.params.weekNum, 10)
    // Unassign matches that belong to this week
    await pool.query(`UPDATE ipl_matches SET week_num = NULL WHERE week_num = $1`, [weekNumInt])
    const { rowCount } = await pool.query(`DELETE FROM ipl_weeks WHERE week_num = $1`, [weekNumInt])
    if (rowCount === 0) return reply.code(404).send({ error: 'Week not found' })
    return reply.send({ success: true })
  })

  // GET /admin/leagues/:leagueId/matchups — all matchups grouped by week
  app.get<{ Params: { leagueId: string } }>('/admin/leagues/:leagueId/matchups', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { rows } = await pool.query(
      `SELECT wm.*,
              ph.full_name AS home_full_name, ph.username AS home_username,
              pa.full_name AS away_full_name, pa.username AS away_username
       FROM weekly_matchups wm
       JOIN profiles ph ON ph.id = wm.home_user
       JOIN profiles pa ON pa.id = wm.away_user
       WHERE wm.league_id = $1
       ORDER BY wm.week_num, wm.id`,
      [req.params.leagueId]
    )
    return reply.send({ matchups: rows })
  })

  // PATCH /admin/matchups/:matchupId — edit home_user / away_user
  app.patch<{ Params: { matchupId: string } }>('/admin/matchups/:matchupId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = z.object({
      homeUserId: z.string().uuid().optional(),
      awayUserId: z.string().uuid().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (body.data.homeUserId) { updates.push(`home_user = $${idx++}`); values.push(body.data.homeUserId) }
    if (body.data.awayUserId) { updates.push(`away_user = $${idx++}`); values.push(body.data.awayUserId) }
    if (updates.length === 0) return reply.code(400).send({ error: 'No fields to update' })

    values.push(req.params.matchupId)
    const { rows } = await pool.query(
      `UPDATE weekly_matchups SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING *,
         (SELECT full_name FROM profiles WHERE id = home_user) AS home_full_name,
         (SELECT username FROM profiles WHERE id = home_user) AS home_username,
         (SELECT full_name FROM profiles WHERE id = away_user) AS away_full_name,
         (SELECT username FROM profiles WHERE id = away_user) AS away_username`,
      values
    )
    if (rows.length === 0) return reply.code(404).send({ error: 'Matchup not found' })
    return reply.send({ matchup: rows[0] })
  })

  // POST /admin/leagues/:leagueId/matchups/regenerate — wipe and regenerate from scratch
  app.post<{ Params: { leagueId: string } }>('/admin/leagues/:leagueId/matchups/regenerate', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    await pool.query(`SELECT generate_schedule($1)`, [req.params.leagueId])
    const { rows } = await pool.query(
      `SELECT wm.*,
              ph.full_name AS home_full_name, ph.username AS home_username,
              pa.full_name AS away_full_name, pa.username AS away_username
       FROM weekly_matchups wm
       JOIN profiles ph ON ph.id = wm.home_user
       JOIN profiles pa ON pa.id = wm.away_user
       WHERE wm.league_id = $1
       ORDER BY wm.week_num, wm.id`,
      [req.params.leagueId]
    )
    return reply.send({ matchups: rows })
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

  // DELETE /admin/matches/:matchId/stats — clear all stat entries for a match
  app.delete<{ Params: { matchId: string } }>('/admin/matches/:matchId/stats', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const { rows } = await pool.query(
      `SELECT match_id FROM ipl_matches WHERE id = $1`,
      [req.params.matchId]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Match not found' })

    await pool.query(`DELETE FROM match_scores WHERE match_id = $1`, [rows[0].match_id])
    await pool.query(
      `UPDATE ipl_matches SET is_completed = false WHERE id = $1`,
      [req.params.matchId]
    )

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
      lbwBowledWickets: z.number().int().min(0).default(0),
      catches: z.number().int().min(0).default(0),
      stumpings: z.number().int().min(0).default(0),
      runOutsDirect: z.number().int().min(0).default(0),
      runOutsIndirect: z.number().int().min(0).default(0),
      dismissalText: z.string().default(''),
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

    // Bulk-fetch player roles so scoring can apply SR bonus correctly
    const playerIds = body.data.playerStats.map(s => s.playerId)
    const { rows: playerRoleRows } = await pool.query(
      `SELECT id, role FROM players WHERE id = ANY($1)`,
      [playerIds]
    )
    const roleMap = new Map<string, string>(playerRoleRows.map((r: { id: string; role: string }) => [r.id, r.role]))

    const results: Array<{ playerId: string; points: number }> = []

    for (const s of body.data.playerStats) {
      const fantasyPoints = calcFantasyPoints({
        role: roleMap.get(s.playerId) ?? 'batsman',
        runs: s.runs,
        ballsFaced: s.ballsFaced,
        fours: s.fours,
        sixes: s.sixes,
        isOut: s.isOut,
        wickets: s.wickets,
        ballsBowled: s.ballsBowled,
        runsConceded: s.runsConceded,
        maidens: s.maidens,
        lbwBowledWickets: s.lbwBowledWickets,
        catches: s.catches,
        stumpings: s.stumpings,
        runOutsDirect: s.runOutsDirect,
        runOutsIndirect: s.runOutsIndirect,
      })

      await pool.query(
        `INSERT INTO match_scores (
           player_id, match_id, match_date, ipl_week,
           runs_scored, balls_faced, fours, sixes, is_out,
           wickets_taken, balls_bowled, runs_conceded, maidens, lbw_bowled_wickets,
           catches, stumpings, run_outs_direct, run_outs_indirect,
           fantasy_points, dismissal_text
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (player_id, match_id) DO UPDATE SET
           ipl_week             = EXCLUDED.ipl_week,
           runs_scored          = EXCLUDED.runs_scored,
           balls_faced          = EXCLUDED.balls_faced,
           fours                = EXCLUDED.fours,
           sixes                = EXCLUDED.sixes,
           is_out               = EXCLUDED.is_out,
           wickets_taken        = EXCLUDED.wickets_taken,
           balls_bowled         = EXCLUDED.balls_bowled,
           runs_conceded        = EXCLUDED.runs_conceded,
           maidens              = EXCLUDED.maidens,
           lbw_bowled_wickets   = EXCLUDED.lbw_bowled_wickets,
           catches              = EXCLUDED.catches,
           stumpings            = EXCLUDED.stumpings,
           run_outs_direct      = EXCLUDED.run_outs_direct,
           run_outs_indirect    = EXCLUDED.run_outs_indirect,
           fantasy_points       = EXCLUDED.fantasy_points,
           dismissal_text       = EXCLUDED.dismissal_text`,
        [
          s.playerId, match.match_id, match.match_date, iplWeek,
          s.runs, s.ballsFaced, s.fours, s.sixes, s.isOut,
          s.wickets, s.ballsBowled, s.runsConceded, s.maidens, s.lbwBowledWickets,
          s.catches, s.stumpings, s.runOutsDirect, s.runOutsIndirect,
          fantasyPoints, s.dismissalText || null,
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

  // POST /admin/matches/:matchId/import-scorecard — scrape a scorecard URL and parse stats with Claude
  app.post<{ Params: { matchId: string } }>('/admin/matches/:matchId/import-scorecard', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = z.object({ url: z.string().url() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid URL' })

    // Fetch the raw HTML
    let html: string
    try {
      const res = await fetch(body.data.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return reply.code(400).send({ error: `Failed to fetch URL: HTTP ${res.status}` })
      html = await res.text()
    } catch (e: unknown) {
      return reply.code(400).send({ error: `Failed to fetch URL: ${e instanceof Error ? e.message : 'Unknown error'}` })
    }

    // Single-pass table row extraction
    const scorecardText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/t[dh]>/gi, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&#?\w+;/g, ' ')
      .split('\n')
      .map(line => line.split('\t').map(c => c.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '))
      .filter(line => line.includes('|') && line.replace(/[|\s]/g, '').length > 3)
      .join('\n')

    // Get all active players for matching
    const { rows: players } = await pool.query(
      `SELECT id, name, ipl_team FROM players WHERE is_active = true ORDER BY name`
    )
    const playerList = (players as Array<{ id: string; name: string; ipl_team: string }>)
      .map(p => `${p.id}: ${p.name} (${p.ipl_team})`)
      .join('\n')

    // Call Claude to parse the scorecard
    const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })

    const itemSchema = {
      type: 'object',
      properties: {
        playerId:        { type: 'string' },
        scorecardName:   { type: 'string' },
        runs:            { type: 'integer' },
        ballsFaced:      { type: 'integer' },
        fours:           { type: 'integer' },
        sixes:           { type: 'integer' },
        isOut:           { type: 'boolean' },
        wickets:            { type: 'integer' },
        ballsBowled:        { type: 'integer' },
        runsConceded:       { type: 'integer' },
        maidens:            { type: 'integer' },
        lbwBowledWickets:   { type: 'integer' },
        catches:            { type: 'integer' },
        stumpings:       { type: 'integer' },
        runOutsDirect:   { type: 'integer' },
        runOutsIndirect: { type: 'integer' },
        dismissalText:   { type: 'string' },
      },
      required: ['playerId','scorecardName','runs','ballsFaced','fours','sixes','isOut',
                 'wickets','ballsBowled','runsConceded','maidens','lbwBowledWickets',
                 'catches','stumpings','runOutsDirect','runOutsIndirect','dismissalText'],
      additionalProperties: false,
    }

    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: { type: 'object', properties: { matched: { type: 'array', items: itemSchema }, unmatched: { type: 'array', items: { type: 'string' } } }, required: ['matched','unmatched'], additionalProperties: false } } },
      messages: [{
        role: 'user',
        content: `Parse this cricket scorecard and match players to our database.

SCORECARD:
${scorecardText}

OUR PLAYER DATABASE (UUID: Name (Team)):
${playerList}

INSTRUCTIONS:
- Batting table format: Name | Dismissal | Runs | Balls | Minutes | 4s | 6s | SR
- Bowling table format: Name | Overs | Maidens | Runs | Wickets | Economy | Dots | Wides | NoBalls
- isOut = false ONLY if dismissal is "not out" or "retired not out"
- ballsBowled: convert overs to balls (e.g. 4 overs=24, 2.4 overs=16, 3.0 overs=18)
- catches: scan batting dismissals for "c NAME b BOWLER" — count times each player appears as the catcher
- stumpings: scan for "st NAME b BOWLER" — count times each player appears as the keeper
- runOutsDirect/runOutsIndirect: 0 unless a run out explicitly credits a specific fielder
- lbwBowledWickets: for each bowler, count their wickets where the dismissal mode is "lbw" or "bowled"
- dismissalText: for each BATSMAN, copy the exact dismissal text from the scorecard (e.g. "c Dhoni b Bumrah", "lbw b Shami", "run out (Kohli)", "not out", "bowled Bumrah"). Leave empty string "" for non-batsmen/did-not-bat.
- For fielding attribution from dismissalText: "c NAME b BOWLER" → catcher gets +1 catch; "st NAME b BOWLER" → keeper gets +1 stumping; "run out (NAME)" → direct RO for the named fielder (runOutsDirect); "run out (NAME1/NAME2)" → both get indirect RO (runOutsIndirect). Apply these to the correct players.
- Match names with fuzzy matching; ignore "(c)", "†", abbreviated prefixes
- Only include players present in both scorecard and database
- Put unmatched scorecard names in "unmatched"`,
      }],
    })

    const textBlock = aiResponse.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return reply.code(500).send({ error: 'Claude did not return a text response' })
    }
    let parsed: { matched: unknown[]; unmatched: string[] }
    try {
      parsed = JSON.parse(textBlock.text)
    } catch {
      return reply.code(500).send({ error: 'Claude returned invalid JSON' })
    }

    return reply.send({ stats: parsed.matched, unmatched: parsed.unmatched })
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
