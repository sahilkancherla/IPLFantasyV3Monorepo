import { View, Text } from 'react-native'
import { type } from '../../constants/typography'
import { ACCENT, WIN_GREEN, SLATE_500, SLATE_400 } from '../../constants/colors'

type Status = 'live' | 'final' | 'upcoming' | 'pending'

interface Props {
  status: Status
  label?: string
}

const CONFIG: Record<Status, { color: string; label: string }> = {
  live:     { color: ACCENT,    label: 'LIVE' },
  final:    { color: WIN_GREEN, label: 'FINAL' },
  upcoming: { color: SLATE_500, label: 'NEXT' },
  pending:  { color: SLATE_400, label: 'TBD' },
}

export function StatusDot({ status, label }: Props) {
  const cfg = CONFIG[status]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color }} />
      <Text style={[type.eyebrow, { color: cfg.color, fontSize: 10 }]}>
        {label ?? cfg.label}
      </Text>
    </View>
  )
}
