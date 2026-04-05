import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember, getLeagueById } from '../db/queries/leagues.js'
import { getLeagueSchedule, getMatchupForWeek, getAllWeeks, getCurrentWeekRow } from '../db/queries/schedule.js'
import { getCurrentWeek, isWeekLocked } from '../services/schedule.service.js'

async function resolveCurrentMatchAndWeek(pool: import('pg').Pool) {
  const { rows: settings } = await pool.query(
    `SELECT key, value FROM system_settings WHERE key IN ('current_week', 'current_match')`
  )
  const s: Record<string, string> = {}
  for (const row of settings) s[row.key] = row.value

  // Week: explicit setting → live status → date-based auto-detect
  let currentWeekNum: number | null = s.current_week ? parseInt(s.current_week, 10) : null
  if (!currentWeekNum) {
    try {
      const { rows } = await pool.query(
        `SELECT week_num FROM ipl_weeks WHERE status = 'live' LIMIT 1`
      )
      currentWeekNum = rows[0]?.week_num ?? null
    } catch { /* status column not yet migrated */ }
  }
  if (!currentWeekNum) {
    // Fall back to whichever week contains today
    const { rows } = await pool.query(
      `SELECT week_num FROM ipl_weeks WHERE CURRENT_DATE BETWEEN start_date AND end_date LIMIT 1`
    )
    currentWeekNum = rows[0]?.week_num ?? null
  }

  // Match: explicit setting → live status → closest match in current week
  let currentMatch: unknown = null
  const matchId = s.current_match || null
  if (matchId) {
    const { rows } = await pool.query(`SELECT * FROM ipl_matches WHERE id = $1`, [matchId])
    currentMatch = rows[0] ?? null
  }
  if (!currentMatch) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM ipl_matches WHERE status = 'live' LIMIT 1`
      )
      currentMatch = rows[0] ?? null
    } catch { /* status column not yet migrated */ }
  }
  if (!currentMatch && currentWeekNum) {
    // Show the closest match (by time) in the current week
    const { rows } = await pool.query(
      `SELECT * FROM ipl_matches
       WHERE week_num = $1
       ORDER BY ABS(EXTRACT(EPOCH FROM (start_time_utc - NOW())))
       LIMIT 1`,
      [currentWeekNum]
    )
    currentMatch = rows[0] ?? null
  }

  return { currentWeekNum, currentMatch }
}

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

  // GET /schedule/home-summary — current match + per-league matchups + players for the caller
  app.get('/schedule/home-summary', async (req, reply) => {
    const userId = req.authUser!.id
    const { pool } = await import('../db/client.js')
    const { currentWeekNum, currentMatch } = await resolveCurrentMatchAndWeek(pool)

    // All active leagues the user belongs to
    const { rows: leagueRows } = await pool.query(
      `SELECT l.id, l.name
       FROM leagues l
       JOIN league_members lm ON lm.league_id = l.id
       WHERE lm.user_id = $1 AND l.status = 'league_active'`,
      [userId]
    )

    const matchups: {
      leagueId: string; leagueName: string; matchup: unknown
      myPlayers: unknown[]; oppPlayers: unknown[]
    }[] = []

    if (currentWeekNum && currentMatch) {
      const cm = currentMatch as Record<string, unknown>
      const matchId = cm.match_id as string
      const homeTeam = cm.home_team as string
      const awayTeam = cm.away_team as string

      for (const league of leagueRows) {
        const matchup = await getMatchupForWeek(league.id, currentWeekNum, userId)
        const oppId = matchup
          ? (matchup.home_user === userId ? matchup.away_user : matchup.home_user)
          : null

        let myPlayers: unknown[] = []
        let oppPlayers: unknown[] = []

        if (oppId) {
          // Lineup players from both users whose team is in the current match
          const { rows: playerRows } = await pool.query(
            `SELECT
               wl.user_id,
               p.id          AS player_id,
               p.name        AS player_name,
               p.role        AS player_role,
               p.ipl_team    AS player_team,
               wl.slot_role,
               COALESCE(ms.fantasy_points,    0)     AS points,
               COALESCE(ms.runs_scored,       0)     AS runs_scored,
               COALESCE(ms.balls_faced,       0)     AS balls_faced,
               COALESCE(ms.fours,             0)     AS fours,
               COALESCE(ms.sixes,             0)     AS sixes,
               COALESCE(ms.is_out,            false) AS is_out,
               COALESCE(ms.balls_bowled,      0)     AS balls_bowled,
               COALESCE(ms.runs_conceded,     0)     AS runs_conceded,
               COALESCE(ms.wickets_taken,     0)     AS wickets_taken,
               COALESCE(ms.maidens,           0)     AS maidens,
               COALESCE(ms.catches,           0)     AS catches,
               COALESCE(ms.stumpings,         0)     AS stumpings,
               COALESCE(ms.run_outs_direct,   0)     AS run_outs_direct,
               COALESCE(ms.run_outs_indirect, 0)     AS run_outs_indirect,
               COALESCE(ms.is_in_xi,          true)  AS is_in_xi
             FROM weekly_lineups wl
             JOIN players p ON p.id = wl.player_id
             LEFT JOIN match_scores ms ON ms.player_id = p.id AND ms.match_id = $1
             WHERE wl.league_id = $2
               AND wl.user_id IN ($3, $4)
               AND wl.week_num = $5
               AND p.ipl_team IN ($6, $7)
             ORDER BY COALESCE(ms.fantasy_points, 0) DESC`,
            [matchId, league.id, userId, oppId, currentWeekNum, homeTeam, awayTeam]
          )

          const toPlayer = (r: Record<string, unknown>) => ({
            playerId: r.player_id,
            playerName: r.player_name,
            playerRole: r.player_role,
            playerTeam: r.player_team,
            slotRole: r.slot_role,
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
          })

          myPlayers = playerRows
            .filter((r: Record<string, unknown>) => r.user_id === userId)
            .map(toPlayer)
          oppPlayers = playerRows
            .filter((r: Record<string, unknown>) => r.user_id === oppId)
            .map(toPlayer)
        }

        matchups.push({ leagueId: league.id, leagueName: league.name, matchup, myPlayers, oppPlayers })
      }
    } else if (currentWeekNum) {
      // No current match resolved — still include matchup without players
      for (const league of leagueRows) {
        const matchup = await getMatchupForWeek(league.id, currentWeekNum, userId)
        matchups.push({ leagueId: league.id, leagueName: league.name, matchup, myPlayers: [], oppPlayers: [] })
      }
    }

    return reply.send({ currentMatch, currentWeekNum, matchups })
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

  // GET /schedule/weeks/:weekNum/matches — all IPL games in a week
  app.get<{ Params: { weekNum: string } }>('/schedule/weeks/:weekNum/matches', async (req, reply) => {
    const week = parseInt(req.params.weekNum, 10)
    if (isNaN(week)) return reply.code(400).send({ error: 'Invalid week number' })

    const { pool } = await import('../db/client.js')
    const { rows } = await pool.query(
      `SELECT id, match_id, match_number, home_team, away_team,
              match_date, start_time_utc, venue, status
       FROM ipl_matches
       WHERE week_num = $1
       ORDER BY start_time_utc ASC NULLS LAST, match_date ASC`,
      [week]
    )
    return reply.send({ matches: rows })
  })

  // GET /schedule/:leagueId/home — current match + matchup + roster bundle for the home tab
  app.get<{ Params: { leagueId: string } }>('/schedule/:leagueId/home', async (req, reply) => {
    const { leagueId } = req.params
    const userId = req.authUser!.id

    const isMember = await isLeagueMember(leagueId, userId)
    if (!isMember) return reply.code(403).send({ error: 'Not a member of this league' })

    const { pool } = await import('../db/client.js')
    const { currentWeekNum, currentMatch } = await resolveCurrentMatchAndWeek(pool)

    // Current matchup for this user
    let matchup = null
    if (currentWeekNum) {
      matchup = await getMatchupForWeek(leagueId, currentWeekNum, userId)
    }

    // User's roster
    const { rows: rosterRows } = await pool.query(
      `SELECT tr.*, p.name AS player_name, p.ipl_team AS player_ipl_team,
              p.role AS player_role, p.image_url AS player_image_url
       FROM team_rosters tr
       JOIN players p ON p.id = tr.player_id
       WHERE tr.league_id = $1 AND tr.user_id = $2
       ORDER BY p.role, p.name`,
      [leagueId, userId]
    )

    // Players in the current match (from both user and opponent lineups)
    let myPlayers: unknown[] = []
    let oppPlayers: unknown[] = []
    const oppId = matchup
      ? (matchup.home_user === userId ? matchup.away_user : matchup.home_user)
      : null

    if (currentWeekNum && currentMatch && oppId) {
      const cm = currentMatch as Record<string, unknown>
      const matchId = cm.match_id as string
      const homeTeam = cm.home_team as string
      const awayTeam = cm.away_team as string

      const { rows: playerRows } = await pool.query(
        `SELECT
           wl.user_id,
           p.id          AS player_id,
           p.name        AS player_name,
           p.role        AS player_role,
           p.ipl_team    AS player_team,
           wl.slot_role,
           COALESCE(ms.fantasy_points,    0)     AS points,
           COALESCE(ms.runs_scored,       0)     AS runs_scored,
           COALESCE(ms.balls_faced,       0)     AS balls_faced,
           COALESCE(ms.fours,             0)     AS fours,
           COALESCE(ms.sixes,             0)     AS sixes,
           COALESCE(ms.is_out,            false) AS is_out,
           COALESCE(ms.balls_bowled,      0)     AS balls_bowled,
           COALESCE(ms.runs_conceded,     0)     AS runs_conceded,
           COALESCE(ms.wickets_taken,     0)     AS wickets_taken,
           COALESCE(ms.maidens,           0)     AS maidens,
           COALESCE(ms.catches,           0)     AS catches,
           COALESCE(ms.stumpings,         0)     AS stumpings,
           COALESCE(ms.run_outs_direct,   0)     AS run_outs_direct,
           COALESCE(ms.run_outs_indirect, 0)     AS run_outs_indirect,
           COALESCE(ms.is_in_xi,          true)  AS is_in_xi
         FROM weekly_lineups wl
         JOIN players p ON p.id = wl.player_id
         LEFT JOIN match_scores ms ON ms.player_id = p.id AND ms.match_id = $1
         WHERE wl.league_id = $2
           AND wl.user_id IN ($3, $4)
           AND wl.week_num = $5
           AND p.ipl_team IN ($6, $7)
         ORDER BY COALESCE(ms.fantasy_points, 0) DESC`,
        [matchId, leagueId, userId, oppId, currentWeekNum, homeTeam, awayTeam]
      )

      const toPlayer = (r: Record<string, unknown>) => ({
        playerId: r.player_id,
        playerName: r.player_name,
        playerRole: r.player_role,
        playerTeam: r.player_team,
        slotRole: r.slot_role,
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
      })

      myPlayers = playerRows
        .filter((r: Record<string, unknown>) => r.user_id === userId)
        .map(toPlayer)
      oppPlayers = playerRows
        .filter((r: Record<string, unknown>) => r.user_id === oppId)
        .map(toPlayer)
    }

    // Weekly point totals across all matches this week
    let myWeekPoints = 0
    let oppWeekPoints = 0
    if (currentWeekNum && oppId) {
      const { rows: weekPtsRows } = await pool.query(
        `SELECT wl.user_id, COALESCE(SUM(ms.fantasy_points), 0) AS total
         FROM weekly_lineups wl
         JOIN players p ON p.id = wl.player_id
         JOIN ipl_matches im ON im.week_num = $3 AND p.ipl_team IN (im.home_team, im.away_team)
         LEFT JOIN match_scores ms ON ms.player_id = wl.player_id AND ms.match_id = im.match_id
         WHERE wl.league_id = $1 AND wl.user_id IN ($2, $4) AND wl.week_num = $3
         GROUP BY wl.user_id`,
        [leagueId, userId, currentWeekNum, oppId]
      )
      for (const r of weekPtsRows) {
        if (r.user_id === userId) myWeekPoints = parseFloat(r.total) || 0
        else oppWeekPoints = parseFloat(r.total) || 0
      }
    }

    return reply.send({ currentMatch, matchup, roster: rosterRows, currentWeekNum, myPlayers, oppPlayers, myWeekPoints, oppWeekPoints })
  })

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

  // PUT /schedule/:leagueId/week/:weekNum/matchups — admin updates all matchups for a week
  app.put<{
    Params: { leagueId: string; weekNum: string }
    Body: { matchups: Array<{ id: string; home_user: string; away_user: string }> }
  }>(
    '/schedule/:leagueId/week/:weekNum/matchups',
    async (req, reply) => {
      const { leagueId, weekNum } = req.params
      const week = parseInt(weekNum, 10)
      if (isNaN(week)) return reply.code(400).send({ error: 'Invalid week number' })

      const league = await getLeagueById(leagueId)
      if (!league) return reply.code(404).send({ error: 'League not found' })
      if (league.admin_id !== req.authUser!.id) return reply.code(403).send({ error: 'Admin only' })

      const { matchups } = req.body
      if (!Array.isArray(matchups) || matchups.length === 0) {
        return reply.code(400).send({ error: 'matchups array required' })
      }

      const { pool } = await import('../db/client.js')

      // Verify none of the matchups being edited are already finalized
      const { rows: existing } = await pool.query(
        `SELECT id, is_final FROM weekly_matchups WHERE league_id = $1 AND week_num = $2`,
        [leagueId, week]
      )
      if (existing.some((r: { is_final: boolean }) => r.is_final)) {
        return reply.code(409).send({ error: 'Cannot edit a finalized week' })
      }

      // Delete and re-insert within a transaction to avoid interim unique
      // constraint violations on (league_id, week_num, away_user) when swapping users.
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          `DELETE FROM weekly_matchups WHERE league_id = $1 AND week_num = $2`,
          [leagueId, week]
        )
        for (const m of matchups) {
          await client.query(
            `INSERT INTO weekly_matchups (id, league_id, week_num, home_user, away_user)
             VALUES ($1, $2, $3, $4, $5)`,
            [m.id, leagueId, week, m.home_user, m.away_user]
          )
        }
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }

      const updated = await getLeagueSchedule(leagueId)
      return reply.send({ matchups: updated })
    }
  )

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
