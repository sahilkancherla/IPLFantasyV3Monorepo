import { View, Text, Image } from 'react-native'

interface AvatarProps {
  uri?: string | null
  name?: string | null
  size?: number
  /** When true and no uri, shows a plain neutral circle (no initials). */
  neutralFallback?: boolean
}

export function Avatar({ uri, name, size = 40, neutralFallback = false }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  if (uri) {
    // Render the image at 2x height inside a 1x clipping circle, anchored to
    // the top — so the headshot's head/shoulders fill the avatar instead of
    // the full waist-up frame being squashed into a tiny circle.
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#e5e7eb',
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri }}
          style={{ width: size, height: size * 2, position: 'absolute', top: 0, left: 0 }}
          resizeMode="cover"
        />
      </View>
    )
  }

  if (neutralFallback) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#e5e7eb',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#9ca3af', fontSize: size * 0.45, fontWeight: '600' }}>
          {initials}
        </Text>
      </View>
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
