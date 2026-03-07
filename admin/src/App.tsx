import { useState } from 'react'
import { api } from './api'
import { SettingsTab } from './SettingsTab'
import { GamesTab } from './GamesTab'
import { MatchDetail } from './MatchDetail'
import { TeamsTab } from './TeamsTab'

type Tab = 'settings' | 'games' | 'teams'

export default function App() {
  const [secret, setSecret] = useState(() => localStorage.getItem('admin-secret') ?? '')
  const [authenticated, setAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [logging, setLogging] = useState(false)

  const [tab, setTab] = useState<Tab>('games')
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)

  const handleLogin = async () => {
    if (!secret.trim()) return
    setLogging(true)
    setAuthError('')
    try {
      await api.get('/admin/settings', secret)
      localStorage.setItem('admin-secret', secret)
      setAuthenticated(true)
    } catch {
      setAuthError('Invalid admin secret. Check your ADMIN_SECRET env var.')
    } finally {
      setLogging(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin-secret')
    setAuthenticated(false)
    setSecret('')
    setSelectedMatchId(null)
  }

  if (!authenticated) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)',
      }}>
        <div style={{
          background: 'white', borderRadius: 16, padding: 40, width: 380,
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🏏</div>
            <h1 style={{ margin: 0, fontSize: 22, color: '#111827' }}>IPL Fantasy</h1>
            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>System Admin</p>
          </div>

          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151', fontSize: 14 }}>
            Admin Secret
          </label>
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter admin secret…"
            autoFocus
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 8,
              border: authError ? '1px solid #ef4444' : '1px solid #d1d5db',
              fontSize: 14, marginBottom: 8,
            }}
          />
          {authError && (
            <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 12px' }}>{authError}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={logging || !secret.trim()}
            style={{
              width: '100%', padding: '11px', background: logging ? '#9ca3af' : '#dc2626',
              color: 'white', border: 'none', borderRadius: 8, fontWeight: 700,
              cursor: 'pointer', fontSize: 15, marginTop: 4,
            }}
          >
            {logging ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <header style={{
        background: '#1e1b4b', color: 'white', padding: '0 28px',
        display: 'flex', alignItems: 'center', gap: 0, height: 56, flexShrink: 0,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <span style={{ fontSize: 20, marginRight: 10 }}>🏏</span>
        <span style={{ fontWeight: 700, fontSize: 16, marginRight: 32 }}>IPL Fantasy Admin</span>

        {selectedMatchId ? (
          <span style={{ color: '#a5b4fc', fontSize: 14 }}>IPL Games → Match Stats</span>
        ) : (
          <nav style={{ display: 'flex', gap: 4 }}>
            {([
                ['games', 'IPL Games'],
                ['teams', 'Teams & Players'],
                ['settings', 'General Settings'],
              ] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 16px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontWeight: 600, fontSize: 14,
                  background: tab === t ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: tab === t ? 'white' : '#a5b4fc',
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        <button
          onClick={handleLogout}
          style={{
            marginLeft: 'auto', padding: '6px 14px', background: 'rgba(255,255,255,0.1)',
            color: '#e0e7ff', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}
        >
          Sign Out
        </button>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {selectedMatchId ? (
          <MatchDetail
            matchId={selectedMatchId}
            secret={secret}
            onBack={() => setSelectedMatchId(null)}
          />
        ) : tab === 'games' ? (
          <GamesTab secret={secret} onSelectMatch={setSelectedMatchId} />
        ) : tab === 'teams' ? (
          <TeamsTab secret={secret} />
        ) : (
          <SettingsTab secret={secret} />
        )}
      </main>
    </div>
  )
}
