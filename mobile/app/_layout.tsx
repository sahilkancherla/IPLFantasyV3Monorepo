import { useEffect } from 'react'
import { AppState } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider, focusManager } from '@tanstack/react-query'
import { queryClient } from '../lib/queryClient'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '../stores/authStore'
import { preloadImages } from '../lib/preloadImages'
import '../global.css'

// Refetch stale queries when the app comes back to the foreground
focusManager.setEventListener(onFocus => {
  const sub = AppState.addEventListener('change', state => onFocus(state === 'active'))
  return () => sub.remove()
})

// Keep splash visible until auth is restored
SplashScreen.preventAutoHideAsync()


export default function RootLayout() {
  const { restoreSession, isLoading } = useAuthStore()

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  // Hide splash once auth state is known. Kick off player headshot prefetch
  // in the background — first launch downloads + caches every player image,
  // subsequent launches are near-instant cache hits. Throttled (concurrency 2,
  // 3s startup delay) so backend queries on the home screen aren't starved.
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync()
      preloadImages()
    }
  }, [isLoading])

  // Don't render app screens until auth state is resolved — prevents a flash
  // where screens render with user=null (e.g. when the profile fetch in
  // restoreSession fails and AppLayout retries it).
  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient} />
      </GestureHandlerRootView>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
