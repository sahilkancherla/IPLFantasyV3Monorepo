import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { pool } from '../db/client.js'
import { calcFantasyPoints, getWeekForDate } from '../services/scoring.service.js'
import { getAllWeeks } from '../services/schedule.service.js'
import { config } from '../config.js'
import { parseScorecardUrl } from '../services/scorecard.service.js'

const playerScoreSchema = z.object({
  playerId: z.string().uuid(),
  matchId: z.string().min(1),
  matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

const syncScoresSchema = z.object({
  scores: z.array(playerScoreSchema).min(1).max(100),
})

export async function scoreRoutes(app: FastifyInstance): Promise<void> {
  // POST /scores/sync — ingest match data (requires SYNC_SECRET header)
  app.post('/scores/sync', async (req, reply) => {
    const secret = req.headers['x-sync-secret']
    if (!secret || secret !== config.SYNC_SECRET) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const body = syncScoresSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const weeks = await getAllWeeks()

    // Bulk-fetch player roles so scoring can apply SR bonus correctly
    const playerIds = body.data.scores.map(s => s.playerId)
    const { rows: playerRoleRows } = await pool.query(
      `SELECT id, role FROM players WHERE id = ANY($1)`,
      [playerIds]
    )
    const roleMap = new Map<string, string>(playerRoleRows.map((r: { id: string; role: string }) => [r.id, r.role]))

    const results: Array<{ playerId: string; matchId: string; points: number; ok: boolean }> = []

    for (const s of body.data.scores) {
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
        lbwBowledWickets: 0,
        catches: s.catches,
        stumpings: s.stumpings,
        runOutsDirect: s.runOutsDirect,
        runOutsIndirect: s.runOutsIndirect,
      })

      const iplWeek = getWeekForDate(new Date(s.matchDate), weeks)

      try {
        await pool.query(
          `INSERT INTO match_scores (
             player_id, match_id, match_date, ipl_week,
             runs_scored, balls_faced, fours, sixes, is_out,
             wickets_taken, balls_bowled, runs_conceded, maidens,
             catches, stumpings, run_outs_direct, run_outs_indirect,
             fantasy_points, raw_data
           ) VALUES (
             $1, $2, $3, $4,
             $5, $6, $7, $8, $9,
             $10, $11, $12, $13,
             $14, $15, $16, $17,
             $18, $19
           )
           ON CONFLICT (player_id, match_id) DO UPDATE SET
             ipl_week        = EXCLUDED.ipl_week,
             runs_scored     = EXCLUDED.runs_scored,
             balls_faced     = EXCLUDED.balls_faced,
             fours           = EXCLUDED.fours,
             sixes           = EXCLUDED.sixes,
             is_out          = EXCLUDED.is_out,
             wickets_taken   = EXCLUDED.wickets_taken,
             balls_bowled    = EXCLUDED.balls_bowled,
             runs_conceded   = EXCLUDED.runs_conceded,
             maidens         = EXCLUDED.maidens,
             catches         = EXCLUDED.catches,
             stumpings       = EXCLUDED.stumpings,
             run_outs_direct = EXCLUDED.run_outs_direct,
             run_outs_indirect = EXCLUDED.run_outs_indirect,
             fantasy_points  = EXCLUDED.fantasy_points`,
          [
            s.playerId, s.matchId, s.matchDate, iplWeek,
            s.runs, s.ballsFaced, s.fours, s.sixes, s.isOut,
            s.wickets, s.ballsBowled, s.runsConceded, s.maidens,
            s.catches, s.stumpings, s.runOutsDirect, s.runOutsIndirect,
            fantasyPoints, JSON.stringify(s),
          ]
        )
        results.push({ playerId: s.playerId, matchId: s.matchId, points: fantasyPoints, ok: true })
      } catch (err) {
        results.push({ playerId: s.playerId, matchId: s.matchId, points: 0, ok: false })
      }
    }

    return reply.send({ synced: results.filter((r) => r.ok).length, results })
  })

  // POST /scores/auto-sync — automatically scrape live matches with scorecard URLs
  app.post('/scores/auto-sync', async (req, reply) => {
    const secret = req.headers['x-sync-secret']
    if (!secret || secret !== config.SYNC_SECRET) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { rows: liveMatches } = await pool.query(
      `SELECT id, match_id, scorecard_url, match_date FROM ipl_matches
       WHERE status = 'live' AND scorecard_url IS NOT NULL`
    )

    if (liveMatches.length === 0) {
      return reply.send({ matchesProcessed: 0, results: [] })
    }

    const weeks = await getAllWeeks()
    const results: Array<{ matchId: string; saved: number; unmatched: string[]; error?: string }> = []

    for (const match of liveMatches) {
      try {
        const parsed = await parseScorecardUrl(match.scorecard_url, match.id)
        if (parsed.matched.length === 0) {
          results.push({ matchId: match.match_id, saved: 0, unmatched: parsed.unmatched, error: 'No players matched' })
          continue
        }

        const playerIds = parsed.matched.map(s => s.playerId)
        const { rows: playerRoleRows } = await pool.query(
          `SELECT id, role FROM players WHERE id = ANY($1)`, [playerIds]
        )
        const roleMap = new Map<string, string>(playerRoleRows.map((r: { id: string; role: string }) => [r.id, r.role]))
        const iplWeek = getWeekForDate(new Date(match.match_date), weeks)

        const client = await pool.connect()
        let saved = 0
        try {
          await client.query('BEGIN')
          for (const s of parsed.matched) {
            const fantasyPoints = calcFantasyPoints({
              role: roleMap.get(s.playerId) ?? 'batsman',
              runs: s.runs, ballsFaced: s.ballsFaced, fours: s.fours, sixes: s.sixes, isOut: s.isOut,
              wickets: s.wickets, ballsBowled: s.ballsBowled, runsConceded: s.runsConceded,
              maidens: s.maidens, lbwBowledWickets: s.lbwBowledWickets,
              catches: s.catches, stumpings: s.stumpings, runOutsDirect: s.runOutsDirect,
              runOutsIndirect: s.runOutsIndirect, isInXI: s.isInXI,
            })
            await client.query(
              `INSERT INTO match_scores (
                 player_id, match_id, match_date, ipl_week,
                 runs_scored, balls_faced, fours, sixes, is_out,
                 wickets_taken, balls_bowled, runs_conceded, maidens, lbw_bowled_wickets,
                 catches, stumpings, run_outs_direct, run_outs_indirect,
                 fantasy_points, dismissal_text, is_in_xi
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
               ON CONFLICT (player_id, match_id) DO UPDATE SET
                 ipl_week = EXCLUDED.ipl_week, runs_scored = EXCLUDED.runs_scored,
                 balls_faced = EXCLUDED.balls_faced, fours = EXCLUDED.fours, sixes = EXCLUDED.sixes,
                 is_out = EXCLUDED.is_out, wickets_taken = EXCLUDED.wickets_taken,
                 balls_bowled = EXCLUDED.balls_bowled, runs_conceded = EXCLUDED.runs_conceded,
                 maidens = EXCLUDED.maidens, lbw_bowled_wickets = EXCLUDED.lbw_bowled_wickets,
                 catches = EXCLUDED.catches, stumpings = EXCLUDED.stumpings,
                 run_outs_direct = EXCLUDED.run_outs_direct, run_outs_indirect = EXCLUDED.run_outs_indirect,
                 fantasy_points = EXCLUDED.fantasy_points, dismissal_text = EXCLUDED.dismissal_text,
                 is_in_xi = EXCLUDED.is_in_xi`,
              [s.playerId, match.match_id, match.match_date, iplWeek,
               s.runs, s.ballsFaced, s.fours, s.sixes, s.isOut,
               s.wickets, s.ballsBowled, s.runsConceded, s.maidens, s.lbwBowledWickets,
               s.catches, s.stumpings, s.runOutsDirect, s.runOutsIndirect,
               fantasyPoints, s.dismissalText || null, s.isInXI]
            )
            saved++
          }
          await client.query('COMMIT')
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        } finally {
          client.release()
        }

        console.log('[auto-sync]', match.match_id, '— saved:', saved, 'unmatched:', parsed.unmatched.length)
        results.push({ matchId: match.match_id, saved, unmatched: parsed.unmatched })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[auto-sync] error for', match.match_id, ':', msg)
        results.push({ matchId: match.match_id, saved: 0, unmatched: [], error: msg })
      }
    }

    return reply.send({ matchesProcessed: liveMatches.length, results })
  })

  // GET /scores/:playerId — player's match history
  app.get<{ Params: { playerId: string }; Querystring: { week?: string } }>(
    '/scores/:playerId',
    async (req, reply) => {
      const { playerId } = req.params

      let query = `SELECT * FROM match_scores WHERE player_id = $1`
      const params: unknown[] = [playerId]

      if (req.query.week) {
        const week = parseInt(req.query.week, 10)
        if (!isNaN(week)) {
          query += ` AND ipl_week = $2`
          params.push(week)
        }
      }

      query += ` ORDER BY match_date DESC`

      const { rows } = await pool.query(query, params)
      return reply.send({ scores: rows })
    }
  )
}
