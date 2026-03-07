# IPL Fantasy — Full Product Plan

## Overview

An **NFL Fantasy Football–style app for IPL cricket**. Managers join private leagues, draft players through a live auction, then compete head-to-head each week based on how their players perform in real IPL matches. The app covers the full lifecycle: sign-up → draft → weekly lineup management → trades & waivers → standings → champion.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo (TypeScript), Expo Router v4 |
| Backend | Node.js + Fastify v5 |
| Database | Supabase (PostgreSQL + Auth) |
| Real-time (auction) | Fastify WebSocket (`@fastify/websocket`) |
| Real-time (scores/matchups) | Supabase Realtime (DB change broadcasts) |
| State (mobile) | Zustand (auction + local UI) + React Query (server data) |
| Styling | NativeWind v4 (Tailwind for RN) |

---

## Project Structure (Monorepo)

```
IPLFantasyV3/
├── package.json                   # root npm workspaces
├── .gitignore
├── .env.example
├── PLAN.md                        # this file
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts               # server entry
│   │   ├── app.ts                 # Fastify factory + plugin registration
│   │   ├── config.ts              # env validation (zod)
│   │   ├── db/
│   │   │   ├── client.ts          # pg pool + supabaseAdmin/Anon clients
│   │   │   └── queries/
│   │   │       ├── players.ts
│   │   │       ├── leagues.ts
│   │   │       ├── auction.ts
│   │   │       ├── teams.ts
│   │   │       ├── schedule.ts    # ipl_schedule + weekly_matchups
│   │   │       ├── lineups.ts     # weekly_lineups
│   │   │       ├── waivers.ts
│   │   │       ├── trades.ts
│   │   │       └── leaderboard.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── leagues.ts
│   │   │   ├── players.ts
│   │   │   ├── auction.ts
│   │   │   ├── teams.ts
│   │   │   ├── schedule.ts
│   │   │   ├── lineups.ts
│   │   │   ├── waivers.ts
│   │   │   ├── trades.ts
│   │   │   ├── leaderboard.ts
│   │   │   └── scores.ts
│   │   ├── services/
│   │   │   ├── auction.service.ts # in-memory AuctionRoom, timer, bid validation
│   │   │   ├── scoring.service.ts # fantasy point calculation
│   │   │   └── schedule.service.ts# matchup generation, week lock logic
│   │   ├── ws/
│   │   │   ├── auction.ws.ts      # WS handler
│   │   │   └── types.ts           # WS message types
│   │   └── middleware/
│   │       └── auth.middleware.ts
│   └── tests/
│       ├── auction.service.test.ts
│       └── scoring.service.test.ts
│
├── mobile/
│   ├── package.json
│   ├── app.json                   # Expo config
│   ├── app/
│   │   ├── _layout.tsx            # root layout + QueryClient
│   │   ├── index.tsx              # redirect → login or home
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   └── forgot-password.tsx
│   │   └── (app)/
│   │       ├── _layout.tsx        # auth guard
│   │       ├── home.tsx           # my leagues list
│   │       ├── league/
│   │       │   ├── create.tsx
│   │       │   ├── join.tsx
│   │       │   └── [id].tsx       # league hub (stage-aware)
│   │       ├── auction/
│   │       │   └── [leagueId].tsx # live auction room
│   │       ├── lineup/
│   │       │   └── [leagueId].tsx # set/view starting 11 for current week
│   │       ├── matchup/
│   │       │   └── [leagueId].tsx # current week head-to-head + scoreboard
│   │       ├── schedule/
│   │       │   └── [leagueId].tsx # full season schedule + results
│   │       ├── team/
│   │       │   ├── [leagueId].tsx # my full 16-player roster
│   │       │   └── player/[id].tsx# player detail + season stats
│   │       ├── waivers/
│   │       │   └── [leagueId].tsx # free agent pickup / drop
│   │       ├── trades/
│   │       │   ├── [leagueId].tsx # trade hub (pending, history)
│   │       │   └── propose/[leagueId].tsx # propose a trade
│   │       └── leaderboard/
│   │           └── [leagueId].tsx # season standings
│   ├── components/
│   │   ├── ui/                    # Button, Card, Badge, TextInput, Avatar, Modal
│   │   ├── auction/               # BidPanel, CountdownTimer, BidHistory, PlayerCard, BudgetBar
│   │   ├── league/                # LeagueCard, MemberList, StageBanner
│   │   ├── lineup/                # LineupSlot, FormationGrid, LockCountdown
│   │   ├── matchup/               # MatchupCard, ScoreRow, PlayerScoreRow
│   │   ├── trade/                 # TradeCard, TradeProposalForm, PlayerPickerModal
│   │   ├── waiver/                # WaiverPlayerCard, DropPlayerModal
│   │   └── team/                  # SquadGrid, PlayerSlot, RosterRow
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useAuction.ts          # WS lifecycle → auctionStore
│   │   ├── useLeague.ts
│   │   ├── useTeam.ts
│   │   ├── useLineup.ts
│   │   ├── useMatchup.ts
│   │   ├── useWaivers.ts
│   │   └── useTrades.ts
│   ├── stores/
│   │   ├── authStore.ts           # Zustand: session + user
│   │   ├── auctionStore.ts        # Zustand: live auction state
│   │   └── leagueStore.ts         # Zustand: current league
│   └── lib/
│       ├── supabase.ts            # Supabase JS client (auth only)
│       ├── api.ts                 # typed fetch wrapper
│       └── websocket.ts           # WsManager (reconnect backoff, ping)
│
└── supabase/
    └── migrations/
        ├── 001_schema.sql
        ├── 002_rls.sql
        └── 003_seed_players.sql
```

---

## League Lifecycle (4 Stages)

```
draft_pending ──► draft_active ──► league_active ──► league_complete
     │                │                  │                  │
  League         Live auction        Weekly H2H          Season
  created,        (real-time         matchups,            over,
  waiting for     bidding)           lineups,             final
  admin to                           waivers,             standings
  start draft                        trades               frozen
```

| `leagues.status` | Meaning |
|---|---|
| `draft_pending` | League created; managers can join; admin sets up auction queue |
| `draft_active` | Auction is live; all managers bidding in real-time |
| `league_active` | Auction done; IPL season in progress; weekly matchups running |
| `league_complete` | All IPL weeks finished; standings are final |

---

## League Rules

| Rule | Value |
|---|---|
| Max teams per league | **6** |
| Max roster size | **16 players** |
| Starting lineup | **11 players** (see formation below) |
| Lineup lock | Beginning of each IPL week (first ball of week's first match) |
| Trades | Allowed during `league_active`; deadline = last 2 weeks |
| Waivers | Free agents can be claimed anytime during `league_active` |
| Scoring period | Each calendar week of IPL matches |
| Head-to-head | Each team plays every other team at least once across the season |

### Starting Lineup Formation (11 of 16)
```
5 × Batsmen
1 × Wicket-Keeper
2 × All-Rounders
3 × Bowlers
─────────────
11 total starters
```
A manager sets their lineup before the week lock. If no lineup is submitted, the previous week's lineup auto-carries (or the system picks the highest-scoring eligible players if it's the first week).

---

## Scoring System

Points are calculated per match. Each week a manager's score = sum of points earned by their **11 starters** across all IPL matches played that week.

### Batting
| Stat | Points |
|---|---|
| Run scored | +1 pt per run |
| Boundary (4) | +1 pt bonus |
| Six (6) | +2 pts bonus |
| Half-century (50–99 runs) | +10 pts bonus |
| Century (100+ runs) | +25 pts bonus |
| Duck (0, out) | −5 pts |
| Strike rate bonus (≥150 SR, min 10 balls) | +5 pts |
| Strike rate penalty (<70 SR, min 10 balls) | −5 pts |

### Bowling
| Stat | Points |
|---|---|
| Wicket (non-LBW/bowled) | +20 pts |
| Wicket (LBW or bowled) | +25 pts |
| 3-wicket haul | +10 pts bonus |
| 4-wicket haul | +20 pts bonus |
| 5-wicket haul | +30 pts bonus |
| Maiden over | +5 pts |
| Economy bonus (<6 rpo, min 4 overs) | +5 pts |
| Economy penalty (>10 rpo, min 2 overs) | −5 pts |

### Fielding
| Stat | Points |
|---|---|
| Catch | +5 pts |
| Stumping | +10 pts |
| Direct run-out | +10 pts |
| Indirect run-out | +5 pts |

### Example
> Rohit Sharma scores 82 runs off 55 balls with 6 fours and 3 sixes:
> - 82 runs = 82 pts
> - 6 fours = 6 pts
> - 3 sixes = 6 pts
> - 50+ bonus = 10 pts
> - Strike rate 149 SR → no bonus/penalty
> - **Total = 104 pts**

---

## IPL Weekly Schedule

IPL 2025 runs approximately **March–May 2025** (~74 matches across 10 league weeks + playoffs). The backend defines `ipl_weeks` — each week is a date range. All IPL matches in that range belong to that week.

```
Week 1:  Mar 22 – Mar 28
Week 2:  Mar 29 – Apr 04
Week 3:  Apr 05 – Apr 11
Week 4:  Apr 12 – Apr 18
Week 5:  Apr 19 – Apr 25
Week 6:  Apr 26 – May 02
Week 7:  May 03 – May 09
Week 8:  May 10 – May 16
Week 9:  May 17 – May 23 (playoffs)
Week 10: May 24 – May 25 (final)
```

With **6 teams**, head-to-head matchups rotate each week (3 matchups per week). The schedule is auto-generated when the league moves to `league_active`:
- Round-robin ensures every team faces every other team at least once
- Remaining weeks repeat the most balanced rotation

---

## Waivers (Free Agent Pickup)

Modeled after NFL fantasy waivers:

1. **Available players** = any player not currently on a 16-man roster
2. A manager can **drop** one of their players and simultaneously **claim** a free agent
3. A waiver claim is submitted; it processes at a configurable window (e.g., daily at midnight or instantly)
4. If two managers claim the same player, **waiver priority** (lowest in standings = highest priority) determines who wins
5. After a successful claim: dropped player enters the free agent pool immediately
6. Waiver priority resets after a successful claim (claimant drops to lowest priority)

---

## Trades

1. Manager A proposes: `{ give: [playerIds], receive: [playerIds], to: managerId }`
2. Manager B receives a notification and can **accept** or **reject**
3. On acceptance: rosters swap atomically in a Postgres transaction
4. **Trade rules:**
   - Both sides must maintain valid roster counts (≤16) after the trade
   - Trade deadline: no trades in the final 2 IPL weeks
   - Admin can veto any trade within 24 hours of acceptance (optional league setting)
5. League admin can enable/disable trades and set veto window

---

## Database Schema

### Tables

```sql
-- profiles (extends auth.users)
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- players (static IPL 2025 database, ~150 players)
CREATE TABLE players (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  ipl_team       TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('batsman','bowler','all_rounder','wicket_keeper')),
  base_price     INTEGER NOT NULL DEFAULT 200,
  nationality    TEXT NOT NULL DEFAULT 'Indian',
  image_url      TEXT,
  ipl_season     INTEGER NOT NULL DEFAULT 2025,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- leagues
CREATE TABLE leagues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  invite_code      TEXT NOT NULL UNIQUE,       -- 6-char alphanumeric
  admin_id         UUID NOT NULL REFERENCES profiles(id),
  starting_budget  INTEGER NOT NULL DEFAULT 1000,
  max_teams        INTEGER NOT NULL DEFAULT 6,
  roster_size      INTEGER NOT NULL DEFAULT 16,
  status           TEXT NOT NULL DEFAULT 'draft_pending'
                   CHECK (status IN ('draft_pending','draft_active','league_active','league_complete')),
  bid_timeout_secs INTEGER NOT NULL DEFAULT 15,
  trade_deadline_week INTEGER,                 -- no trades after this week number
  veto_hours       INTEGER NOT NULL DEFAULT 24,-- 0 = no veto period
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- league_members
CREATE TABLE league_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id        UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  remaining_budget INTEGER NOT NULL,
  roster_count     INTEGER NOT NULL DEFAULT 0,
  waiver_priority  INTEGER NOT NULL DEFAULT 0, -- lower = higher priority (resets on use)
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, user_id)
);

-- auction_sessions
CREATE TABLE auction_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id         UUID NOT NULL UNIQUE REFERENCES leagues(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','live','paused','completed')),
  current_player_id UUID REFERENCES players(id),
  current_bid       INTEGER,
  current_bidder_id UUID REFERENCES profiles(id),
  timer_expires_at  TIMESTAMPTZ,
  players_sold      INTEGER NOT NULL DEFAULT 0,
  players_unsold    INTEGER NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- auction_player_queue
CREATE TABLE auction_player_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id      UUID NOT NULL REFERENCES players(id),
  queue_position INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','live','sold','unsold')),
  sold_to        UUID REFERENCES profiles(id),
  sold_price     INTEGER,
  UNIQUE (league_id, player_id),
  UNIQUE (league_id, queue_position)
);

-- bids (append-only audit log)
CREATE TABLE bids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES auction_sessions(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id),
  bidder_id   UUID NOT NULL REFERENCES profiles(id),
  amount      INTEGER NOT NULL,
  placed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX bids_session_player_idx ON bids (session_id, player_id, placed_at DESC);

-- team_rosters (current roster — mutable via trades/waivers)
CREATE TABLE team_rosters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id),
  price_paid  INTEGER NOT NULL DEFAULT 0,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, player_id)   -- one player per league
);

-- ipl_weeks (defines the calendar week boundaries for the season)
CREATE TABLE ipl_weeks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_num   INTEGER NOT NULL UNIQUE,   -- 1, 2, 3, ...
  label      TEXT NOT NULL,             -- e.g. "Week 1"
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  lock_time  TIMESTAMPTZ NOT NULL,      -- when lineups lock (first ball of week)
  is_playoff BOOLEAN NOT NULL DEFAULT FALSE
);

-- weekly_matchups (auto-generated round-robin schedule per league)
CREATE TABLE weekly_matchups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  week_num    INTEGER NOT NULL REFERENCES ipl_weeks(week_num),
  home_user   UUID NOT NULL REFERENCES profiles(id),
  away_user   UUID NOT NULL REFERENCES profiles(id),
  home_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  away_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  winner_id   UUID REFERENCES profiles(id),  -- NULL until week finalized
  is_final    BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (league_id, week_num, home_user),
  UNIQUE (league_id, week_num, away_user)
);

-- weekly_lineups (manager's starting 11 for a given week)
CREATE TABLE weekly_lineups (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_num  INTEGER NOT NULL REFERENCES ipl_weeks(week_num),
  player_id UUID NOT NULL REFERENCES players(id),
  slot_role TEXT NOT NULL CHECK (slot_role IN ('batsman','bowler','all_rounder','wicket_keeper')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  set_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, user_id, week_num, player_id)
);

-- match_scores (one row per player per IPL match — synced from data source)
CREATE TABLE match_scores (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id          UUID NOT NULL REFERENCES players(id),
  match_id           TEXT NOT NULL,       -- IPL match identifier
  ipl_week           INTEGER REFERENCES ipl_weeks(week_num),
  match_date         DATE NOT NULL,
  -- batting
  runs_scored        INTEGER NOT NULL DEFAULT 0,
  balls_faced        INTEGER NOT NULL DEFAULT 0,
  fours              INTEGER NOT NULL DEFAULT 0,
  sixes              INTEGER NOT NULL DEFAULT 0,
  is_out             BOOLEAN NOT NULL DEFAULT FALSE,
  -- bowling
  wickets_taken      INTEGER NOT NULL DEFAULT 0,
  balls_bowled       INTEGER NOT NULL DEFAULT 0,
  runs_conceded      INTEGER NOT NULL DEFAULT 0,
  maidens            INTEGER NOT NULL DEFAULT 0,
  -- fielding
  catches            INTEGER NOT NULL DEFAULT 0,
  stumpings          INTEGER NOT NULL DEFAULT 0,
  run_outs_direct    INTEGER NOT NULL DEFAULT 0,
  run_outs_indirect  INTEGER NOT NULL DEFAULT 0,
  -- computed
  fantasy_points     DECIMAL(8,2) NOT NULL DEFAULT 0,
  raw_data           JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, match_id)
);
CREATE INDEX match_scores_week_idx ON match_scores (ipl_week, player_id);

-- waiver_claims
CREATE TABLE waiver_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  claimant_id     UUID NOT NULL REFERENCES profiles(id),
  claim_player_id UUID NOT NULL REFERENCES players(id),   -- player to pick up
  drop_player_id  UUID NOT NULL REFERENCES players(id),   -- player to drop
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','granted','denied','cancelled')),
  priority_at_submission INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- trade_proposals
CREATE TABLE trade_proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  proposer_id  UUID NOT NULL REFERENCES profiles(id),
  receiver_id  UUID NOT NULL REFERENCES profiles(id),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','rejected','vetoed','cancelled','expired')),
  veto_deadline TIMESTAMPTZ,              -- set on acceptance if veto_hours > 0
  note         TEXT,                      -- optional message from proposer
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

-- trade_items (players each side gives up)
CREATE TABLE trade_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id    UUID NOT NULL REFERENCES trade_proposals(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id),
  from_user   UUID NOT NULL REFERENCES profiles(id),   -- who gives this player
  to_user     UUID NOT NULL REFERENCES profiles(id)    -- who receives this player
);

-- leaderboard_cache (season standings — updated after each week finalizes)
CREATE TABLE leaderboard_cache (
  league_id    UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wins         INTEGER NOT NULL DEFAULT 0,
  losses       INTEGER NOT NULL DEFAULT 0,
  total_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id)
);
```

### Key DB Functions

```sql
-- Auto-create profile on Supabase Auth signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER ...

-- Generate unique 6-char invite code
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS TEXT ...

-- Calculate fantasy points from raw match stats (called on score sync)
CREATE OR REPLACE FUNCTION calc_fantasy_points(
  runs INT, balls INT, fours INT, sixes INT, is_out BOOL,
  wickets INT, balls_bowled INT, runs_conceded INT, maidens INT,
  catches INT, stumpings INT, run_outs_direct INT, run_outs_indirect INT
) RETURNS DECIMAL ...

-- Finalize a week: total points per manager, update matchup winner, refresh leaderboard
CREATE OR REPLACE FUNCTION finalize_week(p_league_id UUID, p_week_num INT) RETURNS VOID ...

-- Generate round-robin matchup schedule for a league
CREATE OR REPLACE FUNCTION generate_schedule(p_league_id UUID) RETURNS VOID ...
```

---

## Authentication

### Sign Up
Fields: **Full Name**, **Email**, **Password**

- Email + password handled by Supabase Auth
- `full_name` stored in `profiles.full_name`
- Auto-generated `username` from email prefix (editable later)
- Profile created via DB trigger on `auth.users` insert

### Sign In
Fields: **Email**, **Password**

### Forgot Password
Supabase password reset email flow.

### Auth Flow
```
Register → Supabase creates auth user → trigger creates profile → backend returns JWT + profile
Login    → Supabase signInWithPassword → backend returns JWT + profile
All API requests → Authorization: Bearer <supabase_jwt>
```

---

## Backend API Endpoints

**Auth header:** `Authorization: Bearer <supabase_jwt>` on all routes except `/auth/*`

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{ fullName, email, password }` → JWT + profile |
| POST | `/auth/login` | `{ email, password }` → JWT + profile |
| POST | `/auth/logout` | Invalidate session |
| GET | `/auth/me` | Current user profile |
| PATCH | `/auth/me` | Update `fullName`, `avatarUrl` |
| POST | `/auth/forgot-password` | Trigger Supabase reset email |

### Leagues
| Method | Path | Notes |
|---|---|---|
| GET | `/leagues` | All leagues the caller belongs to |
| POST | `/leagues` | Create league (caller becomes admin) |
| GET | `/leagues/:id` | League details + members + current stage |
| POST | `/leagues/join` | `{ inviteCode }` → join league |
| DELETE | `/leagues/:id/leave` | Leave (non-admin only) |
| DELETE | `/leagues/:id` | Delete league (admin only, draft_pending stage only) |

### Players
| Method | Path | Notes |
|---|---|---|
| GET | `/players` | All active players (`?role=&team=&search=`) |
| GET | `/players/:id` | Single player + career info |
| GET | `/leagues/:id/players/available` | Free agents (not on any roster in this league) |

### Auction
| Method | Path | Notes |
|---|---|---|
| POST | `/auction/:leagueId/setup` | Admin sets player queue order |
| POST | `/auction/:leagueId/start` | Admin starts live auction → status `draft_active` |
| POST | `/auction/:leagueId/pause` | Admin pauses |
| POST | `/auction/:leagueId/resume` | Admin resumes |
| POST | `/auction/:leagueId/complete` | Admin ends auction → status `league_active`, generates schedule |
| GET | `/auction/:leagueId/session` | Current session snapshot (queue, current player, bids) |
| GET | `/auction/:leagueId/queue` | Full player queue + sold/unsold status |
| *WS* | `/ws/auction` | Real-time: JOIN, BID, NOMINATE, PASS, PING |

### Teams / Roster
| Method | Path | Notes |
|---|---|---|
| GET | `/teams/:leagueId` | Caller's current roster (16 players) |
| GET | `/teams/:leagueId/all` | All teams' rosters (visible after `draft_active`) |
| GET | `/teams/:leagueId/:userId` | Specific manager's roster |

### Weekly Lineup
| Method | Path | Notes |
|---|---|---|
| GET | `/lineup/:leagueId/week/:week` | Caller's lineup for given week |
| POST | `/lineup/:leagueId/week/:week` | Set starting 11 (blocked after lock_time) |
| GET | `/lineup/:leagueId/week/:week/all` | All managers' lineups (visible post-lock) |

### Schedule & Matchups
| Method | Path | Notes |
|---|---|---|
| GET | `/schedule/:leagueId` | Full season matchup schedule |
| GET | `/matchup/:leagueId/current` | Current week matchup for caller |
| GET | `/matchup/:leagueId/week/:week` | Specific week's matchup + player scores |
| GET | `/matchup/:leagueId/history` | All past matchup results |

### Waivers
| Method | Path | Notes |
|---|---|---|
| GET | `/waivers/:leagueId` | Available free agents + caller's pending claims |
| POST | `/waivers/:leagueId/claim` | `{ claimPlayerId, dropPlayerId }` |
| DELETE | `/waivers/:leagueId/claim/:claimId` | Cancel a pending claim |

### Trades
| Method | Path | Notes |
|---|---|---|
| GET | `/trades/:leagueId` | All trades (pending, history) |
| POST | `/trades/:leagueId` | Propose trade `{ receivePlayerIds, givePlayerIds, toUserId, note }` |
| PATCH | `/trades/:tradeId/accept` | Receiver accepts |
| PATCH | `/trades/:tradeId/reject` | Receiver rejects |
| PATCH | `/trades/:tradeId/veto` | Admin vetoes (within veto window) |
| DELETE | `/trades/:tradeId` | Proposer cancels pending trade |

### Leaderboard & Scores
| Method | Path | Notes |
|---|---|---|
| GET | `/leaderboard/:leagueId` | Season standings (wins, losses, total pts) |
| GET | `/leaderboard/:leagueId/week/:week` | Single-week points per manager |
| POST | `/scores/sync` | Admin/cron: ingest match stats, trigger point calc + week finalize |

---

## Real-Time Auction (WebSocket)

Bid placement is **WebSocket-only** (not HTTP) to handle atomic race conditions server-side.

### Client → Server
```typescript
{ type: "JOIN",     leagueId: string, token: string }
{ type: "BID",      leagueId: string, amount: number }
{ type: "NOMINATE", leagueId: string, playerId: string }  // admin only
{ type: "PASS",     leagueId: string }                    // admin only — marks player unsold
{ type: "PING" }
```

### Server → Client (broadcast to room unless noted)
```typescript
{ type: "SESSION_STATE",    sessionId, status, player, currentBid, currentBidder, timerExpiresAt, members, queueRemaining }
{ type: "BID_ACCEPTED",     bidder, amount, timerExpiresAt }
{ type: "BID_REJECTED",     reason }          // only to bidder
{ type: "PLAYER_SOLD",      player, winner, price, members }
{ type: "PLAYER_UNSOLD",    player }
{ type: "PLAYER_NOMINATED", player, basePrice, timerExpiresAt }
{ type: "SESSION_STATUS",   status: "live" | "paused" | "completed" }
{ type: "ERROR",            message }
{ type: "PONG" }
```

### Timer Logic
1. Admin sends `NOMINATE` → `timerExpiresAt = now + bid_timeout_secs`, `setTimeout` starts
2. Valid `BID` arrives → clear timer, reset `timerExpiresAt`, restart timer, broadcast `BID_ACCEPTED`
3. Timer fires:
   - `currentBidder != null` → `PLAYER_SOLD` + Postgres transaction (deduct budget, insert roster, update queue)
   - `currentBidder === null` → `PLAYER_UNSOLD`

---

## Mobile Screens

```
── Auth ──────────────────────────────────────────────────────────────
(auth)/login.tsx           Email + password sign in
(auth)/register.tsx        Full name + email + password sign up
(auth)/forgot-password.tsx Reset password email

── Core ──────────────────────────────────────────────────────────────
(app)/home.tsx             My leagues list + create/join FABs
(app)/league/create.tsx    Name, budget, roster size, timer settings
(app)/league/join.tsx      6-character invite code entry
(app)/league/[id].tsx      League hub — stage-aware navigation center

── Draft ─────────────────────────────────────────────────────────────
(app)/auction/[leagueId].tsx
  Top:    PlayerCard (photo, name, IPL team, role, base price)
  Mid:    Current bid + bidder avatar + CountdownTimer ring + BidHistory
  Bottom: BudgetBar + quick-bid buttons + custom bid input + BID button
  Admin:  NOMINATE / PASS / PAUSE controls

── Season ────────────────────────────────────────────────────────────
(app)/lineup/[leagueId].tsx
  Set starting 11 from 16-player roster
  Shows: slot requirements (5B/1WK/2AR/3BO), lock countdown
  Post-lock: view mode only

(app)/matchup/[leagueId].tsx
  Current week H2H: my team vs opponent
  Live point totals updating as matches are scored
  Per-player rows: name, today's score, weekly total

(app)/schedule/[leagueId].tsx
  Full season: all weeks, opponents, scores, W/L record

(app)/team/[leagueId].tsx
  My 16-player roster: name, role, IPL team, price paid
  Links to trade propose, waiver drop

(app)/team/player/[id].tsx
  Player detail: career stats, this season stats, weekly fantasy points

(app)/waivers/[leagueId].tsx
  Two tabs: Available Players | My Pending Claims
  Claim flow: pick up → select player to drop → confirm

(app)/trades/[leagueId].tsx
  Three tabs: Incoming | Outgoing | History
  Accept/reject on incoming

(app)/trades/propose/[leagueId].tsx
  Pick opponent → select players to give → select players to receive → send

(app)/leaderboard/[leagueId].tsx
  Season standings: rank, manager name, W-L, total points
```

---

## Key Dependencies

### Backend
- `fastify` v5, `@fastify/cors` v11, `@fastify/helmet` v13, `@fastify/jwt` v10, `@fastify/rate-limit` v10, `@fastify/websocket` v11
- `@supabase/supabase-js` v2, `pg` v8 (raw SQL — needed for auction transactions)
- `zod` v3, `uuid` v10, `dotenv` v16
- Dev: `typescript`, `tsx`, `vitest`, `supertest`

### Mobile
- `expo` ~52, `expo-router` ~4, `react-native` 0.76.9
- `@supabase/supabase-js` v2, `expo-secure-store`
- `zustand` v5, `@tanstack/react-query` v5
- `nativewind` v4, `tailwindcss` v3
- `react-native-reanimated` ~3.16, `react-native-gesture-handler` ~2.20
- Dev: `typescript`, `jest-expo`, `@testing-library/react-native`

---

## Development Setup Order

1. **Supabase**: Create project → run migrations 001, 002, 003 in order
2. **Backend**: `cp .env.example .env`, fill in real Supabase values, `npm run dev --workspace=backend`
3. **Mobile**: `cp .env.example .env`, fill in values, `npm run start --workspace=mobile`
4. **Test auth**: Register two accounts, verify profiles appear in Supabase dashboard
5. **Test draft**: Create league, join with second account, run auction, verify rosters
6. **Test season**: Sync mock match scores, verify points appear, test lineup lock

---

## Verification Checklist

### Authentication
```
□ Register with full name, email, password → profile created in DB
□ Login → JWT stored in SecureStore → all API calls authenticated
□ Forgot password → email received → reset works
□ Logout → token cleared → redirected to login
```

### League & Draft
```
□ Create league → 6-char invite code displayed
□ Second account joins via invite code → appears in member list
□ Admin sets up auction queue with 20 players
□ Admin starts auction → status = draft_active → both clients see live room
□ User A bids 300 → both clients update, timer resets
□ User B outbids → both clients update
□ Timer expires → PLAYER_SOLD toast on both → budgets deducted in DB
□ All players sold/passed → admin completes auction → status = league_active
□ Weekly schedule auto-generated (3 matchups for 6 teams)
```

### Season
```
□ Week 1 starts → managers can set lineups
□ Lineup lock time passes → lineup changes rejected
□ Mock match scores synced → fantasy points appear on matchup screen
□ Week finalizes → W/L updated in leaderboard
□ Waiver: claim free agent, drop player → rosters update
□ Trade: propose → receive notification → accept → rosters swap atomically
□ Trade after deadline → rejected
□ All 10 weeks done → status = league_complete → standings frozen
```

### iOS App Store Pre-flight
```
□ iOS deployment target ≥ 16 (set in app.json + eas.json)
□ eas.json production profile configured
□ PrivacyInfo.xcprivacy added (network activity)
□ Push notification entitlement configured (trade/waiver notifications)
□ App icons + splash screen assets present
```
