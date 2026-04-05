/**
 * seed-auction-league.ts
 *
 * Creates a league in league_active state with 4 members (3 random + the admin).
 * Each member gets 10 role-balanced players (4 BAT / 1 WK / 2 AR / 3 BOW).
 * All remaining players are added to the auction queue as pending free agents,
 * giving a large pool for the Players tab and waivers.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/seed-auction-league.ts
 */

import 'dotenv/config'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const { Pool } = pg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const STARTING_BUDGET = 5000
const LEAGUE_NAMES = [
  'Rajput Cricket Kings',
  'Bombay Blasters FC',
  'Chennai Storm League',
  'Delhi Dynamos Fantasy',
  'Punjab Power League',
  'Kolkata Night Riders FC',
]
const LEAGUE_NAME = LEAGUE_NAMES[Math.floor(Math.random() * LEAGUE_NAMES.length)]

// Role distribution per team — must sum to PLAYERS_PER_TEAM
const ROLE_DISTRIBUTION: Record<string, number> = {
  batsman:       4,
  wicket_keeper: 1,
  all_rounder:   2,
  bowler:        3,
}
const PLAYERS_PER_TEAM = Object.values(ROLE_DISTRIBUTION).reduce((a, b) => a + b, 0)

// ---------------------------------------------------------------------------
// Fixed users — created once, reused on every seed run.
// ---------------------------------------------------------------------------
const FIXED_USERS = [
  {
    id: '364bba26-47eb-414e-8af3-6b497fecd864',
    email: 'admin@iplseed.local',
    displayName: 'Admin (You)',
    isAdmin: true,
  },
  {
    id: 'aaaaaaaa-0001-4000-8000-000000000001',
    email: 'seed1@iplseed.local',
    displayName: 'Seed User 1',
    isAdmin: false,
  },
  {
    id: 'aaaaaaaa-0001-4000-8000-000000000002',
    email: 'seed2@iplseed.local',
    displayName: 'Seed User 2',
    isAdmin: false,
  },
  {
    id: 'aaaaaaaa-0001-4000-8000-000000000003',
    email: 'seed3@iplseed.local',
    displayName: 'Seed User 3',
    isAdmin: false,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function randomPrice(base: number): number {
  // Simulate a bid: base + up to 50% more, rounded to 10
  return Math.round((base + Math.floor(Math.random() * (base * 0.5 / 10)) * 10) / 10) * 10
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const client = await pool.connect()

  try {
    // -----------------------------------------------------------------------
    // 1. Ensure all fixed users exist in auth + profiles (idempotent)
    // -----------------------------------------------------------------------
    console.log('Ensuring fixed users exist…')
    for (const u of FIXED_USERS) {
      const { data: existing } = await supabaseAdmin.auth.admin.getUserById(u.id)
      if (!existing?.user) {
        const { error } = await supabaseAdmin.auth.admin.createUser({
          id: u.id,
          email: u.email,
          password: 'Seed1234!',
          email_confirm: true,
          user_metadata: { display_name: u.displayName },
        })
        if (error) throw new Error(`Failed to create auth user ${u.displayName}: ${error.message}`)
        console.log(`  Created: ${u.displayName} (${u.id})`)
      } else {
        console.log(`  Already exists: ${u.displayName} (${u.id})`)
      }

      if (!u.isAdmin) {
        await client.query(
          `INSERT INTO profiles (id, username, display_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
          [u.id, u.email, u.displayName]
        )
      }
    }

    const allMemberIds = FIXED_USERS.map(u => u.id)

    // -----------------------------------------------------------------------
    // 2. Create the league (league_active — post-draft season underway)
    // -----------------------------------------------------------------------
    console.log(`\nCreating league "${LEAGUE_NAME}"…`)
    const leagueId = randomUUID()
    await client.query(
      `INSERT INTO leagues (id, name, invite_code, admin_id, starting_budget, max_squad_size, max_teams, status, bid_timeout_secs)
       VALUES ($1, $2, $3, $4, $5, 16, 6, 'league_active', 15)`,
      [leagueId, LEAGUE_NAME, inviteCode(), FIXED_USERS[0].id, STARTING_BUDGET]
    )
    console.log(`  League ID: ${leagueId}`)

    // -----------------------------------------------------------------------
    // 3. Add all 4 users as league members
    // -----------------------------------------------------------------------
    console.log('\nAdding league members…')
    for (const userId of allMemberIds) {
      await client.query(
        `INSERT INTO league_members (league_id, user_id, remaining_budget, roster_count)
         VALUES ($1, $2, $3, 0)`,
        [leagueId, userId, STARTING_BUDGET]
      )
    }

    // -----------------------------------------------------------------------
    // 4. Pick role-balanced players for each team
    //    Fetch (count * numTeams) per role so we can slice per member.
    // -----------------------------------------------------------------------
    console.log(`\nSelecting ${PLAYERS_PER_TEAM} role-balanced players per team…`)

    const playersByRole: Record<string, Array<{ id: string; name: string; base_price: number; role: string }>> = {}
    for (const [role, countPerTeam] of Object.entries(ROLE_DISTRIBUTION)) {
      const needed = countPerTeam * allMemberIds.length
      const { rows } = await client.query(
        `SELECT id, name, base_price, role FROM players
         WHERE is_active = true AND role = $1
         ORDER BY random()
         LIMIT $2`,
        [role, needed]
      )
      if (rows.length < needed) {
        throw new Error(
          `Not enough active ${role} players. Need ${needed}, only ${rows.length} in DB.`
        )
      }
      playersByRole[role] = rows
      console.log(`  ${role}: picked ${rows.length} players`)
    }

    // Build per-team arrays: [team0: [bat×4, wk×1, ar×2, bow×3], team1: …]
    const teamPlayers: Array<Array<{ id: string; name: string; base_price: number; role: string }>> =
      allMemberIds.map(() => [])

    for (const [role, players] of Object.entries(playersByRole)) {
      const countPerTeam = ROLE_DISTRIBUTION[role]!
      for (let ti = 0; ti < allMemberIds.length; ti++) {
        teamPlayers[ti]!.push(...players.slice(ti * countPerTeam, (ti + 1) * countPerTeam))
      }
    }

    // -----------------------------------------------------------------------
    // 5. Create a completed auction session
    // -----------------------------------------------------------------------
    console.log('\nCreating completed auction session…')
    const sessionId = randomUUID()
    const totalSold = allMemberIds.length * PLAYERS_PER_TEAM
    await client.query(
      `INSERT INTO auction_sessions (id, league_id, status, players_sold, players_unsold, started_at, completed_at)
       VALUES ($1, $2, 'completed', $3, 0, NOW() - INTERVAL '2 hours', NOW())`,
      [sessionId, leagueId, totalSold]
    )

    // -----------------------------------------------------------------------
    // 6. Assign players to teams: queue entries + rosters + deduct budgets
    // -----------------------------------------------------------------------
    console.log('\nAssigning players to teams…')
    let queuePos = 1
    for (let ti = 0; ti < allMemberIds.length; ti++) {
      const userId = allMemberIds[ti]!
      let spent = 0

      for (const player of teamPlayers[ti]!) {
        const price = randomPrice(player.base_price)
        spent += price

        await client.query(
          `INSERT INTO auction_player_queue (league_id, player_id, queue_position, status, sold_to, sold_price)
           VALUES ($1, $2, $3, 'sold', $4, $5)`,
          [leagueId, player.id, queuePos++, userId, price]
        )

        await client.query(
          `INSERT INTO team_rosters (league_id, user_id, player_id, price_paid)
           VALUES ($1, $2, $3, $4)`,
          [leagueId, userId, player.id, price]
        )

        await client.query(
          `INSERT INTO bids (session_id, player_id, bidder_id, amount)
           VALUES ($1, $2, $3, $4)`,
          [sessionId, player.id, userId, price]
        )

        console.log(`  [team ${ti + 1}] ${player.role.padEnd(14)} ${player.name.padEnd(30)} → $${price}`)
      }

      await client.query(
        `UPDATE league_members
         SET remaining_budget = remaining_budget - $1, roster_count = $2
         WHERE league_id = $3 AND user_id = $4`,
        [spent, PLAYERS_PER_TEAM, leagueId, userId]
      )
      console.log(`  Team ${ti + 1} total spent: $${spent} (remaining: $${STARTING_BUDGET - spent})`)
    }

    // -----------------------------------------------------------------------
    // 7. Add ALL remaining active players to the queue as pending free agents
    // -----------------------------------------------------------------------
    console.log('\nAdding remaining players to queue as free agents…')
    const { rows: freeAgents } = await client.query(
      `SELECT id, name, role FROM players
       WHERE is_active = true
         AND id NOT IN (SELECT player_id FROM auction_player_queue WHERE league_id = $1)
       ORDER BY role, name`,
      [leagueId]
    )
    for (const p of freeAgents) {
      await client.query(
        `INSERT INTO auction_player_queue (league_id, player_id, queue_position, status)
         VALUES ($1, $2, $3, 'pending')`,
        [leagueId, p.id, queuePos++]
      )
    }
    console.log(`  Added ${freeAgents.length} free agents to queue`)

    // -----------------------------------------------------------------------
    // 8. Generate schedule (weekly matchups)
    // -----------------------------------------------------------------------
    console.log('\nGenerating league schedule…')
    await client.query(`SELECT generate_schedule($1)`, [leagueId])
    const { rows: matchupRows } = await client.query(
      `SELECT week_num, home_user, away_user FROM weekly_matchups WHERE league_id = $1 ORDER BY week_num`,
      [leagueId]
    )
    console.log(`  Created ${matchupRows.length} matchups across all weeks`)

    // -----------------------------------------------------------------------
    // 9. Set lineups for week 1 for every team
    //    Pick 11 starters: 3 BAT, 1 WK, 1 AR, 3 BOW, 3 FLEX
    // -----------------------------------------------------------------------
    console.log('\nSetting week 1 lineups…')
    const LINEUP_SLOTS: Array<{ role: string; count: number; slotRole: string }> = [
      { role: 'batsman',       count: 3, slotRole: 'batsman' },
      { role: 'wicket_keeper', count: 1, slotRole: 'wicket_keeper' },
      { role: 'all_rounder',   count: 1, slotRole: 'all_rounder' },
      { role: 'bowler',        count: 3, slotRole: 'bowler' },
    ]
    // Remaining slots as flex (up to 3 from leftover roster players)
    const STARTERS_FROM_ROLES = LINEUP_SLOTS.reduce((s, l) => s + l.count, 0) // 8
    const FLEX_SLOTS = 3
    const TOTAL_STARTERS = STARTERS_FROM_ROLES + FLEX_SLOTS // 11

    for (const userId of allMemberIds) {
      const { rows: roster } = await client.query(
        `SELECT tr.player_id, p.role FROM team_rosters tr
         JOIN players p ON p.id = tr.player_id
         WHERE tr.league_id = $1 AND tr.user_id = $2`,
        [leagueId, userId]
      )

      const used = new Set<string>()
      const entries: Array<{ playerId: string; slotRole: string }> = []

      // Fill role-specific slots
      for (const slot of LINEUP_SLOTS) {
        const eligible = roster.filter(r => r.role === slot.role && !used.has(r.player_id))
        for (let i = 0; i < slot.count && i < eligible.length; i++) {
          entries.push({ playerId: eligible[i].player_id, slotRole: slot.slotRole })
          used.add(eligible[i].player_id)
        }
      }

      // Fill flex slots with remaining roster players
      const remaining = roster.filter(r => !used.has(r.player_id))
      for (let i = 0; i < FLEX_SLOTS && i < remaining.length; i++) {
        entries.push({ playerId: remaining[i].player_id, slotRole: 'flex' })
        used.add(remaining[i].player_id)
      }

      // Insert lineup rows
      for (const e of entries) {
        await client.query(
          `INSERT INTO weekly_lineups (league_id, user_id, week_num, player_id, slot_role)
           VALUES ($1, $2, 1, $3, $4)`,
          [leagueId, userId, e.playerId, e.slotRole]
        )
      }
      console.log(`  ${userId.slice(0, 8)}… → ${entries.length} starters set`)
    }

    // -----------------------------------------------------------------------
    // 10. Backfill ipl_week on existing match_scores that are missing it
    // -----------------------------------------------------------------------
    console.log('\nBackfilling ipl_week on existing match_scores…')
    const { rowCount: backfilled } = await client.query(
      `UPDATE match_scores ms
       SET ipl_week = im.week_num
       FROM ipl_matches im
       WHERE im.match_id = ms.match_id AND ms.ipl_week IS NULL`
    )
    console.log(`  Updated ${backfilled ?? 0} rows`)

    // -----------------------------------------------------------------------
    // 11. Done
    // -----------------------------------------------------------------------
    console.log('\n✅ Done!')
    console.log(`   League:      ${LEAGUE_NAME}`)
    console.log(`   League ID:   ${leagueId}`)
    console.log(`   Session ID:  ${sessionId}`)
    console.log(`   Status:      league_active`)
    console.log(`   Roster size: ${PLAYERS_PER_TEAM} per team (${allMemberIds.length} teams)`)
    console.log(`   Free agents: ${freeAgents.length}`)
    console.log(`   Lineups:     week 1 set for all ${allMemberIds.length} teams`)
    console.log(`   Members:     ${allMemberIds.join(', ')}`)

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
