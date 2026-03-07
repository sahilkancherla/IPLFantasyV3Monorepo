import { Redirect } from 'expo-router'
import { useAuthStore } from '../stores/authStore'

export default function Index() {
  const { user, isLoading } = useAuthStore()
  // Wait for session restore before deciding where to go
  if (isLoading) return null
  return <Redirect href={user ? '/(app)/home' : '/(auth)/login'} />
}
