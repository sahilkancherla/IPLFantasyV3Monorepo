import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { supabase } from '../lib/supabase'
import { apiRequest } from '../lib/api'
import { queryClient } from '../lib/queryClient'

interface AuthUser {
  id: string
  email: string
  username: string
  full_name: string
  display_name: string | null
  avatar_url: string | null
  is_super_admin: boolean
}

interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at: number
}

interface AuthState {
  user: AuthUser | null
  session: AuthSession | null
  isLoading: boolean
  setAuth: (user: AuthUser, session: AuthSession) => Promise<void>
  clearAuth: () => Promise<void>
  restoreSession: () => Promise<void>
}

// Guard so we only register the auth listener once across hot reloads
let listenerRegistered = false

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,

  setAuth: async (user, session) => {
    await SecureStore.setItemAsync('sb-access-token', session.access_token)
    await SecureStore.setItemAsync('sb-refresh-token', session.refresh_token)
    // Persist via Supabase's own storage so getSession() works on app restart
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    set({ user, session })
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('sb-access-token')
    await SecureStore.deleteItemAsync('sb-refresh-token')
    await supabase.auth.signOut()
    queryClient.clear()
    set({ user: null, session: null })
  },

  restoreSession: async () => {
    // Register the Supabase auth listener once. It fires on every token
    // refresh and keeps sb-access-token (used by api.ts and websocket.ts)
    // in sync so requests never use a stale token.
    if (!listenerRegistered) {
      listenerRegistered = true
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED' && session) {
          await SecureStore.setItemAsync('sb-access-token', session.access_token)
          await SecureStore.setItemAsync('sb-refresh-token', session.refresh_token ?? '')
          set({
            session: {
              access_token: session.access_token,
              refresh_token: session.refresh_token ?? '',
              expires_at: session.expires_at ?? 0,
            },
          })
        } else if (event === 'SIGNED_OUT') {
          await SecureStore.deleteItemAsync('sb-access-token')
          await SecureStore.deleteItemAsync('sb-refresh-token')
          queryClient.clear()
          set({ user: null, session: null })
        }
      })
    }

    try {
      let { data } = await supabase.auth.getSession()

      // No stored session — user needs to log in
      if (!data.session) {
        set({ isLoading: false })
        return
      }

      // If the access token is expired or about to expire (<60s), refresh now
      // rather than waiting for the first API call to fail.
      const nowSecs = Math.floor(Date.now() / 1000)
      if ((data.session.expires_at ?? 0) - nowSecs < 60) {
        const { data: refreshed, error } = await supabase.auth.refreshSession()
        if (error || !refreshed.session) {
          // Refresh token is expired — session is unrecoverable, force login
          await SecureStore.deleteItemAsync('sb-access-token')
          await SecureStore.deleteItemAsync('sb-refresh-token')
          set({ user: null, session: null, isLoading: false })
          return
        }
        data.session = refreshed.session
      }

      // Persist the (potentially refreshed) tokens
      await SecureStore.setItemAsync('sb-access-token', data.session.access_token)
      await SecureStore.setItemAsync('sb-refresh-token', data.session.refresh_token ?? '')

      const restoredSession: AuthSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token ?? '',
        expires_at: data.session.expires_at ?? 0,
      }

      // Fetch the user profile so the app has a user object immediately on
      // launch — no post-restore flash or separate loading state needed.
      try {
        const { user: profile } = await apiRequest<{ user: AuthUser }>(
          'GET', '/auth/me', undefined
        )
        set({ user: profile, session: restoredSession, isLoading: false })
      } catch {
        // Profile fetch failed (e.g. server down). Carry the session forward
        // so the user isn't logged out; the (app)/_layout fallback will retry.
        set({ session: restoredSession, isLoading: false })
      }
    } catch {
      // getSession() itself threw — treat as no session
      set({ isLoading: false })
    }
  },
}))
