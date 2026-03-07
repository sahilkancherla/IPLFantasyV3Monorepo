import { useState } from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity, FlatList, Modal } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Button } from '../../../../components/ui/Button'
import { TextInput } from '../../../../components/ui/TextInput'
import { useProposeTrade } from '../../../../hooks/useTrades'
import { useTeam, useAllTeams } from '../../../../hooks/useTeam'
import { useLeague } from '../../../../hooks/useLeague'
import { useAuthStore } from '../../../../stores/authStore'

interface Player {
  player_id: string
  name: string
  role: string
  ipl_team: string
  price: number
}

export default function ProposeTradeScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const { data: leagueData } = useLeague(leagueId!)
  const { data: myTeamData } = useTeam(leagueId!)
  const { data: allTeamsData } = useAllTeams(leagueId!)
  const proposeTrade = useProposeTrade(leagueId!)

  const [receiverId, setReceiverId] = useState('')
  const [note, setNote] = useState('')
  const [myPlayers, setMyPlayers] = useState<Player[]>([])
  const [theirPlayers, setTheirPlayers] = useState<Player[]>([])
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerFor, setPickerFor] = useState<'mine' | 'theirs'>('mine')

  const members = leagueData?.members ?? []
  const otherMembers = members.filter((m) => m.user_id !== user?.id)
  const myRoster: Player[] = (myTeamData ?? []).map((r: any) => ({
    player_id: r.player_id,
    name: r.player_name,
    role: r.player_role,
    ipl_team: r.player_ipl_team,
    price: r.price_paid,
  }))
  const allRosters: Record<string, Player[]> = {}
  for (const entry of (allTeamsData ?? []) as any[]) {
    if (!allRosters[entry.user_id]) allRosters[entry.user_id] = []
    allRosters[entry.user_id].push({
      player_id: entry.player_id,
      name: entry.player_name,
      role: entry.player_role,
      ipl_team: entry.player_ipl_team,
      price: entry.price_paid,
    })
  }
  const theirRoster: Player[] = receiverId ? (allRosters[receiverId] ?? []) : []

  const handleSubmit = async () => {
    if (!receiverId) {
      Alert.alert('Select a trading partner')
      return
    }
    if (myPlayers.length === 0 && theirPlayers.length === 0) {
      Alert.alert('Add at least one player to the trade')
      return
    }

    const items = [
      ...myPlayers.map((p) => ({ playerId: p.player_id, fromUser: user!.id, toUser: receiverId })),
      ...theirPlayers.map((p) => ({ playerId: p.player_id, fromUser: receiverId, toUser: user!.id })),
    ]

    try {
      await proposeTrade.mutateAsync({ receiverId, note: note.trim() || undefined, items })
      Alert.alert('Trade Proposed', 'Waiting for the other manager to respond', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to propose trade')
    }
  }

  const addPlayer = (player: Player) => {
    if (pickerFor === 'mine') {
      if (!myPlayers.find((p) => p.player_id === player.player_id)) {
        setMyPlayers([...myPlayers, player])
      }
    } else {
      if (!theirPlayers.find((p) => p.player_id === player.player_id)) {
        setTheirPlayers([...theirPlayers, player])
      }
    }
    setPickerVisible(false)
  }

  const pickerData = pickerFor === 'mine' ? myRoster : theirRoster

  return (
    <>
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4 gap-4">
          <Text className="text-gray-900 text-2xl font-bold">Propose a Trade</Text>

          {/* Trading partner */}
          <View className="bg-white rounded-2xl p-4 gap-2 border border-gray-100 shadow-sm">
            <Text className="text-gray-500 text-sm uppercase font-semibold tracking-wide">Trading with</Text>
            <View className="flex-row flex-wrap gap-2">
              {otherMembers.map((m) => (
                <TouchableOpacity
                  key={m.user_id}
                  className={`px-4 py-2 rounded-xl ${receiverId === m.user_id ? 'bg-red-500' : 'bg-gray-100'}`}
                  onPress={() => { setReceiverId(m.user_id); setTheirPlayers([]) }}
                >
                  <Text className="text-gray-900 font-medium">
                    {m.full_name || m.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* My players */}
          <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
            <Text className="text-gray-900 font-bold">You send</Text>
            {myPlayers.map((p) => (
              <View key={p.player_id} className="flex-row items-center justify-between">
                <Text className="text-gray-900">{p.name}</Text>
                <TouchableOpacity onPress={() => setMyPlayers(myPlayers.filter((x) => x.player_id !== p.player_id))}>
                  <Text className="text-red-500 text-sm">Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <Button
              label="Add player"
              variant="ghost"
              onPress={() => { setPickerFor('mine'); setPickerVisible(true) }}
            />
          </View>

          {/* Their players */}
          <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
            <Text className="text-gray-900 font-bold">You receive</Text>
            {theirPlayers.map((p) => (
              <View key={p.player_id} className="flex-row items-center justify-between">
                <Text className="text-gray-900">{p.name}</Text>
                <TouchableOpacity onPress={() => setTheirPlayers(theirPlayers.filter((x) => x.player_id !== p.player_id))}>
                  <Text className="text-red-500 text-sm">Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <Button
              label="Add player"
              variant="ghost"
              onPress={() => { setPickerFor('theirs'); setPickerVisible(true) }}
              disabled={!receiverId}
            />
          </View>

          {/* Optional note */}
          <TextInput
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Add a message with your offer..."
            multiline
          />

          <Button
            label="Send Trade Proposal"
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            loading={proposeTrade.isPending}
          />
        </View>
      </ScrollView>

      {/* Player picker */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end">
          <View className="bg-white rounded-t-3xl p-4 gap-4 max-h-[70%] border border-gray-100 shadow-sm">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-900 font-bold text-lg">
                {pickerFor === 'mine' ? 'Your players' : 'Their players'}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text className="text-red-500 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerData}
              keyExtractor={(item) => item.player_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="flex-row items-center justify-between py-3 border-b border-gray-200"
                  onPress={() => addPlayer(item)}
                >
                  <View>
                    <Text className="text-gray-900 font-medium">{item.name}</Text>
                    <Text className="text-gray-500 text-sm">{item.ipl_team} · {item.role}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text className="text-gray-400 text-center py-8">
                  {pickerFor === 'theirs' && !receiverId ? 'Select a trading partner first' : 'No players available'}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  )
}
