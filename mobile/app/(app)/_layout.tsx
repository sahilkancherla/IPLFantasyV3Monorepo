import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../lib/api'

export default function AppLayout() {
  const { user, session, isLoading, setAuth } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user && session) {
      api.get<{ user: Parameters<typeof setAuth>[0] }>('/auth/me')
        .then(({ user }) => setAuth(user, session))
        .catch(() => {/* handled by redirect effect below */})
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

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#111827',
        headerTitleStyle: { fontWeight: 'bold', color: '#111827' },
        contentStyle: { backgroundColor: '#f9fafb' },
      }}
    >
      <Stack.Screen name="home" options={{ title: 'IPL Fantasy', headerLargeTitle: true }} />
      <Stack.Screen name="league/[id]" options={{ title: 'League' }} />
      <Stack.Screen name="league/create" options={{ title: 'Create League', presentation: 'modal' }} />
      <Stack.Screen name="league/join" options={{ title: 'Join League', presentation: 'modal' }} />
      <Stack.Screen name="auction/[leagueId]" options={{ title: 'Auction', headerShown: false }} />
      <Stack.Screen name="team/[leagueId]" options={{ title: 'Squad' }} />
      <Stack.Screen name="team/player/[id]" options={{ title: 'Player' }} />
    </Stack>
  )
}
