import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../lib/api'

export default function AppLayout() {
  const { user, session, isLoading, setAuth } = useAuthStore()
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (!user && session) {
      setRetrying(true)
      api.get<{ user: Parameters<typeof setAuth>[0] }>('/auth/me')
        .then(({ user }) => setAuth(user, session))
        .catch(() => {/* redirect effect handles this */})
        .finally(() => setRetrying(false))
    }
  }, [session, user])

  // Redirect unauthenticated users inside an effect so the Stack always
  // renders — guaranteeing the navigation context exists for all child screens.
  // React 19 concurrent mode can render children before a conditional early-return
  // is committed, which causes "Couldn't find a navigation context".
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/(auth)/login')
    }
  }, [isLoading, session])

  // Block screen rendering until we have confirmed the user identity.
  // Without this gate, screens render with user=null when the initial
  // profile fetch failed and we're retrying — causing isAdmin to be false.
  if (retrying || (!user && !!session)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator color="#dc2626" />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#111827',
        headerTitleStyle: { fontWeight: 'bold', color: '#111827' },
        contentStyle: { backgroundColor: '#f9fafb' },
      }}
    >
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="league/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="league/create" options={{ headerShown: false }} />
      <Stack.Screen name="league/join" options={{ headerShown: false }} />
      <Stack.Screen name="auction/[leagueId]" options={{ title: 'Auction', headerShown: false }} />
      <Stack.Screen name="team/[leagueId]" options={{ title: 'Squad' }} />
      <Stack.Screen name="team/player/[id]" options={{ title: 'Player' }} />
    </Stack>
  )
}
