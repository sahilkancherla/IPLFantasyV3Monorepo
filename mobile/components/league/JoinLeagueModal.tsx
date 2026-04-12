import { useState, useRef, useEffect } from 'react'
import { View, Text, Modal, Alert, TouchableOpacity, Animated, ScrollView, StyleSheet, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TextInput } from '../ui/TextInput'
import { NavButton } from '../ui/NavButton'
import { useJoinLeague } from '../../hooks/useLeague'
import {
  TEXT_PRIMARY, TEXT_MUTED, TEXT_DISABLED,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_CARD,
  SUCCESS, SUCCESS_BG,
} from '../../constants/colors'

const SHEET_HEIGHT = Dimensions.get('window').height * 0.88

export function JoinLeagueModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter()
  const { bottom: safeBottom } = useSafeAreaInsets()
  const joinLeague = useJoinLeague()
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current
  const [code, setCode] = useState('')
  const [teamName, setTeamName] = useState('')

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start()
    } else {
      slideAnim.setValue(SHEET_HEIGHT)
    }
  }, [visible])

  const canJoin = code.trim().length === 6 && teamName.trim().length > 0

  const handleClose = () => {
    setCode('')
    setTeamName('')
    onClose()
  }

  const handleJoin = async () => {
    try {
      const { league } = await joinLeague.mutateAsync({ inviteCode: code.trim().toUpperCase(), teamName: teamName.trim() })
      handleClose()
      router.push(`/(app)/league/${league.id}`)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Invalid invite code or league is full')
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableOpacity style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[s.sheet, { height: SHEET_HEIGHT, transform: [{ translateY: slideAnim }] }]}>
        <View style={s.handle} />

        {/* Header — Cancel only, no text */}
        <View style={s.header}>
          <NavButton label="Cancel" onPress={handleClose} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4 }}>
            <Text style={{ color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' }}>Join a League</Text>
            <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Enter the invite code and pick your team name</Text>
          </View>
          <View style={{ gap: 14 }}>
            <TextInput
              label="Invite Code"
              value={code}
              onChangeText={t => setCode(t.toUpperCase())}
              placeholder="ABC123"
              autoCapitalize="characters"
              maxLength={6}
              style={{ letterSpacing: 8, fontSize: 24, textAlign: 'center', paddingVertical: 20 }}
            />
            <TextInput
              label="Your Team Name"
              value={teamName}
              onChangeText={setTeamName}
              placeholder="e.g. Mumbai Mavericks"
            />
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: safeBottom > 0 ? safeBottom : 20 }]}>
          <TouchableOpacity onPress={handleJoin} disabled={!canJoin || joinLeague.isPending} activeOpacity={0.75}
            style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: canJoin ? SUCCESS_BG : 'transparent' }}>
            <Text style={{ color: canJoin ? SUCCESS : TEXT_DISABLED, fontWeight: '600', fontSize: 14 }}>
              {joinLeague.isPending ? 'Joining…' : 'Join League →'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: BG_CARD,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 10,
  },
  handle: {
    width: 36, height: 4, backgroundColor: BORDER_MEDIUM,
    borderRadius: 2, alignSelf: 'center', marginBottom: 10,
  },
  header: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER_DEFAULT,
  },
})
