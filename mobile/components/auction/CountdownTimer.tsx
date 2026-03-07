import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'

interface CountdownTimerProps {
  expiresAt: string | null
  totalSeconds: number
}

export function CountdownTimer({ expiresAt, totalSeconds }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(0)
  const progress = useSharedValue(1)

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(0)
      progress.value = 0
      return
    }

    const update = () => {
      const now = Date.now()
      const expires = new Date(expiresAt).getTime()
      const diff = Math.max(0, expires - now)
      const secs = Math.ceil(diff / 1000)
      setRemaining(secs)

      const ratio = Math.min(1, diff / (totalSeconds * 1000))
      progress.value = withTiming(ratio, { duration: 500, easing: Easing.linear })
    }

    update()
    const interval = setInterval(update, 500)
    return () => clearInterval(interval)
  }, [expiresAt, totalSeconds])

  const ringStyle = useAnimatedStyle(() => ({
    opacity: progress.value > 0.3 ? 1 : 0.5,
  }))

  const color = remaining <= 5 ? 'text-red-500' : remaining <= 10 ? 'text-yellow-600' : 'text-green-600'
  const ringColor = remaining <= 5 ? '#ef4444' : remaining <= 10 ? '#d97706' : '#16a34a'

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={ringStyle}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 4,
            borderColor: ringColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text className={`${color} text-2xl font-bold tabular-nums`}>
            {remaining}
          </Text>
          <Text className="text-gray-400 text-xs">sec</Text>
        </View>
      </Animated.View>
    </View>
  )
}
