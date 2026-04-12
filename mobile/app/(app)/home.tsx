import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Dimensions, NativeSyntheticEvent, NativeScrollEvent, Pressable, Modal } from 'react-native'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { CreateLeagueModal } from '../../components/league/CreateLeagueModal'
import { JoinLeagueModal } from '../../components/league/JoinLeagueModal'
import { useLeagues } from '../../hooks/useLeague'
import { useHomeSummary } from '../../hooks/useMatchup'
import { useAuthStore } from '../../stores/authStore'
import { LoadingSpinner } from '../../components/ui/Loading'
import { isSuperAdmin } from '../../lib/adminApi'
import { formatCurrency } from '../../lib/currency'
import * as SecureStore from 'expo-secure-store'
import type { League } from '../../stores/leagueStore'
import type { HomeSummaryEntry, CurrentMatchInfo } from '../../hooks/useMatchup'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_PAGE, BG_CARD,
  PRIMARY, PRIMARY_SOFT, PRIMARY_BORDER,
  SUCCESS, SUCCESS_BG,
  BG_DARK_HEADER,
  INFO, INFO_BG,
} from '../../constants/colors'

const LAST_LEAGUE_KEY = 'last_viewed_league_id'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const TEAM_ABBREV: Record<string, string> = {
  'Chennai Super Kings': 'CSK', 'Mumbai Indians': 'MI',
  'Royal Challengers Bengaluru': 'RCB', 'Royal Challengers Bangalore': 'RCB',
  'Kolkata Knight Riders': 'KKR', 'Delhi Capitals': 'DC',
  'Rajasthan Royals': 'RR', 'Punjab Kings': 'PBKS',
  'Sunrisers Hyderabad': 'SRH', 'Lucknow Super Giants': 'LSG',
  'Gujarat Titans': 'GT',
}

// ── Card components ────────────────────────────────────────────────────────────

function DraftPendingCard({ league, onPress }: { league: League; onPress: () => void }) {
  return (
    <View style={{ backgroundColor: BG_CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
      <View style={{ backgroundColor: BG_DARK_HEADER, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 18, flex: 1 }} numberOfLines={1}>{league.name}</Text>
        <View style={{ backgroundColor: TEXT_SECONDARY, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 10 }}>
          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700' }}>PENDING</Text>
        </View>
      </View>

      <View style={{ padding: 20, gap: 20 }}>
        {/* Invite code — prominent */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>INVITE CODE</Text>
          <Text style={{ color: PRIMARY, fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 3 }}>
            {league.invite_code}
          </Text>
          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>Share with friends to join</Text>
        </View>

        <View style={{ height: 1, backgroundColor: BORDER_DEFAULT }} />

        {/* League settings */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>SQUAD</Text>
            <Text style={{ color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', marginTop: 4 }}>{league.max_squad_size}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: BORDER_DEFAULT }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>TEAMS</Text>
            <Text style={{ color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', marginTop: 4 }}>{league.max_teams}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onPress}
          style={{ backgroundColor: TEXT_PRIMARY, borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Open League</Text>
          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 16 }}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function DraftActiveCard({ league, onPress }: { league: League; onPress: () => void }) {
  return (
    <View style={{ backgroundColor: BG_CARD, borderRadius: 20, borderWidth: 2, borderColor: PRIMARY_BORDER, overflow: 'hidden' }}>
      <View style={{ backgroundColor: '#7f1d1d', paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 18, flex: 1 }} numberOfLines={1}>{league.name}</Text>
        <View style={{ backgroundColor: PRIMARY, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fca5a5' }} />
          <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>DRAFT LIVE</Text>
        </View>
      </View>

      <View style={{ padding: 24, gap: 20, alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 48 }}>🏏</Text>
          <Text style={{ color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' }}>Auction is live!</Text>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            Your squad is waiting to be built.{'\n'}Join the auction room now.
          </Text>
        </View>

        <TouchableOpacity
          onPress={onPress}
          style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32, alignItems: 'center' }}
        >
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Enter Auction Room →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function ActiveLeagueCard({
  league, summary, currentMatch, weekNum, userId, onPress,
}: {
  league: League
  summary: HomeSummaryEntry | null
  currentMatch: CurrentMatchInfo | null
  weekNum: number | null
  userId: string | undefined
  onPress: () => void
}) {
  const matchup = summary?.matchup
  const myPlayers = summary?.myPlayers ?? []
  // oppPlayers not needed — weekly totals come from matchup.home_points/away_points

  const amHome = matchup ? userId === matchup.home_user : true
  const myPts = matchup ? parseFloat(String(amHome ? matchup.home_points : matchup.away_points)) || 0 : 0
  const oppPts = matchup ? parseFloat(String(amHome ? matchup.away_points : matchup.home_points)) || 0 : 0
  const oppName = matchup
    ? amHome
      ? (matchup.away_team_name || matchup.away_full_name || matchup.away_username)
      : (matchup.home_team_name || matchup.home_full_name || matchup.home_username)
    : null

  const isLive = currentMatch?.status === 'live'
  const myPlayersInMatch = myPlayers.filter(
    p => p.playerTeam === currentMatch?.home_team || p.playerTeam === currentMatch?.away_team
  )

  return (
    <View style={{ backgroundColor: BG_CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
      <View style={{ backgroundColor: BG_DARK_HEADER, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 18, flex: 1 }} numberOfLines={1}>{league.name}</Text>
        {weekNum && (
          <View style={{ backgroundColor: '#14532d', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 10 }}>
            <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '700' }}>WEEK {weekNum}</Text>
          </View>
        )}
      </View>

      <View style={{ padding: 16, gap: 14 }}>
        {/* Matchup score block */}
        {matchup ? (
          <View style={{ backgroundColor: BG_PAGE, borderRadius: 14, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* My side */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '600' }}>YOU</Text>
                <Text style={{ color: TEXT_PRIMARY, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 }}>
                  {myPts.toFixed(1)}
                </Text>
              </View>

              {/* Middle */}
              <View style={{ alignItems: 'center', paddingHorizontal: 12 }}>
                <Text style={{ color: TEXT_DISABLED, fontSize: 12, fontWeight: '600' }}>VS</Text>
              </View>

              {/* Opp side */}
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{oppName?.toUpperCase()}</Text>
                <Text style={{ color: TEXT_PRIMARY, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 }}>
                  {oppPts.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: BG_PAGE, borderRadius: 14, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 13 }}>No matchup scheduled this week</Text>
          </View>
        )}

        {/* Live match + my players in it */}
        {currentMatch && myPlayersInMatch.length > 0 && (
          <View style={{ borderWidth: 1, borderColor: BORDER_DEFAULT, borderRadius: 12, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isLive && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: PRIMARY }} />}
              <Text style={{ color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700' }}>
                {isLive ? 'LIVE · ' : 'TODAY · '}
                {TEAM_ABBREV[currentMatch.home_team] ?? currentMatch.home_team}
                {' vs '}
                {TEAM_ABBREV[currentMatch.away_team] ?? currentMatch.away_team}
              </Text>
              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginLeft: 'auto' }}>
                {myPlayersInMatch.length} {myPlayersInMatch.length === 1 ? 'player' : 'players'}
              </Text>
            </View>
            <View style={{ gap: 5 }}>
              {myPlayersInMatch.slice(0, 3).map(p => (
                <View key={p.playerId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#4b5563', fontSize: 12 }} numberOfLines={1}>{p.playerName}</Text>
                  <Text style={{ color: p.points > 0 ? SUCCESS : TEXT_PLACEHOLDER, fontSize: 12, fontWeight: '700' }}>
                    {p.points > 0 ? `+${p.points.toFixed(1)}` : '–'}
                  </Text>
                </View>
              ))}
              {myPlayersInMatch.length > 3 && (
                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>
                  +{myPlayersInMatch.length - 3} more
                </Text>
              )}
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={onPress}
          style={{ backgroundColor: TEXT_PRIMARY, borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Open League</Text>
          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 16 }}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function CompleteLeagueCard({ league, onPress }: { league: League; onPress: () => void }) {
  return (
    <View style={{ backgroundColor: BG_CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
      <View style={{ backgroundColor: BG_DARK_HEADER, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 18, flex: 1 }} numberOfLines={1}>{league.name}</Text>
        <View style={{ backgroundColor: INFO_BG, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 10 }}>
          <Text style={{ color: INFO, fontSize: 11, fontWeight: '700' }}>COMPLETE</Text>
        </View>
      </View>
      <View style={{ padding: 24, gap: 20, alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 48 }}>🏆</Text>
          <Text style={{ color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' }}>Season Complete</Text>
          <Text style={{ color: TEXT_MUTED, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            The IPL fantasy season has wrapped up.{'\n'}Check the final standings.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onPress}
          style={{ backgroundColor: TEXT_PRIMARY, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32, alignItems: 'center' }}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>View Standings →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Home screen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { data: leagues, isLoading: leaguesLoading, refetch: refetchLeagues, isRefetching: leaguesRefetching } = useLeagues()
  const { data: summary, refetch: refetchSummary, isRefetching: summaryRefetching } = useHomeSummary()
  const superAdmin = isSuperAdmin(user)

  const [activeIndex, setActiveIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [leagueMenuOpen, setLeagueMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const isRefetching = leaguesRefetching || summaryRefetching
  const carouselRef = useRef<ScrollView>(null)
  const hasRestoredRef = useRef(false)

  // Restore last-viewed league once leagues load
  useEffect(() => {
    if (hasRestoredRef.current || !leagues || leagues.length === 0) return
    hasRestoredRef.current = true
    SecureStore.getItemAsync(LAST_LEAGUE_KEY).then(savedId => {
      if (!savedId) return
      const idx = leagues.findIndex(l => l.id === savedId)
      if (idx > 0) {
        // Defer so the ScrollView has laid out before we scroll
        setTimeout(() => {
          carouselRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: false })
          setActiveIndex(idx)
        }, 0)
      }
    })
  }, [leagues])

  const onRefresh = useCallback(() => {
    refetchLeagues()
    refetchSummary()
  }, [refetchLeagues, refetchSummary])

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    setActiveIndex(idx)
  }

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    setActiveIndex(idx)
    const leagueId = leagueList[idx]?.id
    if (leagueId) SecureStore.setItemAsync(LAST_LEAGUE_KEY, leagueId)
  }

  const closeMenu = () => setMenuOpen(false)

  const summaryByLeagueId = new Map(
    (summary?.matchups ?? []).map(m => [m.leagueId, m])
  )

  const leagueList = leagues ?? []

  function renderCard(league: League) {
    const go = () => router.push(`/(app)/league/${league.id}`)
    switch (league.status) {
      case 'draft_pending':
        return <DraftPendingCard key={league.id} league={league} onPress={go} />
      case 'draft_active':
        return <DraftActiveCard key={league.id} league={league} onPress={go} />
      case 'league_active':
        return (
          <ActiveLeagueCard
            key={league.id}
            league={league}
            summary={summaryByLeagueId.get(league.id) ?? null}
            currentMatch={summary?.currentMatch ?? null}
            weekNum={summary?.currentWeekNum ?? null}
            userId={user?.id}
            onPress={go}
          />
        )
      case 'league_complete':
        return <CompleteLeagueCard key={league.id} league={league} onPress={go} />
      default:
        return <DraftPendingCard key={league.id} league={league} onPress={go} />
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={PRIMARY_SOFT} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: TEXT_MUTED, fontSize: 13 }}>Welcome back,</Text>
            <Text style={{ color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' }}>
              {user?.display_name ?? user?.full_name ?? user?.username ?? 'Player'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {superAdmin && (
              <TouchableOpacity
                onPress={() => router.push('/(app)/superadmin')}
                style={{ backgroundColor: TEXT_PRIMARY, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
              >
                <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>⚙ Admin</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setMenuOpen(true)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: BORDER_DEFAULT, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 18, color: TEXT_SECONDARY, lineHeight: 22 }}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* League section */}
        <View style={{ paddingTop: 16 }}>
          <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 17 }}>My Leagues</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {leagueList.length > 1 && (
                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>{activeIndex + 1} of {leagueList.length}</Text>
              )}
              <TouchableOpacity
                onPress={() => setLeagueMenuOpen(true)}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: 9, height: 1.5, backgroundColor: 'white', position: 'absolute' }} />
                <View style={{ width: 1.5, height: 9, backgroundColor: 'white', position: 'absolute' }} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dot indicators */}
          {leagueList.length > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
              {leagueList.map((_, i) => (
                <View
                  key={i}
                  style={{
                    height: 6,
                    borderRadius: 3,
                    width: i === activeIndex ? 22 : 6,
                    backgroundColor: i === activeIndex ? PRIMARY : TEXT_DISABLED,
                  }}
                />
              ))}
            </View>
          )}

          {/* Slideshow */}
          {leaguesLoading ? (
            <View style={{ paddingVertical: 40 }}>
              <LoadingSpinner />
            </View>
          ) : leagueList.length === 0 ? (
            <View style={{ paddingTop: 48, paddingHorizontal: 40, alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 44 }}>🏏</Text>
              <Text style={{ color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700' }}>No leagues yet</Text>
              <Text style={{ color: TEXT_MUTED, fontSize: 14, textAlign: 'center' }}>
                Create a new league or join one with an invite code
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleMomentumScrollEnd}
            >
              {leagueList.map(league => (
                <View key={league.id} style={{ width: SCREEN_WIDTH, paddingHorizontal: 16 }}>
                  {renderCard(league)}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Dropdown menu */}
      <Modal visible={menuOpen} transparent animationType="none" onRequestClose={closeMenu}>
        <Pressable style={{ flex: 1 }} onPress={closeMenu}>
          <View style={{ position: 'absolute', top: 72, right: 20, width: 220, backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8, overflow: 'hidden' }}>

            {/* Profile row */}
            <TouchableOpacity
              onPress={() => { closeMenu(); router.push('/(app)/profile') }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}
            >
              <View>
                <Text style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' }}>Profile</Text>
                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{user?.username}</Text>
              </View>
              <Text style={{ color: TEXT_DISABLED, fontSize: 18 }}>›</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: BORDER_DEFAULT }} />

            {/* Settings row */}
            <TouchableOpacity
              onPress={closeMenu}
              style={{ paddingHorizontal: 16, paddingVertical: 14 }}
            >
              <Text style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' }}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <CreateLeagueModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinLeagueModal visible={joinOpen} onClose={() => setJoinOpen(false)} />

      {/* League action modal */}
      <Modal visible={leagueMenuOpen} transparent animationType="fade" onRequestClose={() => setLeagueMenuOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setLeagueMenuOpen(false)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={{
              backgroundColor: BG_CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingTop: 12, paddingHorizontal: 20, paddingBottom: 36,
            }}>
              {/* Handle */}
              <View style={{ width: 36, height: 4, backgroundColor: BORDER_MEDIUM, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

              <Text style={{ color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginBottom: 16 }}>Add a League</Text>

              <TouchableOpacity
                onPress={() => { setLeagueMenuOpen(false); setCreateOpen(true) }}
                style={{
                  backgroundColor: PRIMARY, borderRadius: 16,
                  paddingVertical: 18, paddingHorizontal: 20,
                  flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Create a League</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>Set up a new league and invite friends</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setLeagueMenuOpen(false); setJoinOpen(true) }}
                style={{
                  backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1.5, borderColor: BORDER_MEDIUM,
                  paddingVertical: 18, paddingHorizontal: 20,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 16 }}>Join a League</Text>
                  <Text style={{ color: TEXT_MUTED, fontSize: 13, marginTop: 2 }}>Enter an invite code to join</Text>
                </View>
                <Text style={{ color: TEXT_DISABLED, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
