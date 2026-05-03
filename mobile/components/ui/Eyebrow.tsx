import { Text, TextStyle, StyleProp } from 'react-native'
import { type } from '../../constants/typography'
import { SLATE_500 } from '../../constants/colors'

interface Props {
  children: React.ReactNode
  color?: string
  size?: 10 | 11 | 12
  style?: StyleProp<TextStyle>
}

export function Eyebrow({ children, color = SLATE_500, size = 11, style }: Props) {
  return (
    <Text style={[type.eyebrow, { color, fontSize: size }, style]}>
      {children}
    </Text>
  )
}
