import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { LeagueCard } from '../../components/league/LeagueCard'
import { useLeagues } from '../../hooks/useLeague'
import { useAuth } from '../../hooks/useAuth'

export default function HomeScreen() {
  const router = useRouter()
  const { user, logout, deleteAccount } = useAuth()
  const { data: leagues, isLoading, refetch, isRefetching } = useLeagues()

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount()
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.')
            }
          },
        },
      ]
    )
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={leagues ?? []}
        keyExtractor={(l) => l.id}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />
        }
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        ListHeaderComponent={
          <View className="py-2 mb-2 gap-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-gray-500 text-sm">Welcome back,</Text>
                <Text className="text-gray-900 text-xl font-bold">
                  {user?.display_name ?? user?.username ?? 'Player'}
                </Text>
              </View>
              <View className="flex-row gap-4">
                <TouchableOpacity onPress={logout}>
                  <Text className="text-gray-400 text-sm">Sign out</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteAccount}>
                  <Text className="text-red-400 text-sm">Delete account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View className="py-16 items-center gap-4">
              <Text className="text-4xl">🏏</Text>
              <Text className="text-gray-900 text-lg font-bold">No leagues yet</Text>
              <Text className="text-gray-500 text-center">
                Create a new league or join one with an invite code
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <LeagueCard
            league={item}
            onPress={() => router.push(`/(app)/league/${item.id}`)}
          />
        )}
      />

      {/* FAB buttons */}
      <View className="absolute bottom-8 right-6 gap-3">
        <TouchableOpacity
          className="bg-gray-800 rounded-full px-5 py-3 flex-row items-center justify-center shadow-lg"
          onPress={() => router.push('/(app)/league/join')}
        >
          <Text className="text-white font-semibold text-center">Join League</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-red-600 rounded-full px-5 py-3 flex-row items-center justify-center shadow-lg"
          onPress={() => router.push('/(app)/league/create')}
        >
          <Text className="text-white font-bold text-center">+ Create League</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
