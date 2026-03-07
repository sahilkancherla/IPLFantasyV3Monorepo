import { useEffect, useState, useCallback } from 'react'
import { api } from './api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Player {
  id: string
  name: string
  ipl_team: string
  role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper'
  base_price: number
  nationality: string
  image_url: string | null
  is_active: boolean
}

const ROLES = ['batsman', 'wicket_keeper', 'all_rounder', 'bowler'] as const
const ROLE_LABELS: Record<string, string> = {
  batsman: 'Batsman', bowler: 'Bowler', all_rounder: 'All-Rounder', wicket_keeper: 'Wicket-Keeper',
}
const ROLE_COLORS: Record<string, string> = {
  batsman: '#2563eb', bowler: '#dc2626', all_rounder: '#16a34a', wicket_keeper: '#d97706',
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 14, background: 'white',
}
const btn = (bg: string, color = 'white', border = bg): React.CSSProperties => ({
  padding: '8px 16px', background: bg, color, border: `1px solid ${border}`,
  borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
})
const roleBadge = (role: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11,
  fontWeight: 700, color: 'white', background: ROLE_COLORS[role] ?? '#6b7280',
})

// ── Empty player form ─────────────────────────────────────────────────────────

function emptyForm(team: string) {
  return { name: '', iplTeam: team, role: 'batsman' as Player['role'], basePrice: '200', nationality: 'Indian', imageUrl: '', isActive: true }
}

type FormState = ReturnType<typeof emptyForm>

// ── Player form (add or edit) ─────────────────────────────────────────────────

function PlayerForm({
  initial,
  teams,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState
  teams: string[]
  onSave: (f: FormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [f, setF] = useState(initial)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(p => ({ ...p, [k]: v }))

  return (
    <div style={{
      background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
    }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{initial.name ? `Edit — ${initial.name}` : 'Add New Player'}</h3>
      </div>

      <Field label="Name *">
        <input value={f.name} onChange={e => set('name', e.target.value)} style={inp} placeholder="Player name" />
      </Field>

      <Field label="IPL Team *">
        <select value={f.iplTeam} onChange={e => set('iplTeam', e.target.value)} style={inp}>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>

      <Field label="Role *">
        <select value={f.role} onChange={e => set('role', e.target.value as Player['role'])} style={inp}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </Field>

      <Field label="Base Price (₹L)">
        <input
          type="number" min={0} value={f.basePrice}
          onChange={e => set('basePrice', e.target.value)}
          style={inp}
        />
      </Field>

      <Field label="Nationality">
        <input value={f.nationality} onChange={e => set('nationality', e.target.value)} style={inp} />
      </Field>

      <Field label="Image URL">
        <input value={f.imageUrl} onChange={e => set('imageUrl', e.target.value)} style={inp} placeholder="https://…" />
      </Field>

      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          <input
            type="checkbox" checked={f.isActive}
            onChange={e => set('isActive', e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Active player
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={btn('white', '#374151', '#d1d5db')}>Cancel</button>
          <button
            onClick={() => onSave(f)}
            disabled={saving || !f.name.trim()}
            style={btn(saving ? '#9ca3af' : '#dc2626')}
          >
            {saving ? 'Saving…' : 'Save Player'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Team detail view ──────────────────────────────────────────────────────────

function TeamDetail({
  team,
  secret,
  teams,
  onBack,
}: {
  team: string
  secret: string
  teams: string[]
  onBack: () => void
}) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchPlayers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/admin/players?team=${encodeURIComponent(team)}`, secret) as { players: Player[] }
      setPlayers(data.players)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }, [team, secret])

  useEffect(() => { fetchPlayers() }, [fetchPlayers])

  const handleSave = async (f: FormState, playerId?: string) => {
    const price = parseInt(f.basePrice, 10)
    if (!f.name.trim()) { alert('Name is required'); return }
    if (isNaN(price) || price < 0) { alert('Enter a valid base price'); return }
    setSaving(true)
    try {
      const body = {
        name: f.name.trim(),
        iplTeam: f.iplTeam,
        role: f.role,
        basePrice: price,
        nationality: f.nationality.trim() || 'Indian',
        imageUrl: f.imageUrl.trim() || null,
        isActive: f.isActive,
      }
      if (playerId) {
        await api.patch(`/admin/players/${playerId}`, secret, body)
      } else {
        await api.post('/admin/players', secret, body)
      }
      setEditingId(null)
      fetchPlayers()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (p: Player) => {
    try {
      await api.patch(`/admin/players/${p.id}`, secret, { isActive: !p.is_active })
      setPlayers(prev => prev.map(pl => pl.id === p.id ? { ...pl, is_active: !pl.is_active } : pl))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleDelete = async (p: Player) => {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/players/${p.id}`, secret)
      setPlayers(prev => prev.filter(pl => pl.id !== p.id))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const active = players.filter(p => p.is_active)
  const inactive = players.filter(p => !p.is_active)

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={btn('white', '#374151', '#d1d5db')}>← All Teams</button>
        <h2 style={{ margin: 0, flex: 1 }}>{team}</h2>
        <span style={{ color: '#6b7280', fontSize: 14 }}>{active.length} active · {inactive.length} inactive</span>
        <button
          onClick={() => setEditingId(editingId === 'new' ? null : 'new')}
          style={btn(editingId === 'new' ? '#6b7280' : '#dc2626')}
        >
          {editingId === 'new' ? '✕ Cancel' : '+ Add Player'}
        </button>
      </div>

      {/* Add player form */}
      {editingId === 'new' && (
        <div style={{ marginBottom: 24 }}>
          <PlayerForm
            initial={emptyForm(team)}
            teams={teams}
            onSave={f => handleSave(f)}
            onCancel={() => setEditingId(null)}
            saving={saving}
          />
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading…</p>
      ) : (
        <>
          <PlayerSection
            title="Active Players"
            players={active}
            editingId={editingId}
            teams={teams}
            saving={saving}
            onEdit={setEditingId}
            onSave={handleSave}
            onCancelEdit={() => setEditingId(null)}
            onToggle={handleToggleActive}
            onDelete={handleDelete}
          />
          {inactive.length > 0 && (
            <PlayerSection
              title="Inactive Players"
              players={inactive}
              editingId={editingId}
              teams={teams}
              saving={saving}
              onEdit={setEditingId}
              onSave={handleSave}
              onCancelEdit={() => setEditingId(null)}
              onToggle={handleToggleActive}
              onDelete={handleDelete}
            />
          )}
          {players.length === 0 && (
            <div style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
              padding: 48, textAlign: 'center', color: '#9ca3af',
            }}>
              No players yet. Add one above.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PlayerSection({
  title, players, editingId, teams, saving,
  onEdit, onSave, onCancelEdit, onToggle, onDelete,
}: {
  title: string
  players: Player[]
  editingId: string | 'new' | null
  teams: string[]
  saving: boolean
  onEdit: (id: string) => void
  onSave: (f: FormState, id?: string) => void
  onCancelEdit: () => void
  onToggle: (p: Player) => void
  onDelete: (p: Player) => void
}) {
  if (players.length === 0) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280', fontWeight: 700, letterSpacing: 0.5 }}>
        {title.toUpperCase()} ({players.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {players.map(p => (
          <div key={p.id}>
            {editingId === p.id ? (
              <PlayerForm
                initial={{
                  name: p.name, iplTeam: p.ipl_team, role: p.role,
                  basePrice: String(p.base_price), nationality: p.nationality,
                  imageUrl: p.image_url ?? '', isActive: p.is_active,
                }}
                teams={teams}
                onSave={f => onSave(f, p.id)}
                onCancel={onCancelEdit}
                saving={saving}
              />
            ) : (
              <div style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                opacity: p.is_active ? 1 : 0.55,
              }}>
                {/* Avatar / initials */}
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: ROLE_COLORS[p.role] ?? '#6b7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: 13,
                  }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={roleBadge(p.role)}>{ROLE_LABELS[p.role]}</span>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>₹{p.base_price}L base</span>
                    {p.nationality !== 'Indian' && (
                      <span style={{ ...roleBadge('all_rounder'), background: '#7c3aed' }}>Overseas</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => onToggle(p)}
                  title={p.is_active ? 'Deactivate' : 'Activate'}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid', ...(p.is_active
                      ? { background: '#fef9c3', color: '#92400e', borderColor: '#fde68a' }
                      : { background: '#d1fae5', color: '#065f46', borderColor: '#a7f3d0' }),
                  }}
                >
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => onEdit(p.id)} style={btn('white', '#374151', '#d1d5db')}>Edit</button>
                <button onClick={() => onDelete(p)} style={btn('white', '#dc2626', '#dc2626')}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Team list view ────────────────────────────────────────────────────────────

export function TeamsTab({ secret }: { secret: string }) {
  const [teams, setTeams] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, { active: number; total: number }>>({})
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    try {
      const [teamsData, allPlayersData] = await Promise.all([
        api.get('/admin/teams', secret) as Promise<{ teams: string[] }>,
        api.get('/admin/players', secret) as Promise<{ players: Player[] }>,
      ])
      setTeams(teamsData.teams)
      const c: Record<string, { active: number; total: number }> = {}
      for (const p of allPlayersData.players) {
        if (!c[p.ipl_team]) c[p.ipl_team] = { active: 0, total: 0 }
        c[p.ipl_team].total++
        if (p.is_active) c[p.ipl_team].active++
      }
      setCounts(c)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }, [secret])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        secret={secret}
        teams={teams}
        onBack={() => { setSelectedTeam(null); fetchTeams() }}
      />
    )
  }

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ margin: '0 0 24px' }}>IPL Teams</h2>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading…</p>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16,
        }}>
          {teams.map(team => {
            const c = counts[team] ?? { active: 0, total: 0 }
            return (
              <div
                key={team}
                style={{
                  background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                  padding: 20, cursor: 'pointer', transition: 'box-shadow 0.15s',
                }}
                onClick={() => setSelectedTeam(team)}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{team}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: '#d1fae5', color: '#065f46',
                  }}>
                    {c.active} active
                  </span>
                  {c.total - c.active > 0 && (
                    <span style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: '#f3f4f6', color: '#6b7280',
                    }}>
                      {c.total - c.active} inactive
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 12, color: '#9ca3af', fontSize: 12 }}>
                  Click to manage players →
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#374151', fontSize: 13 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
