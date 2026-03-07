import { useCallback } from 'react'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../stores/authStore'
import { apiRequest } from '../lib/api'
import { supabase } from '../lib/supabase'

// Required on iOS — allows the in-app browser to hand off the session back to the app
WebBrowser.maybeCompleteAuthSession()

interface LoginResult {
  user: { id: string; email: string; username: string; full_name: string; display_name: string | null; avatar_url: string | null }
  session: { access_token: string; refresh_token: string; expires_at: number }
}

export function useAuth() {
  const { user, session, isLoading, setAuth, clearAuth } = useAuthStore()

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<LoginResult>('POST', '/auth/login', { email, password }, { skipAuth: true })
    await setAuth(result.user, result.session)
    return result
  }, [setAuth])

  const register = useCallback(async (data: {
    email: string
    password: string
    fullName: string
  }) => {
    const result = await apiRequest<LoginResult>('POST', '/auth/register', data, { skipAuth: true })
    await setAuth(result.user, result.session)
    return result
  }, [setAuth])

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = Linking.createURL('auth/callback')

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })

    if (error || !data.url) throw error ?? new Error('No auth URL returned')

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type !== 'success') return // user cancelled

    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url)
    if (sessionError || !sessionData.session) throw sessionError ?? new Error('No session after Google login')

    const { access_token, refresh_token, expires_at } = sessionData.session

    // Write our SecureStore keys so apiRequest picks up the fresh token
    await SecureStore.setItemAsync('sb-access-token', access_token)
    await SecureStore.setItemAsync('sb-refresh-token', refresh_token ?? '')

    const { user: profile } = await apiRequest<{ user: LoginResult['user'] }>('GET', '/auth/me', undefined)

    await setAuth(profile, {
      access_token,
      refresh_token: refresh_token ?? '',
      expires_at: expires_at ?? 0,
    })
  }, [setAuth])

  const deleteAccount = useCallback(async () => {
    await apiRequest('DELETE', '/auth/me', undefined)
    await clearAuth()
  }, [clearAuth])

  const logout = useCallback(async () => {
    await clearAuth()
  }, [clearAuth])

  const updateProfile = useCallback(async (data: { fullName?: string; displayName?: string; avatarUrl?: string }) => {
    const result = await apiRequest<{ user: LoginResult['user'] }>('PATCH', '/auth/me', data)
    if (result.user && session) {
      await setAuth(result.user, session)
    }
    return result
  }, [session, setAuth])

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    signInWithGoogle,
    logout,
    deleteAccount,
    updateProfile,
  }
}
