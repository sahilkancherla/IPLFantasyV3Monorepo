import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useLeagueSchedule, useAllWeeks } from '../../../hooks/useMatchup'
import { useAuthStore } from '../../../stores/authStore'

const WEEK_COLORS = ['bg-gray-100', 'bg-white']

export default function ScheduleScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const { data: matchups, isLoading, refetch, isRefetching } = useLeagueSchedule(leagueId!)
  const { data: weeks } = useAllWeeks()

  const weekNums = [...new Set((matchups ?? []).map((m) => m.week_num))].sort((a, b) => a - b)

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading schedule...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />}
    >
      <View className="p-4 gap-4">
        <Text className="text-gray-900 text-2xl font-bold">Schedule</Text>

        {weekNums.length === 0 && (
          <View className="bg-white rounded-2xl p-8 items-center border border-gray-100 shadow-sm">
            <Text className="text-gray-500 text-center">
              Schedule will be generated when the season starts
            </Text>
          </View>
        )}

        {weekNums.map((weekNum) => {
          const weekMatchups = (matchups ?? []).filter((m) => m.week_num === weekNum)
          const weekInfo = weeks?.find((w) => w.week_num === weekNum)

          return (
            <View key={weekNum} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              {/* Week header */}
              <View className="px-4 py-3 bg-gray-100 flex-row justify-between items-center">
                <Text className="text-gray-900 font-bold">Week {weekNum}</Text>
                {weekInfo && (
                  <Text className="text-gray-500 text-xs">
                    {weekInfo.label}
                  </Text>
                )}
              </View>

              {/* Matchups */}
              {weekMatchups.map((m) => {
                const isMyMatchup = m.home_user === user?.id || m.away_user === user?.id
                const homeWon = m.winner_id === m.home_user
                const awayWon = m.winner_id === m.away_user

                return (
                  <TouchableOpacity
                    key={m.id}
                    className={`px-4 py-3 border-t border-gray-200 ${isMyMatchup ? 'bg-red-500/10' : ''}`}
                    onPress={() => router.push(`/(app)/matchup/${leagueId}?week=${weekNum}`)}
                  >
                    <View className="flex-row items-center justify-between">
                      {/* Home */}
                      <View className="flex-1 items-start gap-0.5">
                        <Text
                          className={`font-semibold text-sm ${m.home_user === user?.id ? 'text-red-500' : 'text-gray-900'} ${homeWon ? 'font-bold' : ''}`}
                          numberOfLines={1}
                        >
                          {m.home_full_name || m.home_username}
                        </Text>
                        {m.is_final && (
                          <Text className={`text-base font-bold ${homeWon ? 'text-green-600' : 'text-gray-500'}`}>
                            {m.home_points.toFixed(1)}
                          </Text>
                        )}
                      </View>

                      {/* vs */}
                      <Text className="text-gray-400 text-xs mx-3">
                        {m.is_final ? 'FINAL' : 'vs'}
                      </Text>

                      {/* Away */}
                      <View className="flex-1 items-end gap-0.5">
                        <Text
                          className={`font-semibold text-sm ${m.away_user === user?.id ? 'text-red-500' : 'text-gray-900'} ${awayWon ? 'font-bold' : ''}`}
                          numberOfLines={1}
                        >
                          {m.away_full_name || m.away_username}
                        </Text>
                        {m.is_final && (
                          <Text className={`text-base font-bold ${awayWon ? 'text-green-600' : 'text-gray-500'}`}>
                            {m.away_points.toFixed(1)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}
