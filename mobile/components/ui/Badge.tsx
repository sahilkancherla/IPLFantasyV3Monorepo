import { View, Text } from 'react-native'

interface BadgeProps {
  label: string
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray'
}

const colorStyles = {
  green: { bg: 'bg-green-100', text: 'text-green-700' },
  red: { bg: 'bg-red-100', text: 'text-red-700' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

export function Badge({ label, color = 'gray' }: BadgeProps) {
  const styles = colorStyles[color]
  return (
    <View className={`${styles.bg} px-2 py-0.5 rounded-full`}>
      <Text className={`${styles.text} text-xs font-medium`}>{label}</Text>
    </View>
  )
}
