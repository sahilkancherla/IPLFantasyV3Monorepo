import { useState } from 'react'
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { TextInput } from '../../../components/ui/TextInput'
import { Button } from '../../../components/ui/Button'
import { useCreateLeague } from '../../../hooks/useLeague'
import type { Currency } from '../../../lib/currency'

export default function CreateLeagueScreen() {
  const router = useRouter()
  const createLeague = useCreateLeague()

  const [name, setName] = useState('')
  const [budget, setBudget] = useState('1000')
  const [maxTeams, setMaxTeams] = useState('6')
  const [rosterSize, setRosterSize] = useState('16')
  const [maxBatsmen, setMaxBatsmen] = useState('6')
  const [maxWicketKeepers, setMaxWicketKeepers] = useState('2')
  const [maxAllRounders, setMaxAllRounders] = useState('4')
  const [maxBowlers, setMaxBowlers] = useState('6')
  const [currency, setCurrency] = useState<Currency>('lakhs')
  const [bidTimeout, setBidTimeout] = useState('15')
  const [vetoHours, setVetoHours] = useState('24')

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'League name is required')
      return
    }

    const teams = parseInt(maxTeams, 10)
    if (isNaN(teams) || teams < 2 || teams > 6) {
      Alert.alert('Error', 'Max teams must be between 2 and 6')
      return
    }

    try {
      const { league } = await createLeague.mutateAsync({
        name: name.trim(),
        startingBudget: parseInt(budget, 10),
        maxTeams: teams,
        rosterSize: parseInt(rosterSize, 10),
        maxBatsmen: parseInt(maxBatsmen, 10),
        maxWicketKeepers: parseInt(maxWicketKeepers, 10),
        maxAllRounders: parseInt(maxAllRounders, 10),
        maxBowlers: parseInt(maxBowlers, 10),
        currency,
        bidTimeoutSecs: parseInt(bidTimeout, 10),
        vetoHours: parseInt(vetoHours, 10),
      })
      router.replace(`/(app)/league/${league.id}`)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create league')
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, gap: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="text-gray-900 text-2xl font-bold">Create a League</Text>
          <Text className="text-gray-500 text-sm">Up to 6 teams, 16-player rosters, weekly H2H matchups</Text>
        </View>

        <View className="gap-4">
          <TextInput
            label="League Name *"
            value={name}
            onChangeText={setName}
            placeholder="My IPL Fantasy League"
          />
          <View className="gap-2">
            <Text className="text-gray-700 text-sm font-medium">Currency</Text>
            <View className="flex-row bg-gray-100 rounded-xl p-1">
              {(['lakhs', 'usd'] as Currency[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCurrency(c)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                    backgroundColor: currency === c ? '#ffffff' : 'transparent',
                    shadowColor: currency === c ? '#000' : 'transparent',
                    shadowOpacity: currency === c ? 0.06 : 0,
                    shadowRadius: 4,
                    elevation: currency === c ? 2 : 0,
                  }}
                >
                  <Text style={{ fontWeight: '600', color: currency === c ? '#111827' : '#9ca3af', fontSize: 13 }}>
                    {c === 'lakhs' ? '₹ Lakhs' : '$ USD'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TextInput
            label={currency === 'usd' ? 'Starting Budget ($)' : 'Starting Budget (lakhs)'}
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
            placeholder="1000"
          />
          <TextInput
            label="Max Teams (2–6)"
            value={maxTeams}
            onChangeText={setMaxTeams}
            keyboardType="numeric"
            placeholder="6"
          />
          <TextInput
            label="Roster Size (11–20)"
            value={rosterSize}
            onChangeText={setRosterSize}
            keyboardType="numeric"
            placeholder="16"
          />
          <Text className="text-gray-700 text-sm font-semibold mt-2">Max Squad Slots per Role</Text>
          <TextInput
            label="Max Batsmen"
            value={maxBatsmen}
            onChangeText={setMaxBatsmen}
            keyboardType="numeric"
            placeholder="6"
          />
          <TextInput
            label="Max Wicket-Keepers"
            value={maxWicketKeepers}
            onChangeText={setMaxWicketKeepers}
            keyboardType="numeric"
            placeholder="2"
          />
          <TextInput
            label="Max All-Rounders"
            value={maxAllRounders}
            onChangeText={setMaxAllRounders}
            keyboardType="numeric"
            placeholder="4"
          />
          <TextInput
            label="Max Bowlers"
            value={maxBowlers}
            onChangeText={setMaxBowlers}
            keyboardType="numeric"
            placeholder="6"
          />
          <TextInput
            label="Draft Bid Timer (seconds)"
            value={bidTimeout}
            onChangeText={setBidTimeout}
            keyboardType="numeric"
            placeholder="15"
          />
          <TextInput
            label="Trade Veto Window (hours)"
            value={vetoHours}
            onChangeText={setVetoHours}
            keyboardType="numeric"
            placeholder="24"
          />
        </View>

        <Button
          label="Create League"
          onPress={handleCreate}
          loading={createLeague.isPending}
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
