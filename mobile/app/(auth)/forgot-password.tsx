import { useState } from 'react'
import { View, Text, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { TextInput } from '../../components/ui/TextInput'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleReset = async () => {
    if (!email) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())
      if (error) throw error
      setSent(true)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-6 gap-4">
        <Text className="text-4xl">📧</Text>
        <Text className="text-gray-900 text-xl font-bold text-center">Check your email</Text>
        <Text className="text-gray-500 text-center">We sent a password reset link to {email}</Text>
        <Button label="Back to Login" variant="secondary" onPress={() => router.back()} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center p-6 gap-8">
        <View className="gap-2">
          <Text className="text-gray-900 text-2xl font-bold">Reset Password</Text>
          <Text className="text-gray-500">Enter your email to receive a reset link</Text>
        </View>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
        />

        <View className="gap-3">
          <Button label="Send Reset Link" onPress={handleReset} loading={loading} />
          <Button label="Back to Login" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
