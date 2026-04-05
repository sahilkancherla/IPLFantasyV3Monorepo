import { View, Text, ActivityIndicator, Modal } from 'react-native'

interface LoadingScreenProps {
  message?: string
}

/** Full-screen centered loading state — use for initial page loads */
export function LoadingScreen({ message = 'Loading…' }: LoadingScreenProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator size="large" color="#dc2626" />
      <Text style={{ color: '#9ca3af', fontSize: 14 }}>{message}</Text>
    </View>
  )
}

interface LoadingSpinnerProps {
  message?: string
}

/** Inline centered loading state — use inside scroll views or cards */
export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator size="large" color="#dc2626" />
      {message && <Text style={{ color: '#9ca3af', fontSize: 14 }}>{message}</Text>}
    </View>
  )
}

interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

/** Dimmed full-screen overlay with a centered spinner — use for async mutations */
export function LoadingOverlay({ visible, message = 'Loading…' }: LoadingOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          backgroundColor: 'white', borderRadius: 20,
          padding: 32, alignItems: 'center', gap: 14,
          shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
        }}>
          <ActivityIndicator color="#dc2626" size="large" />
          <Text style={{ color: '#374151', fontSize: 15, fontWeight: '600' }}>{message}</Text>
        </View>
      </View>
    </Modal>
  )
}
