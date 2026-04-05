import { useEffect, useState } from 'react'
import { api } from './api'
import type { IplWeek, IplMatch } from './types'

const card: React.CSSProperties = {
  background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24,
}
const label: React.CSSProperties = {
  display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151', fontSize: 14,
}
const select: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 14, background: 'white',
}
const btn = (bg: string): React.CSSProperties => ({
  padding: '10px 24px', background: bg, color: 'white', border: 'none',
  borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
})

export function SettingsTab({ secret }: { secret: string }) {
  const [currentWeek, setCurrentWeek] = useState('1')
  const [currentMatch, setCurrentMatch] = useState('')
  const [weeks, setWeeks] = useState<IplWeek[]>([])
  const [matches, setMatches] = useState<IplMatch[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/admin/settings', secret) as Promise<{ settings: Record<string, string>; weeks: IplWeek[] }>,
      api.get('/admin/matches', secret) as Promise<{ matches: IplMatch[] }>,
    ])
      .then(([settingsData, matchesData]) => {
        setCurrentWeek(settingsData.settings.current_week ?? '1')
        setCurrentMatch(settingsData.settings.current_match ?? '')
        setWeeks(settingsData.weeks ?? [])
        // Sort matches by date asc for the dropdown
        setMatches([...matchesData.matches].sort((a, b) => a.match_date.localeCompare(b.match_date)))
      })
      .catch(err => alert(err instanceof Error ? err.message : 'Failed to load'))
  }, [secret])

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        api.patch('/admin/settings', secret, { key: 'current_week', value: currentWeek }),
        api.patch('/admin/settings', secret, { key: 'current_match', value: currentMatch }),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h2 style={{ margin: '0 0 24px' }}>General Settings</h2>

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <label style={label}>Current IPL Week</label>
          <select value={currentWeek} onChange={e => setCurrentWeek(e.target.value)} style={select}>
            {weeks.map(w => (
              <option key={w.week_num} value={String(w.week_num)}>
                Week {w.week_num} — {w.label} &nbsp;({w.start_date} → {w.end_date})
              </option>
            ))}
          </select>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '8px 0 0' }}>
            Controls which week's scores count toward fantasy points and lineup locks.
          </p>
        </div>

        <div>
          <label style={label}>Current Game</label>
          <select value={currentMatch} onChange={e => setCurrentMatch(e.target.value)} style={select}>
            <option value="">None</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {m.match_date} — {m.home_team} vs {m.away_team}
                {m.week_num != null ? ` (W${m.week_num})` : ''}
                {m.is_completed ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '8px 0 0' }}>
            The live or most recent match. Used to drive scorecard imports and live scoring.
          </p>
        </div>

        <div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btn(saved ? '#16a34a' : saving ? '#9ca3af' : '#dc2626')}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
