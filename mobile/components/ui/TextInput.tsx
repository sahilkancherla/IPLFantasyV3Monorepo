import { TextInput as RNTextInput, Text, View, type TextInputProps } from 'react-native'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export function TextInput({ label, error, ...props }: InputProps) {
  return (
    <View className="gap-1.5">
      {label && <Text className="text-gray-600 text-sm font-medium">{label}</Text>}
      <RNTextInput
        className={`bg-gray-100 text-gray-900 rounded-xl px-4 py-3 text-base border ${error ? 'border-red-400' : 'border-gray-200'}`}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error && <Text className="text-red-500 text-xs">{error}</Text>}
    </View>
  )
}
