import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { LeagueCard } from '../../components/league/LeagueCard'
import { useLeagues } from '../../hooks/useLeague'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../stores/authStore'
import { LoadingSpinner } from '../../components/ui/Loading'
import { isSuperAdmin } from '../../lib/adminApi'

export default function HomeScreen() {
  const router = useRouter()
  const { logout, deleteAccount } = useAuth()
  const { user } = useAuthStore()
  const { data: leagues, isLoading, refetch, isRefetching } = useLeagues()
  const superAdmin = isSuperAdmin(user)

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
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList
        data={leagues ?? []}
        keyExtractor={(l) => l.id}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />
        }
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={{ gap: 16, paddingTop: 8, paddingBottom: 4 }}>
            {/* Greeting */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: '#6b7280', fontSize: 13 }}>Welcome back,</Text>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '700' }}>
                  {user?.display_name ?? user?.username ?? 'Player'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                {superAdmin && (
                  <TouchableOpacity
                    onPress={() => router.push('/(app)/superadmin')}
                    style={{ backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                  >
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>⚙ Admin</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={logout}>
                  <Text style={{ color: '#9ca3af', fontSize: 13 }}>Sign out</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteAccount}>
                  <Text style={{ color: '#f87171', fontSize: 13 }}>Delete account</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Section label for leagues list */}
            <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16, marginBottom: -4 }}>
              My Leagues
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingSpinner />
          ) : (
            <View style={{ paddingTop: 48, alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 40 }}>🏏</Text>
              <Text style={{ color: '#111827', fontSize: 17, fontWeight: '700' }}>No leagues yet</Text>
              <Text style={{ color: '#6b7280', fontSize: 14, textAlign: 'center' }}>
                Create a new league or join one with an invite code
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <LeagueCard
            league={item}
            onPress={() => router.push(`/(app)/league/${item.id}`)}
          />
        )}
      />

      {/* FAB buttons */}
      <View style={{ position: 'absolute', bottom: 32, right: 24, gap: 12 }}>
        <TouchableOpacity
          style={{ backgroundColor: '#1f2937', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 }}
          onPress={() => router.push('/(app)/league/join')}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Join League</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: '#dc2626', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 }}
          onPress={() => router.push('/(app)/league/create')}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>+ Create League</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
