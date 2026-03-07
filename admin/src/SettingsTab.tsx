import { useEffect, useState } from 'react'
import { api } from './api'
import type { IplWeek } from './types'

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
  const [weeks, setWeeks] = useState<IplWeek[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(api.get('/admin/settings', secret) as Promise<{ settings: Record<string, string>; weeks: IplWeek[] }>)
      .then(data => {
        setCurrentWeek(data.settings.current_week ?? '1')
        setWeeks(data.weeks ?? [])
      })
      .catch(err => alert(err.message))
  }, [secret])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/admin/settings', secret, { key: 'current_week', value: currentWeek })
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

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            This controls which week's scores count toward fantasy points and lineup locks.
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
