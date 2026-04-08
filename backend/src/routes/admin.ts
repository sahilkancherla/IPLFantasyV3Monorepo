import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { pool } from '../db/client.js'
import { config } from '../config.js'
import { calcFantasyPoints, getWeekForDate } from '../services/scoring.service.js'
import { getAllWeeks } from '../services/schedule.service.js'
import { getRoom, getMemberStates, getAllRooms } from '../services/auction.service.js'
import { getLineup, validateLineup, setLineup } from '../db/queries/lineups.js'

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
      status: z.enum(['pending', 'upcoming', 'live', 'completed']).optional(),
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

    // Enforce only one live/upcoming match at a time
    if (body.data.status === 'live' || body.data.status === 'upcoming') {
      // Demote any other live/upcoming match back to pending
      await pool.query(
        `UPDATE ipl_matches SET status = 'pending'
         WHERE status IN ('live', 'upcoming') AND id != $1`,
        [req.params.matchId]
      )
      // Sync system_settings so resolveCurrentMatchAndWeek picks up this match
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
      status: z.enum(['pending', 'upcoming', 'live', 'completed']).optional(),
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
      isInXI: z.boolean().default(true),
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
        isInXI: s.isInXI,
      })

      await pool.query(
        `INSERT INTO match_scores (
           player_id, match_id, match_date, ipl_week,
           runs_scored, balls_faced, fours, sixes, is_out,
           wickets_taken, balls_bowled, runs_conceded, maidens, lbw_bowled_wickets,
           catches, stumpings, run_outs_direct, run_outs_indirect,
           fantasy_points, dismissal_text, is_in_xi
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
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
           dismissal_text       = EXCLUDED.dismissal_text,
           is_in_xi             = EXCLUDED.is_in_xi`,
        [
          s.playerId, match.match_id, match.match_date, iplWeek,
          s.runs, s.ballsFaced, s.fours, s.sixes, s.isOut,
          s.wickets, s.ballsBowled, s.runsConceded, s.maidens, s.lbwBowledWickets,
          s.catches, s.stumpings, s.runOutsDirect, s.runOutsIndirect,
          fantasyPoints, s.dismissalText || null, s.isInXI,
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

    // ── Shared types and helpers ─────────────────────────────────────────────
    interface ParsedBatter {
      scorecardName: string; dismissalText: string
      runs: number; ballsFaced: number; fours: number; sixes: number; isOut: boolean
    }
    interface ParsedBowler {
      scorecardName: string
      ballsBowled: number; maidens: number; runsConceded: number; wickets: number
    }
    function parseOvers(s: string): number | null {
      const m = String(s).match(/^(\d+)(?:\.([0-5]))?$/)
      if (!m) return null
      return parseInt(m[1]) * 6 + (m[2] ? parseInt(m[2]) : 0)
    }
    // Remove wicket-keeper/captain markers and parentheticals like (wk), (c), (c & wk)
    function cleanName(n: string): string {
      return n.replace(/\([^)]*\)/g, '').replace(/[†*]/g, '').replace(/\s+/g, ' ').trim()
    }
    function isNotOut(dismissal: string): boolean {
      return /^(not\s+out|did\s+not\s+bat|retired\s+(not\s+out|hurt)|absent|dnb)/i.test(dismissal.trim())
    }

    const batters: ParsedBatter[] = []
    const bowlers: ParsedBowler[] = []
    const url = body.data.url

    // ── Fetch scorecard HTML ──────────────────────────────────────────────────
    // Cricbuzz is a React SPA — the root page has no scorecard data, but the
    // /scorecard sub-path returns full server-rendered HTML with the grid divs.
    // Normalise any Cricbuzz URL to always end with /scorecard.
    function normaliseScorecardUrl(rawUrl: string): string {
      const m = rawUrl.match(/(cricbuzz\.com\/(?:live-cricket-scorecard|live-cricket-scores|cricket-match-facts)\/\d+)/)
      if (m) return `https://www.${m[1].replace('live-cricket-scores', 'live-cricket-scorecard')}/scorecard`
      return rawUrl
    }
    const fetchUrl = normaliseScorecardUrl(url)

    let html: string
    try {
      const res = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return reply.code(400).send({ error: `Failed to fetch scorecard: HTTP ${res.status}` })
      html = await res.text()
    } catch (e: unknown) {
      return reply.code(400).send({ error: `Failed to fetch scorecard: ${e instanceof Error ? e.message : String(e)}` })
    }

    // ── Helper: strip HTML tags and decode entities ───────────────────────────
    function stripTags(s: string): string {
      return s.replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim()
    }

    // ── Strategy 1: Cricbuzz CSS-grid divs (scorecard-bat-grid / scorecard-bowl-grid) ──
    // Each batter row: <div class="grid scorecard-bat-grid ...">
    //   <div class="flex flex-col ..."><a href="/profiles/ID/slug">Name</a><div>dismissal</div></div>
    //   <div class="flex justify-center ...">R</div>  <div>B</div>  <div>4s</div>  <div>6s</div>
    // Each bowler row: <div class="grid scorecard-bowl-grid ...">
    //   <a href="/profiles/ID/slug">Name</a>
    //   <div class="flex justify-center ...">overs</div> maidens runs wickets ...
    if (html.includes('scorecard-bat-grid')) {
      const seenBat  = new Set<string>()
      const seenBowl = new Set<string>()

      // ── Batting ──
      const batSections = html.split('<div class="grid scorecard-bat-grid')
      for (const sec of batSections.slice(1)) {
        const nameM = sec.match(/<a[^>]+\/profiles\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/)
        if (!nameM) continue
        const profileId = nameM[1]
        const name = cleanName(nameM[2])
        if (!name || /^(Batter|Extras|Total|Fall of Wickets|Did not bat)$/i.test(name)) continue

        const dismissalM = sec.match(/<\/a><div[^>]*>([\s\S]*?)<\/div>/)
        const dismissal = dismissalM ? stripTags(dismissalM[1]) || 'not out' : 'not out'

        const nums = [...sec.matchAll(/<div class="flex justify-center[^"]*">(\d+(?:\.\d+)?)<\/div>/g)]
          .map(m => m[1])
        if (nums.length < 4) continue

        const key = `${profileId}-${nums[0]}-${nums[1]}`
        if (seenBat.has(key)) continue
        seenBat.add(key)

        batters.push({
          scorecardName: name,
          dismissalText: dismissal,
          runs:       parseInt(nums[0]),
          ballsFaced: parseInt(nums[1]),
          fours:      parseInt(nums[2]),
          sixes:      parseInt(nums[3]),
          isOut:      !isNotOut(dismissal),
        })
      }

      // ── Bowling ──
      const bowlSections = html.split('<div class="grid scorecard-bowl-grid')
      for (const sec of bowlSections.slice(1)) {
        const nameM = sec.match(/<a[^>]+\/profiles\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/)
        if (!nameM) continue
        const profileId = nameM[1]
        const name = cleanName(nameM[2])
        if (!name || /^Bowler$/i.test(name)) continue

        const nums = [...sec.matchAll(/<div class="[^"]*(?:justify-center|items-center)[^"]*">(\d+(?:\.\d+)?)<\/div>/g)]
          .map(m => m[1])
        if (nums.length < 4) continue

        const key = `${profileId}-${nums[2]}-${nums[3]}`
        if (seenBowl.has(key)) continue
        seenBowl.add(key)

        bowlers.push({
          scorecardName: name,
          ballsBowled:  parseOvers(nums[0]) ?? 0,
          maidens:      parseInt(nums[1]),
          runsConceded: parseInt(nums[2]),
          wickets:      parseInt(nums[3]),
        })
      }

      console.log('[import-scorecard] Cricbuzz grid parse:', { batters: batters.length, bowlers: bowlers.length })
    }

    // ── Strategy 2: HTML table parsing (generic fallback for other sites) ─────
    if (batters.length === 0 && bowlers.length === 0) {
      const DISMISSAL_RE = /^(c\s|c\s*&|lbw|not\s+out|did\s+not\s+bat|run\s+out|b\s|st\s|retired|absent)/i
      const rows: string[][] = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\/tr>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#?\w+;/g, ' ')
        .split('\n')
        .map(line => line.split('\t').map(c => c.replace(/\s+/g, ' ').trim()).filter(Boolean))
        .filter(cols => cols.length >= 4)

      for (const cols of rows) {
        if (cols.length >= 6 && DISMISSAL_RE.test(cols[1]) && /^\d+$/.test(cols[2])) {
          const dismissal = cols[1].replace(/\s+/g, ' ').trim()
          batters.push({
            scorecardName: cleanName(cols[0]),
            dismissalText: dismissal,
            runs: parseInt(cols[2]) || 0, ballsFaced: parseInt(cols[3]) || 0,
            fours: parseInt(cols[4]) || 0, sixes: parseInt(cols[5]) || 0,
            isOut: !isNotOut(dismissal),
          })
          continue
        }
        if (cols.length >= 5) {
          const balls = parseOvers(cols[1])
          if (balls !== null && /^\d+$/.test(cols[2]) && /^\d+$/.test(cols[3]) && /^\d+$/.test(cols[4])) {
            bowlers.push({
              scorecardName: cleanName(cols[0]),
              ballsBowled: balls, maidens: parseInt(cols[2]),
              runsConceded: parseInt(cols[3]), wickets: parseInt(cols[4]),
            })
          }
        }
      }
    }

    if (batters.length === 0 && bowlers.length === 0) {
      console.error('[import-scorecard] extraction failed', { fetchUrl, htmlLen: html.length, hasBatGrid: html.includes('scorecard-bat-grid') })
      return reply.code(422).send({ error: 'Could not extract batting or bowling data from the page.' })
    }

    // ── Parse dismissal texts into structured events (server-side, no AI) ─────
    interface DismissalInfo {
      batterName: string
      type: 'caught' | 'caught_and_bowled' | 'bowled' | 'lbw' | 'stumped' | 'runout_direct' | 'runout_indirect' | 'not_out' | 'did_not_bat' | 'other'
      fielder1Name: string | null
      fielder2Name: string | null
      lbwBowledBowlerName: string | null
    }
    function parseDismissal(batterName: string, t: string): DismissalInfo {
      if (/^(not\s+out|retired\s+(not\s+out|hurt)|absent)/i.test(t))
        return { batterName, type: 'not_out', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: null }
      if (/^did\s+not\s+bat/i.test(t))
        return { batterName, type: 'did_not_bat', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: null }
      const cAndB = t.match(/^c\s*&\s*b\s+(.+)$/i)
      if (cAndB) return { batterName, type: 'caught_and_bowled', fielder1Name: cAndB[1].trim(), fielder2Name: null, lbwBowledBowlerName: null }
      const caught = t.match(/^c\s+(.+?)\s+b\s+\S/i)
      if (caught) return { batterName, type: 'caught', fielder1Name: caught[1].trim(), fielder2Name: null, lbwBowledBowlerName: null }
      const lbw = t.match(/^lbw\s+b\s+(.+)$/i)
      if (lbw) return { batterName, type: 'lbw', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: lbw[1].trim() }
      const bowledOut = t.match(/^b\s+(.+)$/i)
      if (bowledOut) return { batterName, type: 'bowled', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: bowledOut[1].trim() }
      const stumped = t.match(/^st\s+[†]?\s*(.+?)\s+b\s+/i)
      if (stumped) return { batterName, type: 'stumped', fielder1Name: stumped[1].trim(), fielder2Name: null, lbwBowledBowlerName: null }
      const runoutTwo = t.match(/run\s+out\s*\(\s*([^/)]+?)\s*\/\s*([^)]+?)\s*\)/i)
      if (runoutTwo) return { batterName, type: 'runout_indirect', fielder1Name: runoutTwo[1].trim(), fielder2Name: runoutTwo[2].trim(), lbwBowledBowlerName: null }
      const runoutOne = t.match(/run\s+out\s*\(\s*([^)]+?)\s*\)/i)
      if (runoutOne) return { batterName, type: 'runout_direct', fielder1Name: runoutOne[1].trim(), fielder2Name: null, lbwBowledBowlerName: null }
      return { batterName, type: 'other', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: null }
    }

    const dismissals: DismissalInfo[] = batters.map(b => parseDismissal(b.scorecardName, b.dismissalText))

    // ── Fetch players for the two teams in this match ─────────────────────────
    const { rows: matchRows } = await pool.query<{ home_team: string; away_team: string }>(
      `SELECT home_team, away_team FROM ipl_matches WHERE id = $1`,
      [req.params.matchId]
    )
    const matchTeams = matchRows[0] ? [matchRows[0].home_team, matchRows[0].away_team] : []
    const { rows: playerRows } = await pool.query<{ id: string; name: string; ipl_team: string }>(
      matchTeams.length === 2
        ? `SELECT id, name, ipl_team FROM players WHERE is_active = true AND ipl_team = ANY($1) ORDER BY ipl_team, name`
        : `SELECT id, name, ipl_team FROM players WHERE is_active = true ORDER BY ipl_team, name`,
      matchTeams.length === 2 ? [matchTeams] : []
    )

    // ── Deterministic name matcher (no AI) ────────────────────────────────────
    // Handles: exact, surname-only, abbreviated first name ("V Kohli"), fuzzy spelling.
    function normName(s: string): string {
      return s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
    }
    // Character bigram Dice coefficient — handles spelling variations
    function bigramSim(a: string, b: string): number {
      const bg = (s: string) => {
        const set = new Set<string>()
        const t = s.replace(/\s/g, '')
        for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2))
        return set
      }
      const ba = bg(a); const bb = bg(b)
      let inter = 0
      for (const g of ba) if (bb.has(g)) inter++
      return ba.size + bb.size === 0 ? 0 : (2 * inter) / (ba.size + bb.size)
    }
    function matchPlayerName(scorecardName: string): string | null {
      const sc = normName(scorecardName)
      const scToks = sc.split(' ')
      const scLast = scToks[scToks.length - 1]

      // 1. Exact
      for (const p of playerRows) {
        if (normName(p.name) === sc) return p.id
      }

      // 2. Last name + first initial(s) — handles "V Kohli", "AM Ghazanfar"
      const surnameMatches = playerRows.filter(p => {
        const dbToks = normName(p.name).split(' ')
        return dbToks[dbToks.length - 1] === scLast
      })
      if (surnameMatches.length === 1) return surnameMatches[0].id
      if (surnameMatches.length > 1 && scToks.length > 1) {
        // Use first initial(s) to disambiguate
        for (const p of surnameMatches) {
          const dbToks = normName(p.name).split(' ')
          // All scorecard non-surname tokens must match as initials or full tokens of DB name
          const allMatch = scToks.slice(0, -1).every((scTok, i) =>
            dbToks[i]?.[0] === scTok[0]
          )
          if (allMatch) return p.id
        }
      }

      // 3. Fuzzy bigram similarity — handles minor spelling differences
      let bestScore = 0
      let bestId: string | null = null
      for (const p of playerRows) {
        const score = bigramSim(sc, normName(p.name))
        if (score > bestScore) { bestScore = score; bestId = p.id }
      }
      if (bestScore >= 0.6) return bestId

      return null
    }

    // Match every name that appears in batting, bowling, or dismissal texts
    const allNames = new Set<string>()
    for (const b of batters) allNames.add(b.scorecardName)
    for (const b of bowlers) allNames.add(b.scorecardName)
    for (const d of dismissals) {
      if (d.fielder1Name)        allNames.add(d.fielder1Name)
      if (d.fielder2Name)        allNames.add(d.fielder2Name)
      if (d.lbwBowledBowlerName) allNames.add(d.lbwBowledBowlerName)
    }

    const nameToUUID = new Map<string, string>()
    const unmatched: string[] = []
    for (const name of allNames) {
      const id = matchPlayerName(name)
      if (id) nameToUUID.set(name.toLowerCase().trim(), id)
      else unmatched.push(name)
    }
    if (unmatched.length > 0) console.warn('[import-scorecard] unmatched names:', unmatched)

    const lookup = (name: string | null): string | null => {
      if (!name) return null
      return nameToUUID.get(name.toLowerCase().trim()) ?? null
    }

    // ── Count fielding credits from parsed dismissals ─────────────────────────
    const catches       = new Map<string, number>()
    const stumpings     = new Map<string, number>()
    const runOutsDirect = new Map<string, number>()
    const runOutsIndir  = new Map<string, number>()
    const lbwBowledMap  = new Map<string, number>()

    for (const d of dismissals) {
      const f1 = lookup(d.fielder1Name)
      const f2 = lookup(d.fielder2Name)
      if (d.type === 'caught' || d.type === 'caught_and_bowled') {
        if (f1) catches.set(f1, (catches.get(f1) ?? 0) + 1)
      } else if (d.type === 'stumped') {
        if (f1) stumpings.set(f1, (stumpings.get(f1) ?? 0) + 1)
      } else if (d.type === 'runout_direct') {
        if (f1) runOutsDirect.set(f1, (runOutsDirect.get(f1) ?? 0) + 1)
      } else if (d.type === 'runout_indirect') {
        if (f1) runOutsIndir.set(f1, (runOutsIndir.get(f1) ?? 0) + 1)
        if (f2) runOutsIndir.set(f2, (runOutsIndir.get(f2) ?? 0) + 1)
      }
      if (d.lbwBowledBowlerName) {
        const id = lookup(d.lbwBowledBowlerName)
        if (id) lbwBowledMap.set(id, (lbwBowledMap.get(id) ?? 0) + 1)
      }
    }

    // ── Merge batting + bowling into per-player stat rows ─────────────────────
    const statsMap = new Map<string, Record<string, unknown>>()

    for (const batter of batters) {
      const id = lookup(batter.scorecardName)
      if (!id) continue
      const existing = statsMap.get(id) ?? {}
      statsMap.set(id, {
        ...existing,
        playerId: id, scorecardName: batter.scorecardName, isInXI: true,
        runs: batter.runs, ballsFaced: batter.ballsFaced,
        fours: batter.fours, sixes: batter.sixes,
        isOut: batter.isOut, dismissalText: batter.dismissalText,
        wickets:          (existing.wickets          as number) ?? 0,
        ballsBowled:      (existing.ballsBowled      as number) ?? 0,
        runsConceded:     (existing.runsConceded     as number) ?? 0,
        maidens:          (existing.maidens          as number) ?? 0,
        lbwBowledWickets: (existing.lbwBowledWickets as number) ?? 0,
      })
    }

    for (const bowler of bowlers) {
      const id = lookup(bowler.scorecardName)
      if (!id) continue
      const existing = statsMap.get(id) ?? {
        playerId: id, scorecardName: bowler.scorecardName, isInXI: true,
        runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false, dismissalText: '',
      }
      statsMap.set(id, {
        ...existing,
        wickets:          bowler.wickets,
        ballsBowled:      bowler.ballsBowled,
        runsConceded:     bowler.runsConceded,
        maidens:          bowler.maidens,
        lbwBowledWickets: lbwBowledMap.get(id) ?? 0,
      })
    }

    // Apply fielding credits
    const finalStats = [...statsMap.values()].map(s => ({
      ...s,
      catches:         catches.get(s.playerId as string)       ?? 0,
      stumpings:       stumpings.get(s.playerId as string)     ?? 0,
      runOutsDirect:   runOutsDirect.get(s.playerId as string) ?? 0,
      runOutsIndirect: runOutsIndir.get(s.playerId as string)  ?? 0,
    }))

    console.log('[import-scorecard] done:', { matched: finalStats.length, unmatched: unmatched.length })
    return reply.send({ matched: finalStats, unmatched })
  })

  // GET /admin/leagues/:leagueId/lineups/:userId — fetch a user's lineup for a week
  app.get<{ Params: { leagueId: string; userId: string }; Querystring: { week?: string } }>(
    '/admin/leagues/:leagueId/lineups/:userId',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return
      const { leagueId, userId } = req.params
      const weekNum = parseInt(req.query.week ?? '', 10)
      if (isNaN(weekNum)) return reply.code(400).send({ error: 'week query param required' })
      const lineup = await getLineup(leagueId, userId, weekNum)
      return reply.send({ lineup, weekNum })
    }
  )

  // PUT /admin/leagues/:leagueId/lineups/:userId — set a user's lineup on their behalf
  app.put<{ Params: { leagueId: string; userId: string } }>(
    '/admin/leagues/:leagueId/lineups/:userId',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return
      const { leagueId, userId } = req.params
      const body = z.object({
        weekNum: z.number().int().min(1),
        entries: z.array(z.object({
          playerId: z.string().uuid(),
          slotRole: z.enum(['batsman', 'wicket_keeper', 'all_rounder', 'bowler', 'flex']),
        })).min(1).max(11),
      }).safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
      const { weekNum, entries } = body.data
      const validation = await validateLineup(leagueId, userId, entries)
      if (!validation.valid) return reply.code(400).send({ error: validation.error })
      await setLineup(leagueId, userId, weekNum, entries)
      const lineup = await getLineup(leagueId, userId, weekNum)
      return reply.send({ lineup })
    }
  )

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
