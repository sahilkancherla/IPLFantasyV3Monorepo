import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useLeagueSchedule, useAllWeeks } from '../../../hooks/useMatchup'
import { useAuthStore } from '../../../stores/authStore'

type Tab = 'schedule' | 'results'

function isWeekCompleted(weekNum: number, windowEnd: string | null | undefined, matchups: { week_num: number; is_final: boolean }[]): boolean {
  if (windowEnd && new Date(windowEnd) < new Date()) return true
  const weekMatchups = matchups.filter(m => m.week_num === weekNum)
  return weekMatchups.length > 0 && weekMatchups.every(m => m.is_final)
}

export default function ScheduleScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('schedule')

  const { data: matchups, isLoading, refetch, isRefetching } = useLeagueSchedule(leagueId!)
  const { data: weeks } = useAllWeeks()

  const allMatchups = matchups ?? []
  const weekNums = [...new Set(allMatchups.map((m) => m.week_num))].sort((a, b) => a - b)

  const scheduleWeeks = weekNums.filter(wn => {
    const weekInfo = weeks?.find(w => w.week_num === wn)
    return !isWeekCompleted(wn, weekInfo?.window_end, allMatchups)
  })
  const resultWeeks = weekNums.filter(wn => {
    const weekInfo = weeks?.find(w => w.week_num === wn)
    return isWeekCompleted(wn, weekInfo?.window_end, allMatchups)
  })

  const displayWeeks = activeTab === 'schedule' ? scheduleWeeks : [...resultWeeks].reverse()

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

        {/* Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4 }}>
          {([
            { key: 'schedule', label: 'Schedule', count: scheduleWeeks.length },
            { key: 'results', label: 'Results', count: resultWeeks.length },
          ] as { key: Tab; label: string; count: number }[]).map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 6, paddingVertical: 8, borderRadius: 9,
                backgroundColor: activeTab === tab.key ? 'white' : 'transparent',
                shadowColor: activeTab === tab.key ? '#000' : 'transparent',
                shadowOpacity: activeTab === tab.key ? 0.06 : 0,
                shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
                elevation: activeTab === tab.key ? 2 : 0,
              }}
            >
              <Text style={{
                fontSize: 14, fontWeight: activeTab === tab.key ? '700' : '500',
                color: activeTab === tab.key ? '#111827' : '#6b7280',
              }}>
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View style={{
                  backgroundColor: activeTab === tab.key ? '#fee2e2' : '#e5e7eb',
                  borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
                }}>
                  <Text style={{
                    fontSize: 11, fontWeight: '700',
                    color: activeTab === tab.key ? '#dc2626' : '#9ca3af',
                  }}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Empty state */}
        {displayWeeks.length === 0 && (
          <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
            <Text className="text-gray-500 text-center">
              {weekNums.length === 0
                ? 'Schedule will be generated when the season starts'
                : activeTab === 'schedule'
                ? 'No upcoming games'
                : 'No completed weeks yet'}
            </Text>
          </View>
        )}

        {/* Week cards */}
        {displayWeeks.map((weekNum) => {
          const weekMatchups = allMatchups.filter((m) => m.week_num === weekNum)
          const weekInfo = weeks?.find((w) => w.week_num === weekNum)

          return (
            <View key={weekNum} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              {/* Week header */}
              <View className="px-4 py-3 bg-gray-100 flex-row justify-between items-center">
                <Text className="text-gray-900 font-bold">Week {weekNum}</Text>
                {weekInfo && (
                  <Text className="text-gray-500 text-xs">{weekInfo.label}</Text>
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
                          {m.home_team_name || m.home_full_name || m.home_username}
                        </Text>
                        {m.is_final && (
                          <Text className={`text-base font-bold ${homeWon ? 'text-green-600' : 'text-gray-500'}`}>
                            {m.home_points.toFixed(1)}
                          </Text>
                        )}
                      </View>

                      {/* vs / FINAL */}
                      <Text className="text-gray-400 text-xs mx-3">
                        {m.is_final ? 'FINAL' : 'vs'}
                      </Text>

                      {/* Away */}
                      <View className="flex-1 items-end gap-0.5">
                        <Text
                          className={`font-semibold text-sm ${m.away_user === user?.id ? 'text-red-500' : 'text-gray-900'} ${awayWon ? 'font-bold' : ''}`}
                          numberOfLines={1}
                        >
                          {m.away_team_name || m.away_full_name || m.away_username}
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
