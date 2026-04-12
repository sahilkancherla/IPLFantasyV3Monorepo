import { View, TextInput, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  TEXT_PRIMARY, TEXT_PLACEHOLDER,
  BORDER_MEDIUM, BG_CARD,
} from '../../constants/colors'

interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  value: string
  onChangeText: (text: string) => void
}

export function SearchBar({ value, onChangeText, placeholder = 'Search…', ...rest }: SearchBarProps) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: BG_CARD, borderRadius: 12,
      borderWidth: 1, borderColor: BORDER_MEDIUM,
      paddingHorizontal: 10, paddingVertical: 9,
      gap: 8,
    }}>
      <Ionicons name="search-outline" size={16} color={TEXT_PLACEHOLDER} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={TEXT_PLACEHOLDER}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          flex: 1, fontSize: 14, color: TEXT_PRIMARY, padding: 0, letterSpacing: 0,
        }}
        {...rest}
      />
    </View>
  )
}
