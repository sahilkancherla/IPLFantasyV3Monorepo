import { useState } from 'react'
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { AntDesign } from '@expo/vector-icons'
import { useRouter, Link } from 'expo-router'
import { TextInput } from '../../components/ui/TextInput'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'

export default function LoginScreen() {
  const router = useRouter()
  const { login, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      router.replace('/(app)/home')
    } catch (err: unknown) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      router.replace('/(app)/home')
    } catch (err: unknown) {
      Alert.alert('Google sign-in failed', err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-8">
          <View className="gap-2">
            <Text className="text-4xl font-bold text-gray-900">🏏 IPL Fantasy</Text>
            <Text className="text-gray-500 text-lg">Sign in to your account</Text>
          </View>

          {/* Google sign-in — disabled for now
          <TouchableOpacity
            onPress={handleGoogleLogin}
            disabled={googleLoading}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 10, backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb',
              borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20,
              opacity: googleLoading ? 0.6 : 1,
              shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
            }}
          >
            <AntDesign name="google" size={20} color="#ea4335" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            <Text style={{ color: '#9ca3af', fontSize: 13 }}>or sign in with email</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          </View>
          */}

          <View className="gap-4">
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="you@example.com"
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
            />
          </View>

          <View className="gap-3">
            <Button label="Sign In" onPress={handleLogin} loading={loading} size="lg" />
            <Link href="/(auth)/forgot-password" asChild>
              <Text className="text-center text-gray-400 text-sm">Forgot password?</Text>
            </Link>
          </View>

          <View className="flex-row justify-center gap-1">
            <Text className="text-gray-500">Don't have an account?</Text>
            <Link href="/(auth)/register">
              <Text className="text-red-600 font-semibold">Sign up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
