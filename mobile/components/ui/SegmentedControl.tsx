import { View, Text, TouchableOpacity } from 'react-native'
import {
  TEXT_PRIMARY, TEXT_MUTED, TEXT_PLACEHOLDER,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_CARD,
  PRIMARY, PRIMARY_SUBTLE,
} from '../../constants/colors'

export interface Segment<T extends string> {
  key: T
  label: string
  /** Optional count badge shown next to the label */
  count?: number
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[]
  value: T
  onChange: (key: T) => void
}

export function SegmentedControl<T extends string>({ segments, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: BORDER_DEFAULT,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    }}>
      {segments.map(seg => {
        const active = seg.key === value
        return (
          <TouchableOpacity
            key={seg.key}
            onPress={() => onChange(seg.key)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 9,
              borderRadius: 9,
              backgroundColor: active ? BG_CARD : 'transparent',
              shadowColor: '#000',
              shadowOpacity: active ? 0.06 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: active ? 2 : 0,
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: active ? '700' : '500',
              color: active ? TEXT_PRIMARY : TEXT_PLACEHOLDER,
            }}>
              {seg.label}
            </Text>
            {seg.count !== undefined && seg.count > 0 && (
              <View style={{
                backgroundColor: active ? PRIMARY_SUBTLE : BORDER_MEDIUM,
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: active ? PRIMARY : TEXT_MUTED,
                }}>
                  {seg.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
