import { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useMatchup, useCurrentWeek, useLeagueSchedule } from '../../../hooks/useMatchup'
import type { Matchup } from '../../../hooks/useMatchup'
import { useLineup } from '../../../hooks/useLineup'
import { useAuthStore } from '../../../stores/authStore'

// ── Matchup summary card in horizontal strip ──────────────────────────────────

function MatchupCard({
  matchup,
  userId,
  selected,
  onPress,
}: {
  matchup: Matchup
  userId: string
  selected: boolean
  onPress: () => void
}) {
  const isHome = matchup.home_user === userId
  const isMine = matchup.home_user === userId || matchup.away_user === userId

  const leftName = (matchup.home_full_name || matchup.home_username).split(' ')[0]
  const rightName = (matchup.away_full_name || matchup.away_username).split(' ')[0]

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        marginRight: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? '#ef4444' : '#e5e7eb',
        backgroundColor: selected ? '#fff1f2' : 'white',
        minWidth: 140,
        alignItems: 'center',
        gap: 4,
      }}
    >
      {isMine && (
        <Text style={{ fontSize: 9, fontWeight: '700', color: '#ef4444', letterSpacing: 0.4 }}>YOUR MATCHUP</Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
          {leftName}
        </Text>
        <Text style={{ fontSize: 11, color: '#9ca3af' }}>vs</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
          {rightName}
        </Text>
      </View>
      {(matchup.home_points > 0 || matchup.away_points > 0 || matchup.is_final) && (
        <Text style={{ fontSize: 11, color: '#6b7280' }}>
          {matchup.home_points.toFixed(1)} – {matchup.away_points.toFixed(1)}
        </Text>
      )}
      {matchup.is_final && (
        <Text style={{ fontSize: 9, color: '#2563eb', fontWeight: '700', letterSpacing: 0.3 }}>FINAL</Text>
      )}
    </TouchableOpacity>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MatchupScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const { user } = useAuthStore()
  const stripRef = useRef<ScrollView>(null)

  const { data: currentWeek } = useCurrentWeek()
  const weekNum = currentWeek?.week_num

  // User's own matchup (full data + locked status)
  const { data, isLoading, refetch, isRefetching } = useMatchup(leagueId!, weekNum)
  const myMatchup = data?.matchup
  const locked = data?.locked ?? false

  // All matchups for this league (all weeks — filter client-side for current week)
  const { data: allMatchups } = useLeagueSchedule(leagueId!)
  const filteredMatchups: Matchup[] = weekNum
    ? (allMatchups ?? []).filter(m => Number(m.week_num) === Number(weekNum))
    : []

  // Merge: always include myMatchup so the strip shows immediately even before allMatchups loads
  const weekMatchups: Matchup[] = (() => {
    if (!myMatchup) return filteredMatchups
    const hasMine = filteredMatchups.some(m => m.id === myMatchup.id)
    return hasMine ? filteredMatchups : [myMatchup, ...filteredMatchups]
  })()

  // Selected matchup — default to user's own
  const myId = user?.id ?? ''
  const myMatchupId = myMatchup?.id ?? null
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Once my matchup loads, set it as the default selection
  useEffect(() => {
    if (myMatchupId && selectedId === null) {
      setSelectedId(myMatchupId)
    }
  }, [myMatchupId])

  const selectedMatchup: Matchup | null =
    weekMatchups.find(m => m.id === selectedId) ?? myMatchup ?? null

  // Scroll strip to user's own card on load
  useEffect(() => {
    if (!myMatchupId || weekMatchups.length === 0) return
    const idx = weekMatchups.findIndex(m => m.id === myMatchupId)
    if (idx > 0) {
      setTimeout(() => stripRef.current?.scrollTo({ x: idx * 158, animated: false }), 100)
    }
  }, [myMatchupId, weekMatchups.length])

  // Lineup for user's own starters (only shown when viewing own matchup)
  const { data: myLineupData } = useLineup(leagueId!, weekNum)
  const myLineup = myLineupData?.lineup ?? []

  const viewingOwn = selectedMatchup?.id === myMatchupId

  if (isLoading || !weekNum) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading matchup...</Text>
      </View>
    )
  }

  // ── Derive display values from the selected matchup ────────────────────────

  const sel = selectedMatchup
  const selIsHome = sel ? sel.home_user === myId : false
  const selIsMine = sel ? (sel.home_user === myId || sel.away_user === myId) : false

  // For own matchup: "You" is always on the left
  // For other matchups: home team on the left
  const leftName = sel
    ? (selIsMine
        ? (selIsHome ? (sel.home_full_name || sel.home_username) : (sel.away_full_name || sel.away_username))
        : (sel.home_full_name || sel.home_username))
    : '—'
  const rightName = sel
    ? (selIsMine
        ? (selIsHome ? (sel.away_full_name || sel.away_username) : (sel.home_full_name || sel.home_username))
        : (sel.away_full_name || sel.away_username))
    : '—'
  const leftPts = sel
    ? (selIsMine ? (selIsHome ? sel.home_points : sel.away_points) : sel.home_points)
    : 0
  const rightPts = sel
    ? (selIsMine ? (selIsHome ? sel.away_points : sel.home_points) : sel.away_points)
    : 0
  // leftUser is whichever user is displayed on the left side
  const leftUserId = sel
    ? (selIsMine ? (selIsHome ? sel.home_user : sel.away_user) : sel.home_user)
    : null
  const leftIsWinner = !!(sel?.is_final && sel.winner_id && sel.winner_id === leftUserId)
  const rightIsWinner = !!(sel?.is_final && sel.winner_id && sel.winner_id !== leftUserId)

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />}
    >
      <View className="p-4 gap-4">
        {/* Week badge */}
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-900 text-2xl font-bold">Week {weekNum}</Text>
          {locked && !myMatchup?.is_final && (
            <View className="bg-green-50 rounded-lg px-3 py-1">
              <Text className="text-green-600 text-xs font-semibold">IN PROGRESS</Text>
            </View>
          )}
          {myMatchup?.is_final && (
            <View className="bg-blue-500/20 rounded-lg px-3 py-1">
              <Text className="text-blue-400 text-xs font-semibold">FINAL</Text>
            </View>
          )}
        </View>

        {/* Horizontal matchup strip */}
        {weekMatchups.length > 0 && (
          <ScrollView
            ref={stripRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 4 }}
          >
            {weekMatchups.map(m => (
              <MatchupCard
                key={m.id}
                matchup={m}
                userId={myId}
                selected={selectedId === m.id}
                onPress={() => setSelectedId(m.id)}
              />
            ))}
          </ScrollView>
        )}

        {!sel && (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-gray-500 text-center">No matchup scheduled for Week {weekNum}</Text>
          </View>
        )}

        {sel && (
          <>
            {/* Scoreboard */}
            <View className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <View className="flex-row items-center justify-between">
                {/* Left team */}
                <View className="flex-1 items-center gap-1">
                  {selIsMine && (
                    <Text className="text-red-500 text-xs font-semibold">YOU</Text>
                  )}
                  <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>{leftName}</Text>
                  <Text className={`text-4xl font-bold ${leftIsWinner ? 'text-green-600' : 'text-gray-900'}`}>
                    {leftPts.toFixed(1)}
                  </Text>
                  {leftIsWinner && <Text className="text-green-600 text-xs font-semibold">WIN</Text>}
                </View>

                <Text className="text-gray-400 text-xl mx-4">vs</Text>

                {/* Right team */}
                <View className="flex-1 items-center gap-1">
                  {selIsMine && (
                    <Text className="text-gray-500 text-xs font-semibold">OPP</Text>
                  )}
                  <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>{rightName}</Text>
                  <Text className={`text-4xl font-bold ${rightIsWinner ? 'text-green-600' : 'text-gray-900'}`}>
                    {rightPts.toFixed(1)}
                  </Text>
                  {rightIsWinner && <Text className="text-green-600 text-xs font-semibold">WIN</Text>}
                </View>
              </View>

              {sel.is_final && (
                <View className="mt-3 pt-3 border-t border-gray-100 items-center">
                  <Text className="text-blue-500 text-xs font-semibold">FINAL</Text>
                </View>
              )}
            </View>

            {/* My starters — only when viewing own matchup */}
            {viewingOwn && myLineup.length > 0 && (
              <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
                <Text className="text-gray-900 font-bold text-lg">My Starters</Text>
                {myLineup.map((entry) => (
                  <View key={entry.id} className="flex-row items-center justify-between py-2 border-b border-gray-200">
                    <View>
                      <Text className="text-gray-900 text-sm font-medium">{entry.player_name}</Text>
                      <Text className="text-gray-500 text-xs">{entry.player_ipl_team} · {entry.slot_role.replace('_', ' ')}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {viewingOwn && !locked && (
              <View className="bg-yellow-50 rounded-2xl p-4">
                <Text className="text-yellow-600 text-sm text-center">
                  Lineup locks when the first IPL match of Week {weekNum} begins
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  )
}
