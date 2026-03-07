import { useState } from 'react'
import { View, Text, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { TextInput } from '../../../components/ui/TextInput'
import { Button } from '../../../components/ui/Button'
import { useJoinLeague } from '../../../hooks/useLeague'

export default function JoinLeagueScreen() {
  const router = useRouter()
  const joinLeague = useJoinLeague()
  const [code, setCode] = useState('')

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length !== 6) {
      Alert.alert('Error', 'Invite code must be 6 characters')
      return
    }

    try {
      const { league } = await joinLeague.mutateAsync(trimmed)
      router.replace(`/(app)/league/${league.id}`)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Invalid invite code or league is full')
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center p-6 gap-8">
        <View className="gap-2">
          <Text className="text-gray-900 text-2xl font-bold">Join a League</Text>
          <Text className="text-gray-500">Enter the 6-character invite code from your friend</Text>
        </View>

        <TextInput
          label="Invite Code"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="ABC123"
          autoCapitalize="characters"
          maxLength={6}
          style={{ letterSpacing: 8, fontSize: 24, textAlign: 'center', paddingVertical: 20 }}
        />

        <Button
          label="Join League"
          onPress={handleJoin}
          loading={joinLeague.isPending}
          disabled={code.trim().length !== 6}
          size="lg"
        />
      </View>
    </KeyboardAvoidingView>
  )
}
