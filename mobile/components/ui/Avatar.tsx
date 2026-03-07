import { View, Text, Image } from 'react-native'

interface AvatarProps {
  uri?: string | null
  name?: string | null
  size?: number
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="bg-gray-200"
      />
    )
  }

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-red-500 items-center justify-center"
    >
      <Text
        style={{ fontSize: size * 0.35 }}
        className="text-white font-bold"
      >
        {initials}
      </Text>
    </View>
  )
}
