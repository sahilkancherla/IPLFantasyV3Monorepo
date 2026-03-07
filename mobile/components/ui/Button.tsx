import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from 'react-native'

interface ButtonProps extends TouchableOpacityProps {
  label: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variantStyles = {
  primary: 'bg-red-600 active:bg-red-700',
  secondary: 'bg-gray-200 active:bg-gray-300',
  danger: 'bg-red-100 active:bg-red-200',
  ghost: 'bg-transparent border border-gray-300',
}

const textStyles = {
  primary: 'text-white font-semibold',
  secondary: 'text-gray-800 font-semibold',
  danger: 'text-red-700 font-semibold',
  ghost: 'text-gray-600',
}

const sizeStyles = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2.5',
  lg: 'px-6 py-3.5',
}

const textSizeStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps & { className?: string }) {
  return (
    <TouchableOpacity
      className={`rounded-xl items-center justify-center ${variantStyles[variant]} ${sizeStyles[size]} ${disabled || loading ? 'opacity-50' : ''} ${className ?? ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? 'white' : '#374151'} size="small" />
      ) : (
        <Text className={`${textStyles[variant]} ${textSizeStyles[size]}`}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}
