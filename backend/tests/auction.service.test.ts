import { describe, it, expect, beforeEach } from 'vitest'
import { validateBid } from '../src/services/auction.service.js'
import type { AuctionRoom } from '../src/services/auction.service.js'
import type { Player } from '../src/db/queries/players.js'

function makePlayer(overrides?: Partial<Player>): Player {
  return {
    id: 'player-1',
    name: 'Virat Kohli',
    ipl_team: 'RCB',
    role: 'batsman',
    base_price: 200,
    nationality: 'Indian',
    image_url: null,
    ipl_season: 2025,
    is_active: true,
    ...overrides,
  }
}

function makeRoom(overrides?: Partial<AuctionRoom>): AuctionRoom {
  return {
    leagueId: 'league-1',
    sessionId: 'session-1',
    bidTimeoutSecs: 15,
    status: 'live',
    currentPlayer: makePlayer(),
    currentBid: 200,
    currentBidderId: null,
    timerExpiresAt: null,
    timer: null,
    members: new Map([
      ['user-1', {
        ws: {} as never,
        userId: 'user-1',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        remainingBudget: 1000,
        squadCount: 0,
      }],
      ['user-2', {
        ws: {} as never,
        userId: 'user-2',
        username: 'bob',
        displayName: 'Bob',
        avatarUrl: null,
        remainingBudget: 500,
        squadCount: 2,
      }],
    ]),
    connections: new Map(),
    queueRemaining: 5,
    ...overrides,
  }
}

describe('validateBid', () => {
  it('accepts valid first bid at base price', () => {
    const room = makeRoom({ currentBid: null, currentBidderId: null })
    // current bid is null, so minBid = base_price (200)
    const result = validateBid(room, 'user-1', 200)
    expect(result.valid).toBe(true)
  })

  it('accepts valid bid above current', () => {
    const room = makeRoom({ currentBid: 300, currentBidderId: 'user-2' })
    const result = validateBid(room, 'user-1', 350)
    expect(result.valid).toBe(true)
  })

  it('rejects bid when no player is nominated', () => {
    const room = makeRoom({ currentPlayer: null })
    const result = validateBid(room, 'user-1', 200)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('NOT_IN_SESSION')
  })

  it('rejects bid equal to current bid (too low)', () => {
    const room = makeRoom({ currentBid: 300, currentBidderId: 'user-2' })
    const result = validateBid(room, 'user-1', 300)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('TOO_LOW')
  })

  it('rejects bid lower than current', () => {
    const room = makeRoom({ currentBid: 400, currentBidderId: 'user-2' })
    const result = validateBid(room, 'user-1', 350)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('TOO_LOW')
  })

  it('rejects self-bid', () => {
    const room = makeRoom({ currentBid: 300, currentBidderId: 'user-1' })
    const result = validateBid(room, 'user-1', 400)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('SELF_BID')
  })

  it('rejects bid exceeding remaining budget', () => {
    const room = makeRoom({ currentBid: 400, currentBidderId: 'user-1' })
    // user-2 only has 500 budget
    const result = validateBid(room, 'user-2', 600)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('INSUFFICIENT_BUDGET')
  })

  it('rejects when room is paused', () => {
    const room = makeRoom({ status: 'paused' })
    const result = validateBid(room, 'user-1', 300)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('NOT_IN_SESSION')
  })

  it('accepts bid exactly equal to remaining budget', () => {
    const room = makeRoom({ currentBid: 400, currentBidderId: 'user-1' })
    // user-2 has 500 — bidding exactly 500 should pass
    const result = validateBid(room, 'user-2', 500)
    expect(result.valid).toBe(true)
  })
})
