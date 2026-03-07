import { View, type ViewProps } from 'react-native'

interface CardProps extends ViewProps {
  className?: string
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <View
      className={`bg-white rounded-2xl p-4 border border-gray-100 shadow-sm ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  )
}
