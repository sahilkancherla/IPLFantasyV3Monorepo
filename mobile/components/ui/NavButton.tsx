import { TouchableOpacity, Text } from 'react-native'
import { TEXT_SECONDARY, BG_SUBTLE } from '../../constants/colors'

interface NavButtonProps {
  label: string
  onPress: () => void
}

export function NavButton({ label, onPress }: NavButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20, backgroundColor: BG_SUBTLE,
      }}
    >
      <Text style={{ color: TEXT_SECONDARY, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  )
}
