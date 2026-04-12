import { TextInput as RNTextInput, Text, View, StyleSheet, type TextInputProps } from 'react-native'
import {
  TEXT_PRIMARY, TEXT_MUTED, TEXT_PLACEHOLDER,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_SUBTLE,
} from '../../constants/colors'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export function TextInput({ label, error, style, ...props }: InputProps) {
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <RNTextInput
        style={[s.input, error ? s.inputError : null, style]}
        placeholderTextColor={TEXT_PLACEHOLDER}
        {...props}
      />
      {error && <Text style={s.error}>{error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  label: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    backgroundColor: BG_SUBTLE,
    color: TEXT_PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    letterSpacing: 0,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  inputError: {
    borderColor: '#f87171',
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
  },
})
