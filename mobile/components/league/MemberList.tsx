import { View, Text, FlatList } from 'react-native'
import { Avatar } from '../ui/Avatar'

interface Member {
  user_id: string
  team_name: string
  username: string
  display_name: string | null
  avatar_url: string | null
  roster_count: number
}

interface MemberListProps {
  members: Member[]
  adminId: string
}

export function MemberList({ members, adminId }: MemberListProps) {
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.user_id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View className="flex-row items-center gap-3 py-3 border-b border-gray-100">
          <Avatar uri={item.avatar_url} name={item.team_name || item.display_name || item.username} size={44} />
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-gray-900 font-semibold">
                {item.team_name || item.display_name || item.username}
              </Text>
              {item.user_id === adminId && (
                <Text className="text-yellow-600 text-xs">👑 Admin</Text>
              )}
            </View>
            <Text className="text-gray-400 text-xs">@{item.username}</Text>
          </View>
          <Text className="text-gray-400 text-xs">{item.roster_count} players</Text>
        </View>
      )}
    />
  )
}
