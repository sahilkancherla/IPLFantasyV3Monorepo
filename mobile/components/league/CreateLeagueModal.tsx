import { useState, useRef, useEffect } from 'react'
import { View, Text, Modal, ScrollView, Alert, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TextInput } from '../ui/TextInput'
import { NavButton } from '../ui/NavButton'
import { useCreateLeague } from '../../hooks/useLeague'
import type { Currency } from '../../lib/currency'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_CARD, BG_SUBTLE,
  PRIMARY, PRIMARY_BG,
  SUCCESS, SUCCESS_BG,
} from '../../constants/colors'

const STEPS = ['', 'Team Limits', 'Draft Type']
const SHEET_HEIGHT = Dimensions.get('window').height * 0.88

// ── Step components ───────────────────────────────────────────────────────────

function StepGeneral({ name, setName, teamName, setTeamName }: {
  name: string; setName: (v: string) => void
  teamName: string; setTeamName: (v: string) => void
}) {
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' }}>Create a League</Text>
        <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Start with the basics</Text>
      </View>
      <View style={{ gap: 14 }}>
        <TextInput label="League Name" value={name} onChangeText={setName} placeholder="My IPL Fantasy League" />
        <TextInput label="Your Team Name" value={teamName} onChangeText={setTeamName} placeholder="e.g. Chennai Challengers" />
      </View>
    </View>
  )
}

function StepTeamLimits({
  maxTeams, setMaxTeams, rosterSize, setRosterSize,
  maxBatsmen, setMaxBatsmen, maxWicketKeepers, setMaxWicketKeepers,
  maxAllRounders, setMaxAllRounders, maxBowlers, setMaxBowlers,
}: {
  maxTeams: string; setMaxTeams: (v: string) => void
  rosterSize: string; setRosterSize: (v: string) => void
  maxBatsmen: string; setMaxBatsmen: (v: string) => void
  maxWicketKeepers: string; setMaxWicketKeepers: (v: string) => void
  maxAllRounders: string; setMaxAllRounders: (v: string) => void
  maxBowlers: string; setMaxBowlers: (v: string) => void
}) {
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' }}>Team Limits</Text>
        <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>Configure roster sizes and slot caps</Text>
      </View>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TextInput label="Max Teams" value={maxTeams} onChangeText={setMaxTeams} keyboardType="numeric" placeholder="6" />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput label="Roster Size" value={rosterSize} onChangeText={setRosterSize} keyboardType="numeric" placeholder="16" />
          </View>
        </View>
        <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700' }}>Max slots per role</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TextInput label="Batsmen" value={maxBatsmen} onChangeText={setMaxBatsmen} keyboardType="numeric" placeholder="6" />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput label="Wicket-Keepers" value={maxWicketKeepers} onChangeText={setMaxWicketKeepers} keyboardType="numeric" placeholder="2" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TextInput label="All-Rounders" value={maxAllRounders} onChangeText={setMaxAllRounders} keyboardType="numeric" placeholder="4" />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput label="Bowlers" value={maxBowlers} onChangeText={setMaxBowlers} keyboardType="numeric" placeholder="6" />
          </View>
        </View>
      </View>
    </View>
  )
}

function StepDraftType({ draftType, setDraftType, currency, setCurrency, budget, setBudget, bidTimeout, setBidTimeout }: {
  draftType: 'auction' | 'snake' | null; setDraftType: (v: 'auction' | 'snake') => void
  currency: Currency; setCurrency: (v: Currency) => void
  budget: string; setBudget: (v: string) => void
  bidTimeout: string; setBidTimeout: (v: string) => void
}) {
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' }}>Draft Type</Text>
        <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>How will teams pick their players?</Text>
      </View>
      <View style={{ gap: 10 }}>
        {(['auction', 'snake'] as const).map(type => (
          <TouchableOpacity
            key={type}
            onPress={() => setDraftType(type)}
            style={{
              borderRadius: 16, padding: 18, borderWidth: 2,
              borderColor: draftType === type ? PRIMARY : BORDER_MEDIUM,
              backgroundColor: draftType === type ? PRIMARY_BG : BG_CARD,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                borderColor: draftType === type ? PRIMARY : BORDER_MEDIUM,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {draftType === type && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY }} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 16 }}>
                  {type === 'auction' ? 'Auction Draft' : 'Snake Draft'}
                </Text>
                <Text style={{ color: TEXT_MUTED, fontSize: 13, marginTop: 2 }}>
                  {type === 'auction' ? 'All managers bid on each player in real time' : 'Teams pick in order, reversing each round'}
                </Text>
                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12, marginTop: 4 }}>
                  ⏱ Typically {type === 'auction' ? '3–4 hours' : '1–2 hours'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      {draftType === 'auction' && (
        <View style={{ gap: 14 }}>
          <View style={{ height: 1, backgroundColor: BORDER_DEFAULT }} />
          <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700' }}>Auction Settings</Text>
          <View style={{ gap: 8 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 13, fontWeight: '500' }}>Currency</Text>
            <View style={{ flexDirection: 'row', backgroundColor: BG_SUBTLE, borderRadius: 12, padding: 4 }}>
              {(['lakhs', 'usd'] as Currency[]).map(c => (
                <TouchableOpacity key={c} onPress={() => { setCurrency(c); setBudget(c === 'usd' ? '1000' : '10000') }} style={{
                  flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                  backgroundColor: currency === c ? BG_CARD : 'transparent',
                  shadowColor: currency === c ? '#000' : 'transparent',
                  shadowOpacity: currency === c ? 0.06 : 0, shadowRadius: 4,
                  elevation: currency === c ? 2 : 0,
                }}>
                  <Text style={{ fontWeight: '600', fontSize: 13, color: currency === c ? TEXT_PRIMARY : TEXT_PLACEHOLDER }}>
                    {c === 'lakhs' ? '₹ Lakhs' : '$ USD'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TextInput
            label={currency === 'usd' ? 'Starting Purse ($)' : 'Starting Purse (lakhs)'}
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
            placeholder={currency === 'usd' ? '1000' : '10000'}
          />
          <TextInput label="Bid Timer (seconds)" value={bidTimeout} onChangeText={setBidTimeout} keyboardType="numeric" placeholder="15" />
        </View>
      )}
      {draftType === 'snake' && (
        <View style={{ gap: 14 }}>
          <View style={{ height: 1, backgroundColor: BORDER_DEFAULT }} />
          <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700' }}>Draft Settings</Text>
          <TextInput label="Pick Timer (seconds)" value={bidTimeout} onChangeText={setBidTimeout} keyboardType="numeric" placeholder="60" />
        </View>
      )}
    </View>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function CreateLeagueModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter()
  const { bottom: safeBottom } = useSafeAreaInsets()
  const createLeague = useCreateLeague()
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [maxTeams, setMaxTeams] = useState('6')
  const [rosterSize, setRosterSize] = useState('16')
  const [maxBatsmen, setMaxBatsmen] = useState('6')
  const [maxWicketKeepers, setMaxWicketKeepers] = useState('2')
  const [maxAllRounders, setMaxAllRounders] = useState('4')
  const [maxBowlers, setMaxBowlers] = useState('6')
  const [draftType, setDraftType] = useState<'auction' | 'snake' | null>(null)
  const [currency, setCurrency] = useState<Currency>('lakhs')
  const [budget, setBudget] = useState('10000')
  const [bidTimeout, setBidTimeout] = useState('15')

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start()
    } else {
      slideAnim.setValue(SHEET_HEIGHT)
    }
  }, [visible])

  const stepValid = [
    name.trim().length > 0 && teamName.trim().length > 0,
    (() => { const t = parseInt(maxTeams, 10); return !isNaN(t) && t >= 2 && t <= 6 })(),
    draftType !== null,
  ]
  const canNext = stepValid[step]
  const canPrev = step > 0

  const handleClose = () => {
    setStep(0)
    setName(''); setTeamName('')
    setMaxTeams('6'); setRosterSize('16')
    setMaxBatsmen('6'); setMaxWicketKeepers('2')
    setMaxAllRounders('4'); setMaxBowlers('6')
    setDraftType(null); setCurrency('lakhs'); setBudget('10000'); setBidTimeout('15')
    onClose()
  }

  const handleNext = async () => {
    if (!canNext) return
    if (step < STEPS.length - 1) { setStep(step + 1); return }
    try {
      const { league } = await createLeague.mutateAsync({
        name: name.trim(), teamName: teamName.trim(),
        startingBudget: parseInt(budget, 10) || (currency === 'usd' ? 1000 : 10000),
        maxTeams: parseInt(maxTeams, 10), rosterSize: parseInt(rosterSize, 10),
        maxBatsmen: parseInt(maxBatsmen, 10), maxWicketKeepers: parseInt(maxWicketKeepers, 10),
        maxAllRounders: parseInt(maxAllRounders, 10), maxBowlers: parseInt(maxBowlers, 10),
        currency: draftType === 'auction' ? currency : 'lakhs',
        bidTimeoutSecs: parseInt(bidTimeout, 10) || 15,
        vetoHours: 24,
      })
      handleClose()
      router.push(`/(app)/league/${league.id}`)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create league')
    }
  }

  const nextLabel = step < STEPS.length - 1 ? 'Next' : createLeague.isPending ? 'Creating…' : 'Create'

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableOpacity style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[s.sheet, { height: SHEET_HEIGHT, transform: [{ translateY: slideAnim }] }]}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <NavButton label="Cancel" onPress={handleClose} />
          </View>
          {/* Step dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 }}>
            {STEPS.map((_, i) => (
              <View key={i} style={{ height: 4, borderRadius: 2, width: i === step ? 20 : 6, backgroundColor: i <= step ? PRIMARY : BORDER_MEDIUM }} />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          {step === 0 && <StepGeneral name={name} setName={setName} teamName={teamName} setTeamName={setTeamName} />}
          {step === 1 && (
            <StepTeamLimits
              maxTeams={maxTeams} setMaxTeams={setMaxTeams}
              rosterSize={rosterSize} setRosterSize={setRosterSize}
              maxBatsmen={maxBatsmen} setMaxBatsmen={setMaxBatsmen}
              maxWicketKeepers={maxWicketKeepers} setMaxWicketKeepers={setMaxWicketKeepers}
              maxAllRounders={maxAllRounders} setMaxAllRounders={setMaxAllRounders}
              maxBowlers={maxBowlers} setMaxBowlers={setMaxBowlers}
            />
          )}
          {step === 2 && (
            <StepDraftType
              draftType={draftType} setDraftType={setDraftType}
              currency={currency} setCurrency={setCurrency}
              budget={budget} setBudget={setBudget}
              bidTimeout={bidTimeout} setBidTimeout={setBidTimeout}
            />
          )}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: safeBottom > 0 ? safeBottom : 20 }]}>
          <TouchableOpacity onPress={() => setStep(step - 1)} disabled={!canPrev} activeOpacity={0.75}
            style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: canPrev ? BG_SUBTLE : 'transparent' }}>
            <Text style={{ color: canPrev ? TEXT_SECONDARY : TEXT_DISABLED, fontWeight: '600', fontSize: 14 }}>← Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNext} disabled={!canNext || createLeague.isPending} activeOpacity={0.75}
            style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: canNext ? (step === STEPS.length - 1 ? SUCCESS_BG : BG_SUBTLE) : 'transparent' }}>
            <Text style={{ color: canNext ? (step === STEPS.length - 1 ? SUCCESS : TEXT_SECONDARY) : TEXT_DISABLED, fontWeight: '600', fontSize: 14 }}>{nextLabel} →</Text>
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
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER_DEFAULT,
  },
})
