import { View, Text, TouchableOpacity } from 'react-native'
import type { ReactNode } from 'react'
import {
  TEXT_PRIMARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BG_CARD,
  roleColors as ROLE_COLORS,
  WARNING_BG, WARNING_DARK,
} from '../../constants/colors'

export { ROLE_COLORS as roleColors }

export const roleLabels: Record<string, string> = {
  batsman:       'BAT',
  bowler:        'BOW',
  all_rounder:   'AR',
  wicket_keeper: 'WK',
}

export const iplTeamAbbr: Record<string, string> = {
  'Mumbai Indians':               'MI',
  'Chennai Super Kings':          'CSK',
  'Royal Challengers Bengaluru':  'RCB',
  'Royal Challengers Bangalore':  'RCB',
  'Kolkata Knight Riders':        'KKR',
  'Delhi Capitals':               'DC',
  'Sunrisers Hyderabad':          'SRH',
  'Rajasthan Royals':             'RR',
  'Punjab Kings':                 'PBKS',
  'Gujarat Titans':               'GT',
  'Lucknow Super Giants':         'LSG',
}

interface PlayerRowProps {
  role: string
  name: string
  iplTeam: string
  nationality?: string
  avgPts?: number | null
  onPress?: () => void
  rightElement?: ReactNode
  backgroundColor?: string
  borderColor?: string
}

export function PlayerRow({ role, name, iplTeam, nationality, avgPts, onPress, rightElement, backgroundColor, borderColor }: PlayerRowProps) {
  const roleColor = ROLE_COLORS[role] ?? TEXT_MUTED
  const roleLabel = roleLabels[role] ?? role

  const inner = (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, gap: 10 }}>
      {/* Role badge — fixed-width container so names always align */}
      <View style={{ width: 46, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <View style={{ backgroundColor: roleColor + '18', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ color: roleColor, fontSize: 10, fontWeight: '700' }}>{roleLabel}</Text>
        </View>
      </View>

      {/* Name (+ OS badge) and team */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ color: TEXT_PRIMARY, fontWeight: '600', fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
            {name}
          </Text>
          {nationality && nationality !== 'Indian' && (
            <View style={{ backgroundColor: WARNING_BG, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 }}>
              <Text style={{ color: WARNING_DARK, fontSize: 10, fontWeight: '700' }}>OS</Text>
            </View>
          )}
        </View>
        <Text style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 1 }}>
          {iplTeamAbbr[iplTeam] ?? iplTeam}
        </Text>
      </View>

      {/* Avg pts (always shown when provided) */}
      {avgPts != null ? (
        <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 13 }}>{avgPts.toFixed(1)}</Text>
          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 9, fontWeight: '500' }}>avg pts</Text>
        </View>
      ) : !rightElement ? (
        <Text style={{ color: TEXT_DISABLED, fontSize: 12, flexShrink: 0 }}>—</Text>
      ) : null}

      {/* Right element (e.g. Drop button) */}
      {rightElement}
    </View>
  )

  const cardStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: backgroundColor ?? BG_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderColor ?? BORDER_DEFAULT,
    marginBottom: 4,
    overflow: 'hidden' as const,
  }

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={cardStyle}>
        {inner}
      </TouchableOpacity>
    )
  }

  return <View style={cardStyle}>{inner}</View>
}
