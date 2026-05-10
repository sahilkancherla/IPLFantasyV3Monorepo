import { Image, type ImageStyle, type StyleProp } from 'react-native'
import { useImagesEnabled } from '../../hooks/useAppSettings'

interface TeamLogoProps {
  uri?: string | null
  size?: number
  style?: StyleProp<ImageStyle>
}

/** Renders a team logo, or nothing at all if the super-admin toggle is off
 *  or the URL is missing. Centralized so the global image kill-switch is
 *  enforced everywhere. */
export function TeamLogo({ uri, size = 24, style }: TeamLogoProps) {
  const imagesEnabled = useImagesEnabled()
  if (!imagesEnabled || !uri) return null
  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  )
}
