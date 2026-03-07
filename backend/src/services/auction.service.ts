import type { WebSocket } from '@fastify/websocket'
import type { Player } from '../db/queries/players.js'
import type { MemberState, ServerMessage } from '../ws/types.js'
import {
  getAuctionSession,
  nominatePlayer,
  updateCurrentBid,
  recordPlayerSold,
  recordPlayerUnsold,
  updateSessionStatus,
  getNextQueuedPlayer,
  getAuctionQueue,
  getAuctionHistory,
} from '../db/queries/auction.js'
import { getPlayerById } from '../db/queries/players.js'
import { getLeagueMembers, type LeagueMember } from '../db/queries/leagues.js'
import { pool } from '../db/client.js'

// ============================================================
// In-memory AuctionRoom — single source of truth during live auction
// ============================================================

export interface AuctionMember {
  ws: WebSocket
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  remainingBudget: number
  rosterCount: number
  roleCounts: Record<string, number>  // role → count of players acquired
}

export interface AuctionRoom {
  leagueId: string
  sessionId: string
  bidTimeoutSecs: number
  roleMaxes: Record<string, number>  // role → max allowed per roster
  status: 'live' | 'paused' | 'completed'
  currentPlayer: Player | null
  currentBid: number | null
  currentBidderId: string | null
  timerExpiresAt: Date | null
  pausedTimeRemainingMs: number | null  // saved when paused, restored on resume
  awaitingConfirmation: boolean  // true after timer hits 0, waiting for admin CONFIRM or RESET
  timer: ReturnType<typeof setTimeout> | null
  members: Map<string, AuctionMember>  // userId → member
  connections: Map<WebSocket, string>  // ws → userId
  queueRemaining: number
}

// Global registry of active auction rooms
const rooms = new Map<string, AuctionRoom>()

export function getRoom(leagueId: string): AuctionRoom | undefined {
  return rooms.get(leagueId)
}

export function getOrCreateRoom(leagueId: string, sessionId: string, bidTimeoutSecs: number, roleMaxes: Record<string, number> = {}): AuctionRoom {
  const existing = rooms.get(leagueId)
  if (existing) return existing

  const room: AuctionRoom = {
    leagueId,
    sessionId,
    bidTimeoutSecs,
    roleMaxes,
    status: 'live',
    currentPlayer: null,
    currentBid: null,
    currentBidderId: null,
    timerExpiresAt: null,
    pausedTimeRemainingMs: null,
    awaitingConfirmation: false,
    timer: null,
    members: new Map(),
    connections: new Map(),
    queueRemaining: 0,
  }
  rooms.set(leagueId, room)
  return room
}

export function removeRoom(leagueId: string): void {
  const room = rooms.get(leagueId)
  if (room?.timer) clearTimeout(room.timer)
  rooms.delete(leagueId)
}

// ============================================================
// Member management
// ============================================================

export function addConnection(room: AuctionRoom, ws: WebSocket, member: LeagueMember & {
  username: string; display_name: string | null; avatar_url: string | null; roleCounts?: Record<string, number>
}): void {
  const auctionMember: AuctionMember = {
    ws,
    userId: member.user_id,
    username: member.username,
    displayName: member.display_name,
    avatarUrl: member.avatar_url,
    remainingBudget: member.remaining_budget,
    rosterCount: member.roster_count,
    roleCounts: member.roleCounts ?? {},
  }
  room.members.set(member.user_id, auctionMember)
  room.connections.set(ws, member.user_id)
}

export function removeConnection(room: AuctionRoom, ws: WebSocket): void {
  const userId = room.connections.get(ws)
  if (userId) {
    room.members.delete(userId)
    room.connections.delete(ws)
  }
}

export function getMemberStates(room: AuctionRoom): MemberState[] {
  return Array.from(room.members.values()).map(m => ({
    userId: m.userId,
    username: m.username,
    displayName: m.displayName,
    avatarUrl: m.avatarUrl,
    remainingBudget: m.remainingBudget,
    rosterCount: m.rosterCount,
  }))
}

// ============================================================
// Broadcast helpers
// ============================================================

export function broadcast(room: AuctionRoom, msg: ServerMessage): void {
  const payload = JSON.stringify(msg)
  for (const member of room.members.values()) {
    if (member.ws.readyState === 1) {
      member.ws.send(payload)
    }
  }
}

export function sendTo(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg))
  }
}

// ============================================================
// Bid validation (pure — no side effects)
// ============================================================

export type BidValidationResult =
  | { valid: true; amount: number }
  | { valid: false; reason: 'INSUFFICIENT_BUDGET' | 'TOO_LOW' | 'NOT_IN_SESSION' | 'SELF_BID' | 'ROLE_LIMIT_REACHED' }

export function validateBid(
  room: AuctionRoom,
  bidderId: string,
  amount: number
): BidValidationResult {
  if (!room.currentPlayer || room.status !== 'live') {
    return { valid: false, reason: 'NOT_IN_SESSION' }
  }
  if (room.currentBidderId === bidderId) {
    return { valid: false, reason: 'SELF_BID' }
  }

  const member = room.members.get(bidderId)
  if (!member) {
    return { valid: false, reason: 'INSUFFICIENT_BUDGET' }
  }

  // Check per-role squad limit
  const role = room.currentPlayer.role
  const roleMax = room.roleMaxes[role] ?? Infinity
  const bidderRoleCount = member.roleCounts[role] ?? 0
  if (bidderRoleCount >= roleMax) {
    return { valid: false, reason: 'ROLE_LIMIT_REACHED' }
  }

  // If someone already bid, must outbid them. Otherwise, must meet the base price.
  const minBid = room.currentBidderId !== null
    ? room.currentBid! + 1
    : room.currentPlayer.base_price
  if (amount < minBid) {
    return { valid: false, reason: 'TOO_LOW' }
  }

  if (member.remainingBudget < amount) {
    return { valid: false, reason: 'INSUFFICIENT_BUDGET' }
  }

  return { valid: true, amount }
}

// ============================================================
// Timer management
// ============================================================

export function startTimer(room: AuctionRoom, onExpire: () => Promise<void>): Date {
  if (room.timer) clearTimeout(room.timer)

  const expiresAt = new Date(Date.now() + room.bidTimeoutSecs * 1000)
  room.timerExpiresAt = expiresAt

  room.timer = setTimeout(() => {
    onExpire().catch(console.error)
  }, room.bidTimeoutSecs * 1000)

  return expiresAt
}

export function clearTimer(room: AuctionRoom): void {
  if (room.timer) {
    clearTimeout(room.timer)
    room.timer = null
  }
}

// Pause: stop the timer and save how much time was remaining
export function pauseTimer(room: AuctionRoom): void {
  if (room.timerExpiresAt) {
    room.pausedTimeRemainingMs = Math.max(0, room.timerExpiresAt.getTime() - Date.now())
  }
  clearTimer(room)
  room.timerExpiresAt = null
}

// Resume: restart the timer with the saved remaining time (or full timeout if none saved)
// Returns the new expiresAt so the caller can persist it and broadcast to clients
export function resumeTimer(room: AuctionRoom, onExpire: () => Promise<void>): Date | null {
  if (!room.currentPlayer) return null

  const remainingMs = room.pausedTimeRemainingMs ?? room.bidTimeoutSecs * 1000
  room.pausedTimeRemainingMs = null

  const expiresAt = new Date(Date.now() + remainingMs)
  room.timerExpiresAt = expiresAt
  room.timer = setTimeout(() => onExpire().catch(console.error), remainingMs)

  return expiresAt
}

// ============================================================
// Core auction flow
// ============================================================

export async function handleNominate(
  room: AuctionRoom,
  playerId: string,
  adminId: string
): Promise<void> {
  if (room.status !== 'live') return

  const player = await getPlayerById(playerId)
  if (!player) throw new Error('Player not found')

  const expiresAt = startTimer(room, () => handleTimerExpired(room))

  room.currentPlayer = player
  room.currentBid = null        // no bid yet — base_price is shown client-side as the floor
  room.currentBidderId = null

  await nominatePlayer(room.leagueId, playerId, player.base_price, expiresAt)

  // Count remaining after this nomination
  const queue = await getAuctionQueue(room.leagueId)
  room.queueRemaining = queue.filter(q => q.status === 'pending').length

  broadcast(room, {
    type: 'PLAYER_NOMINATED',
    player,
    basePrice: player.base_price,
    timerExpiresAt: expiresAt.toISOString(),
  })
}

export async function handleBid(
  room: AuctionRoom,
  bidderId: string,
  amount: number
): Promise<void> {
  const result = validateBid(room, bidderId, amount)

  const bidderMember = room.members.get(bidderId)
  if (!bidderMember) return

  if (!result.valid) {
    sendTo(bidderMember.ws, { type: 'BID_REJECTED', reason: result.reason })
    return
  }

  // Accept bid: reset timer
  const expiresAt = startTimer(room, () => handleTimerExpired(room))

  room.currentBid = amount
  room.currentBidderId = bidderId

  await updateCurrentBid(room.leagueId, bidderId, amount, expiresAt)

  const bidderState: MemberState = {
    userId: bidderMember.userId,
    username: bidderMember.username,
    displayName: bidderMember.displayName,
    avatarUrl: bidderMember.avatarUrl,
    remainingBudget: bidderMember.remainingBudget,
    rosterCount: bidderMember.rosterCount,
  }

  broadcast(room, {
    type: 'BID_ACCEPTED',
    bidder: bidderState,
    amount,
    timerExpiresAt: expiresAt.toISOString(),
  })
}

// Called when the countdown hits zero — pause and wait for admin decision
export async function handleTimerExpired(room: AuctionRoom): Promise<void> {
  if (!room.currentPlayer || room.awaitingConfirmation || room.status !== 'live') return

  room.timer = null
  room.timerExpiresAt = null
  room.awaitingConfirmation = true

  const currentBidder = room.currentBidderId
    ? buildMemberState(room.members.get(room.currentBidderId), room.currentBidderId)
    : null

  broadcast(room, {
    type: 'TIMER_EXPIRED',
    player: room.currentPlayer,
    currentBid: room.currentBid,
    currentBidder,
  })
}

// Admin confirms current outcome (SOLD if there's a bidder, UNSOLD if not)
export async function handleConfirm(room: AuctionRoom): Promise<void> {
  if (!room.awaitingConfirmation || !room.currentPlayer) return
  room.awaitingConfirmation = false
  await resolveCurrentPlayer(room)
}

// Admin resets: restart timer for the same player, bids cleared
export async function handleReset(room: AuctionRoom): Promise<void> {
  if (!room.currentPlayer) return

  const player = room.currentPlayer
  room.awaitingConfirmation = false
  room.currentBid = null
  room.currentBidderId = null

  const expiresAt = startTimer(room, () => handleTimerExpired(room))
  room.timerExpiresAt = expiresAt

  await nominatePlayer(room.leagueId, player.id, player.base_price, expiresAt)

  broadcast(room, {
    type: 'PLAYER_NOMINATED',
    player,
    basePrice: player.base_price,
    timerExpiresAt: expiresAt.toISOString(),
  })
}

// Admin passes: force unsold regardless of bids
export async function handlePass(room: AuctionRoom): Promise<void> {
  if (!room.currentPlayer) return
  clearTimer(room)
  room.awaitingConfirmation = false
  room.currentBidderId = null
  room.currentBid = null
  await resolveCurrentPlayer(room)
}

function buildMemberState(member: AuctionMember | undefined, fallbackId: string): MemberState {
  if (member) {
    return {
      userId: member.userId,
      username: member.username,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      remainingBudget: member.remainingBudget,
      rosterCount: member.rosterCount,
    }
  }
  return { userId: fallbackId, username: fallbackId, displayName: null, avatarUrl: null, remainingBudget: 0, rosterCount: 0 }
}

async function resolveCurrentPlayer(room: AuctionRoom): Promise<void> {
  const player = room.currentPlayer!

  if (room.currentBidderId && room.currentBid !== null) {
    // PLAYER SOLD
    const winnerId = room.currentBidderId
    const finalPrice = room.currentBid

    await recordPlayerSold({
      leagueId: room.leagueId,
      sessionId: room.sessionId,
      playerId: player.id,
      winnerId,
      price: finalPrice,
    })

    const winner = room.members.get(winnerId)
    if (winner) {
      winner.remainingBudget -= finalPrice
      winner.rosterCount += 1
      winner.roleCounts[player.role] = (winner.roleCounts[player.role] ?? 0) + 1
    }

    room.currentPlayer = null
    room.currentBid = null
    room.currentBidderId = null
    room.timerExpiresAt = null

    const allMembers = await fetchAllMemberStates(room)
    broadcast(room, {
      type: 'PLAYER_SOLD',
      player,
      winner: buildMemberState(winner, winnerId),
      price: finalPrice,
      members: allMembers,
    })
  } else {
    // PLAYER UNSOLD
    await recordPlayerUnsold(room.leagueId, player.id)

    room.currentPlayer = null
    room.currentBid = null
    room.currentBidderId = null
    room.timerExpiresAt = null

    broadcast(room, { type: 'PLAYER_UNSOLD', player })
  }

  // Check if queue is exhausted
  const queue = await getAuctionQueue(room.leagueId)
  const remaining = queue.filter(q => q.status === 'pending').length
  room.queueRemaining = remaining

  if (remaining === 0) {
    room.status = 'completed'
    await updateSessionStatus(room.leagueId, 'completed')
    // Transition league to active and generate H2H matchup schedule
    await pool.query(
      `UPDATE leagues SET status = 'league_active' WHERE id = $1 AND status = 'draft_active'`,
      [room.leagueId]
    )
    await pool.query(`SELECT generate_schedule($1)`, [room.leagueId])
    broadcast(room, { type: 'SESSION_STATUS', status: 'completed' })
  }
}

// Returns all league members (online + offline), preferring in-memory budget for connected users
async function fetchAllMemberStates(room: AuctionRoom): Promise<MemberState[]> {
  const dbMembers = await getLeagueMembers(room.leagueId)
  return dbMembers.map(m => {
    const connected = room.members.get(m.user_id)
    return {
      userId: m.user_id,
      username: m.username,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      remainingBudget: connected?.remainingBudget ?? m.remaining_budget,
      rosterCount: connected?.rosterCount ?? m.roster_count,
    }
  })
}

export async function buildSessionState(room: AuctionRoom): Promise<Parameters<typeof broadcast>[1]> {
  const [queue, auctionHistory] = await Promise.all([
    getAuctionQueue(room.leagueId),
    getAuctionHistory(room.leagueId),
  ])

  let currentBidder: MemberState | null = null
  if (room.currentBidderId) {
    const m = room.members.get(room.currentBidderId)
    if (m) {
      currentBidder = {
        userId: m.userId,
        username: m.username,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
        remainingBudget: m.remainingBudget,
        rosterCount: m.rosterCount,
      }
    }
  }

  const allMembers = await fetchAllMemberStates(room)

  return {
    type: 'SESSION_STATE',
    sessionId: room.sessionId,
    status: room.status,
    player: room.currentPlayer,
    currentBid: room.currentBid,
    currentBidder,
    timerExpiresAt: room.timerExpiresAt?.toISOString() ?? null,
    awaitingConfirmation: room.awaitingConfirmation,
    members: allMembers,
    queueRemaining: queue.filter(q => q.status === 'pending').length,
    auctionHistory,
  }
}

// Re-hydrate room from DB on server restart / first join
export async function hydrateRoomFromDb(
  leagueId: string,
  sessionId: string,
  bidTimeoutSecs: number,
  roleMaxes: Record<string, number> = {}
): Promise<AuctionRoom> {
  const room = getOrCreateRoom(leagueId, sessionId, bidTimeoutSecs, roleMaxes)

  const session = await getAuctionSession(leagueId)
  if (!session) return room

  // 'pending' should never reach clients — treat as 'live'
  room.status = (session.status === 'pending' ? 'live' : session.status) as AuctionRoom['status']
  room.currentBid = session.current_bid
  room.currentBidderId = session.current_bidder_id

  if (session.current_player_id) {
    room.currentPlayer = await getPlayerById(session.current_player_id)
  }

  if (session.timer_expires_at) {
    const expiresAt = new Date(session.timer_expires_at)
    const remaining = expiresAt.getTime() - Date.now()

    if (remaining > 0) {
      room.timerExpiresAt = expiresAt
      room.timer = setTimeout(() => handleTimerExpired(room).catch(console.error), remaining)
    } else if (room.currentPlayer) {
      // Timer already expired — await admin confirmation
      room.awaitingConfirmation = true
    }
  }

  return room
}
