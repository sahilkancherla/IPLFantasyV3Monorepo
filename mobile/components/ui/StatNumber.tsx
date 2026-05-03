import { Text, TextStyle, StyleProp } from 'react-native'
import { type } from '../../constants/typography'
import { INK } from '../../constants/colors'

interface Props {
  value: number | string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: string
  style?: StyleProp<TextStyle>
}

const SIZES = {
  sm: type.statSm,
  md: type.statM,
  lg: type.statL,
  xl: type.statXL,
} as const

export function StatNumber({ value, size = 'md', color = INK, style }: Props) {
  return (
    <Text style={[SIZES[size], { color }, style]}>
      {value}
    </Text>
  )
}
