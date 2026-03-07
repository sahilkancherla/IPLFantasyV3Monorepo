import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import { supabaseAnon, pool } from '../db/client.js'
import {
  getOrCreateRoom,
  getRoom,
  addConnection,
  removeConnection,
  broadcast,
  sendTo,
  handleNominate,
  handleBid,
  handlePass,
  handleConfirm,
  handleReset,
  buildSessionState,
  hydrateRoomFromDb,
} from '../services/auction.service.js'
import {
  getAuctionSession,
  createAuctionSession,
} from '../db/queries/auction.js'
import { isLeagueMember, getLeagueById, getLeagueMembers } from '../db/queries/leagues.js'
import type { ClientMessage } from './types.js'

export async function registerAuctionWebSocket(app: FastifyInstance): Promise<void> {
  app.get('/ws/auction', { websocket: true }, async (socket: WebSocket, req: FastifyRequest) => {
    let leagueId: string | null = null
    let userId: string | null = null
    let isAdmin = false

    socket.on('message', async (rawData) => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(rawData.toString()) as ClientMessage
      } catch {
        sendTo(socket, { type: 'ERROR', message: 'Invalid JSON' })
        return
      }

      try {
        await handleMessage(msg)
      } catch (err) {
        console.error('WS handler error:', err)
        sendTo(socket, { type: 'ERROR', message: 'Internal server error' })
      }
    })

    socket.on('close', () => {
      if (leagueId) {
        const room = getRoom(leagueId)
        if (room) removeConnection(room, socket)
      }
    })

    socket.on('error', (err) => {
      console.error('WebSocket error:', err)
    })

    async function handleMessage(msg: ClientMessage): Promise<void> {
      switch (msg.type) {
        case 'PING':
          sendTo(socket, { type: 'PONG' })
          return

        case 'JOIN': {
          // Verify JWT
          const { data: { user }, error } = await supabaseAnon.auth.getUser(msg.token)
          if (error || !user) {
            sendTo(socket, { type: 'BID_REJECTED', reason: 'NOT_AUTHENTICATED' })
            socket.close()
            return
          }

          userId = user.id
          leagueId = msg.leagueId

          // Verify membership
          const isMember = await isLeagueMember(leagueId, userId)
          if (!isMember) {
            sendTo(socket, { type: 'ERROR', message: 'Not a member of this league' })
            socket.close()
            return
          }

          const league = await getLeagueById(leagueId)
          if (!league) {
            sendTo(socket, { type: 'ERROR', message: 'League not found' })
            socket.close()
            return
          }

          isAdmin = league.admin_id === userId

          // Get/create session
          let session = await getAuctionSession(leagueId)
          if (!session) {
            session = await createAuctionSession(leagueId)
          }

          // Build roleMaxes from league settings
          const roleMaxes: Record<string, number> = {
            batsman: league.max_batsmen,
            wicket_keeper: league.max_wicket_keepers,
            all_rounder: league.max_all_rounders,
            bowler: league.max_bowlers,
          }

          // Hydrate room from DB
          const room = await hydrateRoomFromDb(leagueId, session.id, league.bid_timeout_secs, roleMaxes)

          // Get member info with profile
          const { rows } = await pool.query<{
            user_id: string; remaining_budget: number; roster_count: number;
            username: string; display_name: string | null; avatar_url: string | null
          }>(
            `SELECT lm.user_id, lm.remaining_budget, lm.roster_count,
                    p.username, p.display_name, p.avatar_url
             FROM league_members lm
             JOIN profiles p ON p.id = lm.user_id
             WHERE lm.league_id = $1 AND lm.user_id = $2`,
            [leagueId, userId]
          )

          if (rows.length === 0) {
            sendTo(socket, { type: 'ERROR', message: 'Member not found' })
            socket.close()
            return
          }

          // Fetch per-role roster counts for this member
          const { rows: roleRows } = await pool.query<{ role: string; cnt: string }>(
            `SELECT pl.role, COUNT(*)::text AS cnt
             FROM team_rosters tr
             JOIN players pl ON pl.id = tr.player_id
             WHERE tr.league_id = $1 AND tr.user_id = $2
             GROUP BY pl.role`,
            [leagueId, userId]
          )
          const roleCounts: Record<string, number> = {}
          for (const row of roleRows) {
            roleCounts[row.role] = parseInt(row.cnt, 10)
          }

          addConnection(room, socket, {
            id: '',
            league_id: leagueId,
            user_id: rows[0].user_id,
            remaining_budget: rows[0].remaining_budget,
            roster_count: rows[0].roster_count,
            waiver_priority: 0,
            joined_at: '',
            username: rows[0].username,
            full_name: '',
            display_name: rows[0].display_name,
            avatar_url: rows[0].avatar_url,
            roleCounts,
          })

          // Send current session state to this client
          const state = await buildSessionState(room)
          sendTo(socket, state as Parameters<typeof sendTo>[1])
          return
        }

        case 'BID': {
          if (!leagueId || !userId) {
            sendTo(socket, { type: 'BID_REJECTED', reason: 'NOT_AUTHENTICATED' })
            return
          }

          const room = getRoom(leagueId)
          if (!room) {
            sendTo(socket, { type: 'BID_REJECTED', reason: 'NOT_IN_SESSION' })
            return
          }

          await handleBid(room, userId, msg.amount)
          return
        }

        case 'NOMINATE': {
          if (!leagueId || !userId || !isAdmin) {
            sendTo(socket, { type: 'ERROR', message: 'Only admins can nominate players' })
            return
          }

          const room = getRoom(leagueId)
          if (!room) {
            sendTo(socket, { type: 'ERROR', message: 'No active session' })
            return
          }

          await handleNominate(room, msg.playerId, userId)
          return
        }

        case 'PASS': {
          if (!leagueId || !userId || !isAdmin) {
            sendTo(socket, { type: 'ERROR', message: 'Only admins can pass' })
            return
          }

          const room = getRoom(leagueId)
          if (!room) return

          await handlePass(room)
          return
        }

        case 'CONFIRM': {
          if (!leagueId || !userId || !isAdmin) {
            sendTo(socket, { type: 'ERROR', message: 'Only admins can confirm' })
            return
          }

          const room = getRoom(leagueId)
          if (!room) return

          await handleConfirm(room)
          return
        }

        case 'RESET': {
          if (!leagueId || !userId || !isAdmin) {
            sendTo(socket, { type: 'ERROR', message: 'Only admins can reset' })
            return
          }

          const room = getRoom(leagueId)
          if (!room) return

          await handleReset(room)
          return
        }
      }
    }
  })
}
