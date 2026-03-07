import { useState } from 'react'
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { AntDesign } from '@expo/vector-icons'
import { useRouter, Link } from 'expo-router'
import { TextInput } from '../../components/ui/TextInput'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'

export default function RegisterScreen() {
  const router = useRouter()
  const { register, signInWithGoogle } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all required fields')
      return
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      router.replace('/(app)/home')
    } catch (err: unknown) {
      Alert.alert('Registration failed', err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
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
            <Text className="text-4xl font-bold text-gray-900">IPL Fantasy</Text>
            <Text className="text-gray-500 text-lg">Create your account</Text>
          </View>

          {/* Google sign-up — disabled for now
          <TouchableOpacity
            onPress={handleGoogleSignUp}
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
              {googleLoading ? 'Signing up...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            <Text style={{ color: '#9ca3af', fontSize: 13 }}>or create with email</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          </View>
          */}

          <View className="gap-4">
            <TextInput
              label="Full Name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Virat Kohli"
              autoCapitalize="words"
            />
            <TextInput
              label="Email *"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
            />
            <TextInput
              label="Password *"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>

          <Button label="Create Account" onPress={handleRegister} loading={loading} size="lg" />

          <View className="flex-row justify-center gap-1">
            <Text className="text-gray-500">Already have an account?</Text>
            <Link href="/(auth)/login">
              <Text className="text-red-600 font-semibold">Sign in</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
