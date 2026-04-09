import { View, Text, ScrollView, Modal, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useState, useCallback } from 'react'
import { useLineup, useUserLineup, useSetLineup, useGameBreakdown } from '../../hooks/useLineup'
import type { LineupEntry } from '../../hooks/useLineup'
import { GameBreakdownSection } from './GameBreakdownSection'
import type { Matchup, IplWeek } from '../../hooks/useMatchup'
import { useWeekMatches } from '../../hooks/useMatchup'
import { useMyTeam, useAllTeams } from '../../hooks/useTeam'
import { ROLE_ORDER } from './LineupCard'
import { MatchupView } from './MatchupView'

const EMPTY_LINEUP: LineupEntry[] = []

interface Props {
  matchup: Matchup | null
  week: IplWeek
  leagueId: string
  userId: string
  width: number
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

export function MatchupSlide({ matchup, week, leagueId, userId, width }: Props) {
  const isCompleted = (matchup?.is_final ?? false) || new Date(week.end_date) < new Date()

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

  const { data: weekMatches, refetch: refetchWeekMatches } = useWeekMatches(week.week_num)
  const { data: myLineupData, refetch: refetchMyLineup } = useLineup(leagueId, week.week_num)
  const { data: oppLineupData, refetch: refetchOppLineup } = useUserLineup(
    oppId ? leagueId : '',
    oppId ?? '',
    week.week_num
  )
  const myLineup = sortByRole(myLineupData?.lineup ?? EMPTY_LINEUP)
  const lineupLocked = myLineupData?.locked ?? false
  const oppLineup = sortByRole(oppLineupData?.lineup ?? [])

  const { data: allRosters } = useAllTeams(leagueId)
  const myStartingIds = new Set(myLineup.map(e => e.player_id))
  const oppStartingIds = new Set(oppLineup.map(e => e.player_id))
  const myBench = (allRosters ?? [])
    .filter(r => r.user_id === userId && !myStartingIds.has(r.player_id))
    .map(r => ({ player_id: r.player_id, player_name: r.player_name, player_ipl_team: r.player_ipl_team, player_role: r.player_role }))
  const oppBench = (allRosters ?? [])
    .filter(r => r.user_id === (oppId ?? '') && !oppStartingIds.has(r.player_id))
    .map(r => ({ player_id: r.player_id, player_name: r.player_name, player_ipl_team: r.player_ipl_team, player_role: r.player_role }))

  const { data: gameBreakdown, refetch: refetchBreakdown, isRefetching: isRefetchingBreakdown } = useGameBreakdown(leagueId, week.week_num, oppId ?? null)
  const breakdownByMatchId = new Map((gameBreakdown?.games ?? []).map((g) => [g.matchId, g]))

  const liveMyPoints = (gameBreakdown?.games ?? []).reduce((s, g) => s + g.myPoints, 0)
  const liveOppPoints = (gameBreakdown?.games ?? []).reduce((s, g) => s + g.oppPoints, 0)
  const myPoints = gameBreakdown ? liveMyPoints : (dbMyPoints ?? 0) || 0
  const oppPoints = gameBreakdown ? liveOppPoints : (dbOppPoints ?? 0) || 0
  const hasPoints = ((myPoints ?? 0) + (oppPoints ?? 0)) > 0 || ((matchup?.home_points ?? 0) + (matchup?.away_points ?? 0)) > 0
  const isLive = !isCompleted && hasPoints

  const result = isCompleted
    ? (matchup?.winner_id === userId ? 'WIN' : matchup?.winner_id ? 'LOSS' : 'TIE') as 'WIN' | 'LOSS' | 'TIE'
    : null

  const onRefresh = useCallback(() => {
    refetchWeekMatches()
    refetchMyLineup()
    refetchOppLineup()
    refetchBreakdown()
  }, [refetchWeekMatches, refetchMyLineup, refetchOppLineup, refetchBreakdown])

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
        <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
          <View style={{ backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Matchup</Text>
          </View>
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 15 }}>Bye week — no matchup</Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  const lineupHeaderAction = !lineupLocked ? (
    <TouchableOpacity
      onPress={openLineupModal}
      style={{ backgroundColor: '#dc2626', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}
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
        width={width}
        refreshControl={<RefreshControl refreshing={isRefetchingBreakdown} onRefresh={onRefresh} tintColor="#ef4444" />}
        onExpandGames={() => setGamesModalOpen(true)}
        carouselKey={carouselKey}
      />

      {/* IPL Games expand modal */}
      <Modal visible={gamesModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGamesModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#111827', fontWeight: '700', fontSize: 17 }}>IPL Games This Week</Text>
            <TouchableOpacity onPress={() => setGamesModalOpen(false)}>
              <Text style={{ color: '#6b7280', fontSize: 15, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
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
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Text style={{ color: '#111827', fontWeight: '700', fontSize: 17, flex: 1 }}>Set Lineup — Week {week.week_num}</Text>
              <TouchableOpacity onPress={() => setLineupModalOpen(false)}>
                <Text style={{ color: '#6b7280', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 14, gap: 6 }}>
              {[
                ...PRIMARY_SLOTS.map(s => ({ label: s.shortLabel, filled: selections[s.role].length, total: s.count })),
                { label: 'FLEX', filled: selections.flex.length, total: 3 },
              ].map(({ label, filled, total }) => {
                const full = filled >= total
                return (
                  <View key={label} style={{ flex: 1, alignItems: 'center', backgroundColor: full ? '#fff5f5' : '#f9fafb', borderRadius: 8, paddingVertical: 6, borderWidth: 1, borderColor: full ? '#fecaca' : '#f3f4f6' }}>
                    <Text style={{ color: full ? '#dc2626' : '#9ca3af', fontSize: 10, fontWeight: '700' }}>{label}</Text>
                    <Text style={{ color: full ? '#dc2626' : '#374151', fontSize: 13, fontWeight: '700', marginTop: 2 }}>{filled}/{total}</Text>
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
                <View key={slot.role} style={{ backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
                  <View style={{ backgroundColor: '#f9fafb', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#374151', fontWeight: '700', fontSize: 13 }}>{slot.label}</Text>
                    <Text style={{ color: atCap ? '#dc2626' : '#9ca3af', fontSize: 12, fontWeight: '600' }}>
                      {chosen.length}/{slot.count}
                    </Text>
                  </View>
                  {players.length === 0 ? (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#d1d5db', fontSize: 13 }}>No players available</Text>
                    </View>
                  ) : players.map((p, i) => {
                    const isSelected = chosen.includes(p.player_id) || selections.flex.includes(p.player_id)
                    const isDisabled = !isSelected && selections.flex.length >= 3 && chosen.length >= slot.count
                    const isExpanded = expandedModal.has(p.player_id)
                    const games = gamesForTeam(p.player_ipl_team)
                    const gamesRemaining = gamesRemainingForTeam(p.player_ipl_team)
                    return (
                      <View key={p.player_id} style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#f3f4f6', opacity: isDisabled ? 0.4 : 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? '#fff5f5' : 'white' }}>
                          <TouchableOpacity
                            onPress={() => togglePlayer(slot.role, p.player_id, slot.count)}
                            disabled={isDisabled}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingVertical: 12 }}
                          >
                            <View style={{
                              width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                              borderColor: isSelected ? '#dc2626' : '#d1d5db',
                              backgroundColor: isSelected ? '#dc2626' : 'white',
                              alignItems: 'center', justifyContent: 'center', marginRight: 12,
                            }}>
                              {isSelected && <Text style={{ color: 'white', fontSize: 13, fontWeight: '800', lineHeight: 16 }}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                                {p.player_name}
                              </Text>
                              <Text style={{ color: '#9ca3af', fontSize: 12 }}>{p.player_ipl_team}</Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 14, paddingLeft: 8 }}
                            onPress={() => setExpandedModal(prev => { const s = new Set(prev); isExpanded ? s.delete(p.player_id) : s.add(p.player_id); return s })}
                          >
                            {gamesRemaining.length > 0 && (
                              <View style={{ backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6 }}>
                                <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700' }}>{gamesRemaining.length}</Text>
                              </View>
                            )}
                            <Text style={{ color: '#d1d5db', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</Text>
                          </TouchableOpacity>
                        </View>
                        {isExpanded && (
                          <View style={{ backgroundColor: '#f9fafb', paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8, gap: 10 }}>
                            {games.length === 0 ? (
                              <Text style={{ color: '#d1d5db', fontSize: 12 }}>No games this week</Text>
                            ) : games.map(m => {
                              const opp = m.home_team === p.player_ipl_team ? m.away_team : m.home_team
                              const isHome = m.home_team === p.player_ipl_team
                              const statusColor = m.status === 'live' ? '#b45309' : m.status === 'completed' ? '#16a34a' : m.status === 'upcoming' ? '#1d4ed8' : '#6b7280'
                              const statusBg = m.status === 'live' ? '#fef9c3' : m.status === 'completed' ? '#f0fdf4' : m.status === 'upcoming' ? '#dbeafe' : '#f3f4f6'
                              const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'FINAL' : m.status === 'upcoming' ? 'NEXT' : 'UPCOMING'
                              return (
                                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 }}>
                                    <Text style={{ color: statusColor, fontSize: 9, fontWeight: '700' }}>{statusLabel}</Text>
                                  </View>
                                  <Text style={{ color: '#374151', fontSize: 12, fontWeight: '500', flex: 1 }}>
                                    {isHome ? 'vs' : '@'} {opp}
                                  </Text>
                                  <Text style={{ color: '#9ca3af', fontSize: 11 }}>{formatMatchTime(m)}</Text>
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

          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            {setLineupMutation.isError && (
              <Text style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
                {(setLineupMutation.error as Error)?.message ?? 'Failed to save lineup'}
              </Text>
            )}
            <TouchableOpacity
              onPress={submitLineup}
              disabled={setLineupMutation.isPending}
              style={{ backgroundColor: '#dc2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
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
