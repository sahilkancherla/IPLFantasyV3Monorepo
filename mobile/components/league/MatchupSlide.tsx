import { View, Text, ScrollView, Modal, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { NavButton } from '../ui/NavButton'
import { useState, useCallback } from 'react'
import { useLineup, useUserLineup, useSetLineup, useGameBreakdown } from '../../hooks/useLineup'
import type { LineupEntry } from '../../hooks/useLineup'
import { GameBreakdownSection } from './GameBreakdownSection'
import type { Matchup, IplWeek } from '../../hooks/useMatchup'
import { useWeekMatches } from '../../hooks/useMatchup'
import { useMyTeam, useAllTeams } from '../../hooks/useTeam'
import { ROLE_ORDER } from './LineupCard'
import { MatchupView } from './MatchupView'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT,
  BG_PAGE, BG_CARD, BG_DARK_HEADER,
  PRIMARY, PRIMARY_SOFT, PRIMARY_BORDER, PRIMARY_SUBTLE,
  matchStatusColors,
} from '../../constants/colors'

const EMPTY_LINEUP: LineupEntry[] = []

interface Props {
  matchup: Matchup | null
  week: IplWeek
  leagueId: string
  userId: string
  width: number
  overrides?: Array<{ user_id: string; week_num: number; points: number; note: string | null }>
  onRefreshMatchups?: () => void
}

function sortByRole<T extends { playerRole?: string; slot_role?: string; player_role?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ra = ROLE_ORDER[a.slot_role ?? a.playerRole ?? a.player_role ?? ''] ?? 5
    const rb = ROLE_ORDER[b.slot_role ?? b.playerRole ?? b.player_role ?? ''] ?? 5
    return ra - rb
  })
}

function formatMatchTime(m: { start_time_utc: string | null; match_date: string }) {
  if (m.start_time_utc) {
    return new Date(m.start_time_utc).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
    })
  }
  return m.match_date
}

export function MatchupSlide({ matchup, week, leagueId, userId, width, overrides = [], onRefreshMatchups }: Props) {
  const isCompleted = (matchup?.is_final ?? false) || (week.window_end ? new Date(week.window_end) < new Date() : false)

  const isHome = matchup?.home_user === userId
  const dbMyPoints = matchup ? (isHome ? matchup.home_points : matchup.away_points) : null
  const dbOppPoints = matchup ? (isHome ? matchup.away_points : matchup.home_points) : null
  const myName = matchup
    ? (isHome ? (matchup.home_team_name || matchup.home_full_name || matchup.home_username) : (matchup.away_team_name || matchup.away_full_name || matchup.away_username))
    : 'You'
  const myUsername = matchup ? (isHome ? matchup.home_full_name : matchup.away_full_name) : undefined
  const oppName = matchup
    ? (isHome ? (matchup.away_team_name || matchup.away_full_name || matchup.away_username) : (matchup.home_team_name || matchup.home_full_name || matchup.home_username))
    : 'Opponent'
  const oppUsername = matchup ? (isHome ? matchup.away_full_name : matchup.home_full_name) : undefined
  const oppId = matchup ? (isHome ? matchup.away_user : matchup.home_user) : null

  const myOverride = overrides.find(o => o.user_id === userId && o.week_num === week.week_num) ?? null
  const oppOverride = oppId ? (overrides.find(o => o.user_id === oppId && o.week_num === week.week_num) ?? null) : null

  const { data: weekMatches, refetch: refetchWeekMatches } = useWeekMatches(week.week_num)
  const { data: myLineupData, refetch: refetchMyLineup, isFetching: myLineupFetching } = useLineup(leagueId, week.week_num)
  const { data: oppLineupData, refetch: refetchOppLineup, isFetching: oppLineupFetching } = useUserLineup(
    oppId ? leagueId : '',
    oppId ?? '',
    week.week_num
  )
  const myLineup = sortByRole(myLineupData?.lineup ?? EMPTY_LINEUP)
  // undefined while loading — strict `=== false` checks downstream distinguish
  // "confirmed unlocked" from "don't know yet", so past weeks don't briefly show
  // Set/Edit affordances during the initial fetch.
  const lineupLocked = myLineupData?.locked
  const myLineupLoading = myLineupData === undefined
  const oppLineupLoading = !!oppId && oppLineupData === undefined
  // Settled = we have data AND no in-flight refetch. Used to gate the
  // "Set Lineup" banner so a stale cached `locked: false` can't flash before
  // the refetch corrects it.
  const myLineupSettled = myLineupData !== undefined && !myLineupFetching
  const oppLineupSettled = !oppId || (oppLineupData !== undefined && !oppLineupFetching)
  const oppLineup = sortByRole(oppLineupData?.lineup ?? [])

  const { data: allRosters } = useAllTeams(leagueId)
  const myStartingIds = new Set(myLineup.map(e => e.player_id))
  const oppStartingIds = new Set(oppLineup.map(e => e.player_id))
  const myBench = myLineup.length === 0 ? [] : (allRosters ?? [])
    .filter(r => r.user_id === userId && !myStartingIds.has(r.player_id))
    .map(r => ({ player_id: r.player_id, player_name: r.player_name, player_ipl_team: r.player_ipl_team, player_role: r.player_role }))
  const oppBench = oppLineup.length === 0 ? [] : (allRosters ?? [])
    .filter(r => r.user_id === (oppId ?? '') && !oppStartingIds.has(r.player_id))
    .map(r => ({ player_id: r.player_id, player_name: r.player_name, player_ipl_team: r.player_ipl_team, player_role: r.player_role }))

  const { data: gameBreakdown, refetch: refetchBreakdown, isRefetching: isRefetchingBreakdown } = useGameBreakdown(leagueId, week.week_num, oppId ?? null, isCompleted)
  const breakdownByMatchId = new Map((gameBreakdown?.games ?? []).map((g) => [g.matchId, g]))

  const liveMyPoints = (gameBreakdown?.games ?? []).reduce((s, g) => s + g.myPoints, 0) + (myOverride?.points ?? 0)
  const liveOppPoints = (gameBreakdown?.games ?? []).reduce((s, g) => s + g.oppPoints, 0) + (oppOverride?.points ?? 0)
  const myPoints = gameBreakdown ? liveMyPoints : (dbMyPoints ?? 0) || 0
  const oppPoints = gameBreakdown ? liveOppPoints : (dbOppPoints ?? 0) || 0
  const hasPoints = ((myPoints ?? 0) + (oppPoints ?? 0)) > 0 || ((matchup?.home_points ?? 0) + (matchup?.away_points ?? 0)) > 0
  const isLive = !isCompleted && hasPoints

  const derivedWinnerId = matchup?.winner_id ?? (
    isCompleted && matchup && myPoints !== oppPoints
      ? (myPoints > oppPoints ? userId : oppId)
      : null
  )
  const result = isCompleted
    ? (derivedWinnerId === userId ? 'WIN' : derivedWinnerId ? 'LOSS' : 'TIE') as 'WIN' | 'LOSS' | 'TIE'
    : null

  const onRefresh = useCallback(() => {
    refetchWeekMatches()
    refetchMyLineup()
    refetchOppLineup()
    refetchBreakdown()
    onRefreshMatchups?.()
  }, [refetchWeekMatches, refetchMyLineup, refetchOppLineup, refetchBreakdown, onRefreshMatchups])

  // ── Lineup editor ──────────────────────────────────────────────────────────

  const [lineupModalOpen, setLineupModalOpen] = useState(false)
  const [carouselKey, setCarouselKey] = useState(0)
  const { data: myRoster } = useMyTeam(lineupModalOpen ? leagueId : '')
  const setLineupMutation = useSetLineup(leagueId)

  type SlotRole = 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler' | 'flex'
  type PrimaryRole = 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler'
  const PRIMARY_SLOTS: { role: PrimaryRole; label: string; shortLabel: string; count: number }[] = [
    { role: 'batsman', label: 'Batsmen', shortLabel: 'BAT', count: 3 },
    { role: 'wicket_keeper', label: 'Wicket Keepers', shortLabel: 'WK', count: 1 },
    { role: 'all_rounder', label: 'All-Rounders', shortLabel: 'AR', count: 1 },
    { role: 'bowler', label: 'Bowlers', shortLabel: 'BOW', count: 3 },
  ]
  const [selections, setSelections] = useState<Record<SlotRole, string[]>>({
    batsman: [], wicket_keeper: [], all_rounder: [], bowler: [], flex: [],
  })
  const [expandedModal, setExpandedModal] = useState<Set<string>>(new Set())

  function gamesForTeam(iplTeam: string) {
    return (weekMatches ?? []).filter(m => m.home_team === iplTeam || m.away_team === iplTeam)
  }
  function gamesRemainingForTeam(iplTeam: string) {
    return (weekMatches ?? []).filter(m => (m.home_team === iplTeam || m.away_team === iplTeam) && m.status !== 'completed')
  }

  function openLineupModal() {
    const prefill: Record<SlotRole, string[]> = {
      batsman: [], wicket_keeper: [], all_rounder: [], bowler: [], flex: [],
    }
    for (const entry of myLineup) {
      prefill[entry.slot_role].push(entry.player_id)
    }
    setSelections(prefill)
    setLineupModalOpen(true)
  }

  function togglePlayer(role: PrimaryRole, playerId: string, maxCount: number) {
    setSelections(prev => {
      const inPrimary = prev[role].includes(playerId)
      const inFlex = prev.flex.includes(playerId)
      if (inPrimary) {
        const newPrimary = prev[role].filter(id => id !== playerId)
        const roster = myRoster ?? []
        const flexOfSameRole = prev.flex.find(id => roster.find(p => p.player_id === id)?.player_role === role)
        if (flexOfSameRole) {
          return { ...prev, [role]: [...newPrimary, flexOfSameRole], flex: prev.flex.filter(id => id !== flexOfSameRole) }
        }
        return { ...prev, [role]: newPrimary }
      }
      if (inFlex) return { ...prev, flex: prev.flex.filter(id => id !== playerId) }
      if (prev[role].length < maxCount) return { ...prev, [role]: [...prev[role], playerId] }
      if (prev.flex.length < 3) return { ...prev, flex: [...prev.flex, playerId] }
      return prev
    })
  }

  async function submitLineup() {
    const entries: Array<{ playerId: string; slotRole: SlotRole }> = []
    for (const role of (['batsman', 'wicket_keeper', 'all_rounder', 'bowler', 'flex'] as SlotRole[])) {
      for (const playerId of selections[role]) {
        entries.push({ playerId, slotRole: role })
      }
    }
    try {
      await setLineupMutation.mutateAsync({ weekNum: week.week_num, entries })
      setLineupModalOpen(false)
    } catch { /* error shown below */ }
  }

  // ── Expand games modal ────────────────────────────────────────────────────

  const [gamesModalOpen, setGamesModalOpen] = useState(false)
  const isPending = !isCompleted && !isLive

  // ── Render ────────────────────────────────────────────────────────────────

  if (!matchup) {
    return (
      <ScrollView
        style={{ width }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
          <View style={{ backgroundColor: BG_DARK_HEADER, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Matchup</Text>
          </View>
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 15 }}>Bye week — no matchup</Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  const lineupHeaderAction = lineupLocked === false ? (
    <TouchableOpacity
      onPress={openLineupModal}
      style={{ backgroundColor: PRIMARY, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}
    >
      <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
        {myLineup.length === 0 ? 'Set' : 'Edit'}
      </Text>
    </TouchableOpacity>
  ) : undefined

  return (
    <>
      <MatchupView
        week={week}
        myName={myName}
        myUsername={myUsername}
        oppName={oppName}
        oppUsername={oppUsername}
        myPoints={myPoints}
        oppPoints={oppPoints}
        result={result}
        isCompleted={isCompleted}
        isLive={isLive}
        myLineup={myLineup}
        oppLineup={oppLineup}
        lineupLocked={lineupLocked}
        lineupHeaderAction={lineupHeaderAction}
        myBench={myBench}
        oppBench={oppBench}
        weekMatches={weekMatches}
        breakdownByMatchId={breakdownByMatchId}
        getMyPlayerStats={(matchId, playerId) => breakdownByMatchId.get(matchId)?.myPlayers.find(p => p.playerId === playerId)}
        getOppPlayerStats={(matchId, playerId) => breakdownByMatchId.get(matchId)?.oppPlayers.find(p => p.playerId === playerId)}
        myOverridePoints={myOverride?.points ?? null}
        myOverrideNote={myOverride?.note ?? null}
        oppOverridePoints={oppOverride?.points ?? null}
        oppOverrideNote={oppOverride?.note ?? null}
        width={width}
        refreshControl={<RefreshControl refreshing={isRefetchingBreakdown} onRefresh={onRefresh} tintColor={PRIMARY_SOFT} />}
        onExpandGames={() => setGamesModalOpen(true)}
        carouselKey={carouselKey}
        onSetLineup={lineupLocked === false ? openLineupModal : undefined}
        myLineupLoading={myLineupLoading}
        oppLineupLoading={oppLineupLoading}
        myLineupSettled={myLineupSettled}
      />

      {/* IPL Games expand modal */}
      <Modal visible={gamesModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGamesModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
          <View style={{ backgroundColor: BG_CARD, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
            <NavButton label="Close" onPress={() => setGamesModalOpen(false)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {!isPending && matchup && oppId && (
              <GameBreakdownSection
                leagueId={leagueId}
                weekNum={week.week_num}
                opponentId={oppId}
                myName={myName}
                oppName={oppName}
              />
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Set/Edit Lineup modal */}
      <Modal
        visible={lineupModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLineupModalOpen(false)}
        onDismiss={() => setCarouselKey(k => k + 1)}
      >
        <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
          <View style={{ backgroundColor: BG_CARD, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 17, flex: 1 }}>Set Lineup — Week {week.week_num}</Text>
              <NavButton label="Cancel" onPress={() => setLineupModalOpen(false)} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 14, gap: 6 }}>
              {[
                ...PRIMARY_SLOTS.map(s => ({ label: s.shortLabel, filled: selections[s.role].length, total: s.count })),
                { label: 'FLEX', filled: selections.flex.length, total: 3 },
              ].map(({ label, filled, total }) => {
                const full = filled >= total
                return (
                  <View key={label} style={{ flex: 1, alignItems: 'center', backgroundColor: full ? '#fff5f5' : BG_PAGE, borderRadius: 8, paddingVertical: 6, borderWidth: 1, borderColor: full ? PRIMARY_BORDER : BORDER_DEFAULT }}>
                    <Text style={{ color: full ? PRIMARY : TEXT_PLACEHOLDER, fontSize: 10, fontWeight: '700' }}>{label}</Text>
                    <Text style={{ color: full ? PRIMARY : TEXT_SECONDARY, fontSize: 13, fontWeight: '700', marginTop: 2 }}>{filled}/{total}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
            {PRIMARY_SLOTS.map(slot => {
              const roster = myRoster ?? []
              const players = roster.filter(p => p.player_role === slot.role)
              const chosen = selections[slot.role]
              const atCap = chosen.length >= slot.count
              return (
                <View key={slot.role} style={{ backgroundColor: BG_CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: BG_PAGE, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: TEXT_SECONDARY, fontWeight: '700', fontSize: 13 }}>{slot.label}</Text>
                    <Text style={{ color: atCap ? PRIMARY : TEXT_PLACEHOLDER, fontSize: 12, fontWeight: '600' }}>
                      {chosen.length}/{slot.count}
                    </Text>
                  </View>
                  {players.length === 0 ? (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: TEXT_DISABLED, fontSize: 13 }}>No players available</Text>
                    </View>
                  ) : players.map((p, i) => {
                    const isSelected = chosen.includes(p.player_id) || selections.flex.includes(p.player_id)
                    const isDisabled = !isSelected && selections.flex.length >= 3 && chosen.length >= slot.count
                    const isExpanded = expandedModal.has(p.player_id)
                    const games = gamesForTeam(p.player_ipl_team)
                    const gamesRemaining = gamesRemainingForTeam(p.player_ipl_team)
                    return (
                      <View key={p.player_id} style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: BORDER_DEFAULT, opacity: isDisabled ? 0.4 : 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? '#fff5f5' : BG_CARD }}>
                          <TouchableOpacity
                            onPress={() => togglePlayer(slot.role, p.player_id, slot.count)}
                            disabled={isDisabled}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingVertical: 12 }}
                          >
                            <View style={{
                              width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                              borderColor: isSelected ? PRIMARY : TEXT_DISABLED,
                              backgroundColor: isSelected ? PRIMARY : BG_CARD,
                              alignItems: 'center', justifyContent: 'center', marginRight: 12,
                            }}>
                              {isSelected && <Text style={{ color: 'white', fontSize: 13, fontWeight: '800', lineHeight: 16 }}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                                {p.player_name}
                              </Text>
                              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>{p.player_ipl_team}</Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 14, paddingLeft: 8 }}
                            onPress={() => setExpandedModal(prev => { const s = new Set(prev); isExpanded ? s.delete(p.player_id) : s.add(p.player_id); return s })}
                          >
                            {gamesRemaining.length > 0 && (
                              <View style={{ backgroundColor: PRIMARY_SUBTLE, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6 }}>
                                <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '700' }}>{gamesRemaining.length}</Text>
                              </View>
                            )}
                            <Text style={{ color: TEXT_DISABLED, fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</Text>
                          </TouchableOpacity>
                        </View>
                        {isExpanded && (
                          <View style={{ backgroundColor: BG_PAGE, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8, gap: 10 }}>
                            {games.length === 0 ? (
                              <Text style={{ color: TEXT_DISABLED, fontSize: 12 }}>No games this week</Text>
                            ) : games.map(m => {
                              const opp = m.home_team === p.player_ipl_team ? m.away_team : m.home_team
                              const isHomeGame = m.home_team === p.player_ipl_team
                              const { text: statusColor, bg: statusBg } = matchStatusColors(m.status)
                              const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'FINAL' : m.status === 'upcoming' ? 'NEXT' : 'UPCOMING'
                              return (
                                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 }}>
                                    <Text style={{ color: statusColor, fontSize: 9, fontWeight: '700' }}>{statusLabel}</Text>
                                  </View>
                                  <Text style={{ color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500', flex: 1 }}>
                                    {isHomeGame ? 'vs' : '@'} {opp}
                                  </Text>
                                  <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{formatMatchTime(m)}</Text>
                                </View>
                              )
                            })}
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              )
            })}
          </ScrollView>

          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: BG_CARD, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT }}>
            {setLineupMutation.isError && (
              <Text style={{ color: PRIMARY, fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
                {(setLineupMutation.error as Error)?.message ?? 'Failed to save lineup'}
              </Text>
            )}
            <TouchableOpacity
              onPress={submitLineup}
              disabled={setLineupMutation.isPending}
              style={{ backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            >
              {setLineupMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Save Lineup</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}
