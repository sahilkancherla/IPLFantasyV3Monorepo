import { useEffect, useState } from 'react'
import { api } from './api'

interface LeagueRow {
  id: string
  name: string
  status: string
  currency: string
  starting_budget: number
  created_at: string
  member_count: number
  is_live: boolean
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft_pending:   { label: 'Draft Pending',  color: '#6b7280', bg: '#f3f4f6' },
  draft_active:    { label: 'AUCTION LIVE',   color: '#dc2626', bg: '#fef2f2' },
  league_active:   { label: 'Season Active',  color: '#16a34a', bg: '#f0fdf4' },
  league_complete: { label: 'Complete',       color: '#2563eb', bg: '#eff6ff' },
}

interface Props {
  secret: string
  onSelect: (id: string, name: string) => void
}

export function LeaguesTab({ secret, onSelect }: Props) {
  const [leagues, setLeagues] = useState<LeagueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/admin/leagues', secret)
      .then((d: any) => setLeagues(d.leagues))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secret])

  if (loading) return <div style={{ padding: 40, color: '#6b7280' }}>Loading leagues…</div>
  if (error) return <div style={{ padding: 40, color: '#ef4444' }}>Error: {error}</div>

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Leagues & Auctions
      </h2>

      {leagues.length === 0 ? (
        <div style={{ color: '#9ca3af', padding: 40, textAlign: 'center' }}>No leagues yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {leagues.map(l => {
            const s = STATUS_LABELS[l.status] ?? { label: l.status, color: '#6b7280', bg: '#f3f4f6' }
            return (
              <div
                key={l.id}
                onClick={() => onSelect(l.id, l.name)}
                style={{
                  background: 'white', borderRadius: 12, padding: '16px 20px',
                  border: l.is_live ? '2px solid #dc2626' : '1px solid #e5e7eb',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                  transition: 'box-shadow 0.15s',
                  boxShadow: l.is_live ? '0 0 0 3px rgba(220,38,38,0.1)' : '0 1px 3px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = l.is_live ? '0 0 0 3px rgba(220,38,38,0.1)' : '0 1px 3px rgba(0,0,0,0.06)')}
              >
                {l.is_live && (
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', background: '#dc2626',
                    flexShrink: 0, boxShadow: '0 0 0 3px rgba(220,38,38,0.3)',
                    animation: 'pulse 1.5s infinite',
                  }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{l.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      color: s.color, background: s.bg, letterSpacing: 0.3,
                    }}>{s.label}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280', display: 'flex', gap: 16 }}>
                    <span>{l.member_count} member{l.member_count !== 1 ? 's' : ''}</span>
                    <span>{l.currency === 'usd' ? `$${l.starting_budget}` : `₹${l.starting_budget}L`} budget</span>
                    <span>{new Date(l.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <span style={{ color: '#9ca3af', fontSize: 18 }}>›</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
