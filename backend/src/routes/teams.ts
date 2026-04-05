import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware.js'
import { isLeagueMember, getLeagueById } from '../db/queries/leagues.js'
import { getUserTeam, getAllTeams } from '../db/queries/teams.js'
import { clearUncompletedLineups, getPlayerUncompletedLineupWeeks, removePlayerFromUncompletedLineups } from '../db/queries/lineups.js'
import { pool, withTransaction } from '../db/client.js'
import pg from 'pg'

const addPlayerSchema = z.object({
  playerId: z.string().uuid(),
  dropPlayerId: z.string().uuid().optional(),
})


export async function teamRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /teams/:leagueId
  app.get<{ Params: { leagueId: string } }>('/teams/:leagueId', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member' })

    const roster = await getUserTeam(leagueId, req.authUser!.id)
    return reply.send({ roster })
  })

  // GET /teams/:leagueId/all
  app.get<{ Params: { leagueId: string } }>('/teams/:leagueId/all', async (req, reply) => {
    const { leagueId } = req.params

    const isMember = await isLeagueMember(leagueId, req.authUser!.id)
    if (!isMember) return reply.code(403).send({ error: 'Not a member' })

    const league = await getLeagueById(leagueId)
    if (league?.status === 'draft_pending' || league?.status === 'draft_active') {
      return reply.code(403).send({ error: 'Teams are only visible after the draft' })
    }

    const rosters = await getAllTeams(leagueId)
    return reply.send({ rosters })
  })

  // GET /teams/:leagueId/players/:playerId/drop-impact — check if dropping affects uncompleted lineups
  app.get<{ Params: { leagueId: string; playerId: string } }>(
    '/teams/:leagueId/players/:playerId/drop-impact',
    async (req, reply) => {
      const { leagueId, playerId } = req.params
      const userId = req.authUser!.id

      const isMember = await isLeagueMember(leagueId, userId)
      if (!isMember) return reply.code(403).send({ error: 'Not a member' })

      const affectedWeeks = await getPlayerUncompletedLineupWeeks(leagueId, userId, playerId)
      return reply.send({ affectedWeeks })
    }
  )

  // DELETE /teams/:leagueId/players/:playerId — immediately drop a player
  app.delete<{ Params: { leagueId: string; playerId: string } }>(
    '/teams/:leagueId/players/:playerId',
    async (req, reply) => {
      const { leagueId, playerId } = req.params
      const userId = req.authUser!.id

      const isMember = await isLeagueMember(leagueId, userId)
      if (!isMember) return reply.code(403).send({ error: 'Not a member' })

      const league = await getLeagueById(leagueId)
      if (!league || league.status === 'league_complete') {
        return reply.code(409).send({ error: 'Season is complete — add/drop is closed' })
      }

      const { rows } = await pool.query(
        `DELETE FROM team_rosters WHERE league_id = $1 AND user_id = $2 AND player_id = $3 RETURNING id`,
        [leagueId, userId, playerId]
      )
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'Player not on your roster' })
      }

      await pool.query(
        `UPDATE league_members SET roster_count = roster_count - 1 WHERE league_id = $1 AND user_id = $2`,
        [leagueId, userId]
      )

      await removePlayerFromUncompletedLineups(leagueId, userId, playerId)

      return reply.code(204).send()
    }
  )

  // POST /teams/:leagueId/players — immediately add a free agent (optionally drop one to make room)
  app.post<{ Params: { leagueId: string } }>(
    '/teams/:leagueId/players',
    async (req, reply) => {
      const { leagueId } = req.params
      const userId = req.authUser!.id

      const body = addPlayerSchema.safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const { playerId, dropPlayerId } = body.data

      const isMember = await isLeagueMember(leagueId, userId)
      if (!isMember) return reply.code(403).send({ error: 'Not a member' })

      const league = await getLeagueById(leagueId)
      if (!league || league.status === 'league_complete') {
        return reply.code(409).send({ error: 'Season is complete — add/drop is closed' })
      }

      // Verify player is a free agent
      const { rows: onRoster } = await pool.query(
        `SELECT 1 FROM team_rosters WHERE league_id = $1 AND player_id = $2`,
        [leagueId, playerId]
      )
      if (onRoster.length > 0) {
        return reply.code(409).send({ error: 'That player is already on a roster' })
      }

      // Get the incoming player's role
      const { rows: playerRows } = await pool.query(
        `SELECT role FROM players WHERE id = $1`,
        [playerId]
      )
      if (playerRows.length === 0) {
        return reply.code(404).send({ error: 'Player not found' })
      }
      const playerRole: string = playerRows[0].role

      // Check positional limit
      const { rows: roleCountRows } = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM team_rosters tr
         JOIN players p ON p.id = tr.player_id
         WHERE tr.league_id = $1 AND tr.user_id = $2 AND p.role = $3`,
        [leagueId, userId, playerRole]
      )
      const currentRoleCount: number = roleCountRows[0]?.count ?? 0
      const roleLimits: Record<string, number> = {
        batsman:       league.max_batsmen,
        wicket_keeper: league.max_wicket_keepers,
        all_rounder:   league.max_all_rounders,
        bowler:        league.max_bowlers,
      }
      const roleLimit = roleLimits[playerRole] ?? 99
      const roleFull = currentRoleCount >= roleLimit

      if (roleFull && !dropPlayerId) {
        return reply.code(409).send({
          error: `${playerRole.replace('_', ' ')} limit reached (${roleLimit} max). Drop a ${playerRole.replace('_', ' ')} to add one.`,
        })
      }

      if (roleFull && dropPlayerId) {
        // The dropped player must be of the same role
        const { rows: dropRoleRows } = await pool.query(
          `SELECT p.role FROM team_rosters tr JOIN players p ON p.id = tr.player_id
           WHERE tr.league_id = $1 AND tr.user_id = $2 AND tr.player_id = $3`,
          [leagueId, userId, dropPlayerId]
        )
        if (dropRoleRows.length === 0) {
          return reply.code(404).send({ error: 'Drop player not on your roster' })
        }
        if (dropRoleRows[0].role !== playerRole) {
          return reply.code(409).send({
            error: `Must drop a ${playerRole.replace('_', ' ')} to make room — you cannot drop a ${dropRoleRows[0].role.replace('_', ' ')} instead.`,
          })
        }
      }

      // Get current roster count
      const { rows: memberRows } = await pool.query(
        `SELECT roster_count FROM league_members WHERE league_id = $1 AND user_id = $2`,
        [leagueId, userId]
      )
      const currentCount: number = memberRows[0]?.roster_count ?? 0
      const rosterFull = currentCount >= league.roster_size

      if (rosterFull && !dropPlayerId) {
        return reply.code(409).send({
          error: `Roster is full (${league.roster_size} players max). You must drop a player to add one.`,
        })
      }

      await withTransaction(async (client: pg.PoolClient) => {
        if (dropPlayerId) {
          const { rows: dropResult } = await client.query(
            `DELETE FROM team_rosters WHERE league_id = $1 AND user_id = $2 AND player_id = $3 RETURNING id`,
            [leagueId, userId, dropPlayerId]
          )
          if (dropResult.length === 0) {
            throw Object.assign(new Error('Drop player not on your roster'), { statusCode: 404 })
          }
          // Decrement roster_count for the dropped player
          await client.query(
            `UPDATE league_members SET roster_count = roster_count - 1 WHERE league_id = $1 AND user_id = $2`,
            [leagueId, userId]
          )
        }

        await client.query(
          `INSERT INTO team_rosters (league_id, user_id, player_id, price_paid)
           VALUES ($1, $2, $3, 0)`,
          [leagueId, userId, playerId]
        )

        await client.query(
          `UPDATE league_members SET roster_count = roster_count + 1 WHERE league_id = $1 AND user_id = $2`,
          [leagueId, userId]
        )

        // Clear lineups for all non-finalized weeks so the user must re-set
        // their lineup with the updated roster. Completed week lineups are preserved.
        await clearUncompletedLineups(leagueId, userId, client)
      })

      return reply.code(201).send({ ok: true })
    }
  )
}
