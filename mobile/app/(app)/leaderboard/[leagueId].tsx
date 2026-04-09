import { View, Text, FlatList, RefreshControl } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Avatar } from '../../../components/ui/Avatar'
import { useLeaderboard } from '../../../hooks/useTeam'
import { useAuthStore } from '../../../stores/authStore'
import { LoadingScreen } from '../../../components/ui/Loading'

const medals = ['🥇', '🥈', '🥉']

export default function LeaderboardScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const { user } = useAuthStore()
  const { data: leaderboard, isLoading, refetch, isRefetching } = useLeaderboard(leagueId!)

  if (isLoading) {
    return <LoadingScreen message="Loading leaderboard…" />
  }

  return (
    <FlatList
      data={leaderboard ?? []}
      keyExtractor={(item) => item.user_id}
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />
      }
      contentContainerStyle={{ padding: 16, gap: 8 }}
      ListEmptyComponent={
        <View className="py-16 items-center gap-3">
          <Text className="text-4xl">📊</Text>
          <Text className="text-gray-500">No leaderboard data yet</Text>
          <Text className="text-gray-400 text-sm text-center">
            Points will appear here once match scores are synced
          </Text>
        </View>
      }
      renderItem={({ item, index }) => {
        const isMe = item.user_id === user?.id
        const rank = index + 1

        return (
          <View
            className={`flex-row items-center gap-3 rounded-2xl p-4 ${
              isMe ? 'bg-red-50 border border-red-200' : 'bg-white border border-gray-100 shadow-sm'
            }`}
          >
            {/* Rank */}
            <View className="w-8 items-center">
              {rank <= 3 ? (
                <Text className="text-xl">{medals[rank - 1]}</Text>
              ) : (
                <Text className="text-gray-400 font-bold text-sm">#{rank}</Text>
              )}
            </View>

            {/* Avatar */}
            <Avatar
              uri={item.avatar_url}
              name={item.team_name || item.display_name || item.username}
              size={44}
            />

            {/* Name */}
            <View className="flex-1">
              <Text className={`font-bold ${isMe ? 'text-red-600' : 'text-gray-900'}`}>
                {item.team_name || item.display_name || item.username}
                {isMe && <Text className="text-red-400 font-normal"> (you)</Text>}
              </Text>
              <Text className="text-gray-400 text-xs">@{item.username}</Text>
            </View>

            {/* Points */}
            <View className="items-end">
              <Text className="text-yellow-600 text-lg font-bold">
                {Number(item.total_points).toFixed(1)}
              </Text>
              <Text className="text-gray-400 text-xs">pts</Text>
            </View>
          </View>
        )
      }}
    />
  )
}
