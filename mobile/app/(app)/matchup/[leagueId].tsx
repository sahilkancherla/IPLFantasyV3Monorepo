import { View, Text, ScrollView, RefreshControl } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useMatchup, useCurrentWeek } from '../../../hooks/useMatchup'
import { useLineup } from '../../../hooks/useLineup'
import { useAuthStore } from '../../../stores/authStore'

export default function MatchupScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const { user } = useAuthStore()

  const { data: currentWeek } = useCurrentWeek()
  const weekNum = currentWeek?.week_num

  const { data, isLoading, refetch, isRefetching } = useMatchup(leagueId!, weekNum)
  const matchup = data?.matchup
  const locked = data?.locked ?? false

  const isHome = matchup?.home_user === user?.id
  const myId = user?.id ?? ''
  const oppId = isHome ? matchup?.away_user : matchup?.home_user

  const { data: myLineupData } = useLineup(leagueId!, weekNum)
  const myLineup = myLineupData?.lineup ?? []

  if (isLoading || !weekNum) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading matchup...</Text>
      </View>
    )
  }

  if (!matchup) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-8">
        <Text className="text-gray-500 text-center">No matchup scheduled for Week {weekNum}</Text>
      </View>
    )
  }

  const myName = isHome
    ? (matchup.home_full_name || matchup.home_username)
    : (matchup.away_full_name || matchup.away_username)
  const oppName = isHome
    ? (matchup.away_full_name || matchup.away_username)
    : (matchup.home_full_name || matchup.home_username)

  const myPoints = isHome ? matchup.home_points : matchup.away_points
  const oppPoints = isHome ? matchup.away_points : matchup.home_points
  const myWon = matchup.is_final && matchup.winner_id === myId

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />}
    >
      <View className="p-4 gap-4">
        {/* Week badge */}
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-900 text-2xl font-bold">Week {weekNum} Matchup</Text>
          {locked && !matchup.is_final && (
            <View className="bg-green-50 rounded-lg px-3 py-1">
              <Text className="text-green-600 text-xs font-semibold">IN PROGRESS</Text>
            </View>
          )}
          {matchup.is_final && (
            <View className="bg-blue-500/20 rounded-lg px-3 py-1">
              <Text className="text-blue-400 text-xs font-semibold">FINAL</Text>
            </View>
          )}
        </View>

        {/* Scoreboard */}
        <View className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <View className="flex-row items-center justify-between">
            {/* Me */}
            <View className="flex-1 items-center gap-1">
              <Text className="text-red-500 text-xs font-semibold">YOU</Text>
              <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>{myName}</Text>
              <Text className={`text-4xl font-bold ${myWon ? 'text-green-600' : 'text-gray-900'}`}>
                {myPoints.toFixed(1)}
              </Text>
              {myWon && <Text className="text-green-600 text-xs font-semibold">WIN</Text>}
            </View>

            <Text className="text-gray-400 text-xl mx-4">vs</Text>

            {/* Opponent */}
            <View className="flex-1 items-center gap-1">
              <Text className="text-gray-500 text-xs font-semibold">OPP</Text>
              <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>{oppName}</Text>
              <Text className={`text-4xl font-bold ${!myWon && matchup.is_final ? 'text-green-600' : 'text-gray-900'}`}>
                {oppPoints.toFixed(1)}
              </Text>
              {!myWon && matchup.is_final && matchup.winner_id && (
                <Text className="text-green-600 text-xs font-semibold">WIN</Text>
              )}
            </View>
          </View>
        </View>

        {/* My starters */}
        {myLineup.length > 0 && (
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

        {!locked && (
          <View className="bg-yellow-50 rounded-2xl p-4">
            <Text className="text-yellow-600 text-sm text-center">
              Lineup locks when the first IPL match of Week {weekNum} begins
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
