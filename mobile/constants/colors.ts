// ── Text ─────────────────────────────────────────────────────────────────────
export const TEXT_PRIMARY    = '#111827'
export const TEXT_SECONDARY  = '#374151'
export const TEXT_MUTED      = '#6b7280'
export const TEXT_PLACEHOLDER = '#9ca3af'
export const TEXT_DISABLED   = '#d1d5db'

// ── Borders ──────────────────────────────────────────────────────────────────
export const BORDER_DEFAULT  = '#f3f4f6'
export const BORDER_MEDIUM   = '#e5e7eb'

// ── Backgrounds ──────────────────────────────────────────────────────────────
export const BG_PAGE         = '#f9fafb'
export const BG_CARD         = '#ffffff'
export const BG_SUBTLE       = '#f3f4f6'
export const BG_DARK_HEADER  = '#1f2937'

// ── Primary / Red (danger, actions, bowler) ───────────────────────────────────
export const PRIMARY         = '#dc2626'
export const PRIMARY_SOFT    = '#ef4444'
export const PRIMARY_BG      = '#fef2f2'
export const PRIMARY_BORDER  = '#fecaca'
export const PRIMARY_SUBTLE  = '#fee2e2'
export const PRIMARY_TINT    = '#fff1f2'

// ── Success / Green (positive, all-rounder, win) ──────────────────────────────
export const SUCCESS         = '#16a34a'
export const SUCCESS_DARK    = '#15803d'
export const SUCCESS_BG      = '#f0fdf4'
export const SUCCESS_BORDER  = '#bbf7d0'
export const SUCCESS_SUBTLE  = '#d1fae5'

// ── Warning / Amber (wicket-keeper, live, urgent) ─────────────────────────────
export const WARNING         = '#d97706'
export const WARNING_DARK    = '#b45309'
export const WARNING_DARKER  = '#92400e'
export const WARNING_URGENT  = '#ea580c'
export const WARNING_BG      = '#fef9c3'
export const WARNING_BORDER  = '#fde68a'
export const WARNING_SUBTLE  = '#fffbeb'
export const WARNING_URGENT_BG     = '#fff7ed'
export const WARNING_URGENT_BORDER = '#fed7aa'

// ── Info / Blue (batsman, upcoming) ──────────────────────────────────────────
export const INFO            = '#2563eb'
export const INFO_DARK       = '#1d4ed8'
export const INFO_MID        = '#3b82f6'
export const INFO_BG         = '#eff6ff'
export const INFO_BORDER     = '#bfdbfe'
export const INFO_SUBTLE     = '#dbeafe'

// ── Role colors ───────────────────────────────────────────────────────────────
export const ROLE_BATSMAN       = '#2563eb'
export const ROLE_BOWLER        = '#dc2626'
export const ROLE_ALL_ROUNDER   = '#16a34a'
export const ROLE_WICKET_KEEPER = '#d97706'

export const roleColors: Record<string, string> = {
  batsman:       ROLE_BATSMAN,
  bowler:        ROLE_BOWLER,
  all_rounder:   ROLE_ALL_ROUNDER,
  wicket_keeper: ROLE_WICKET_KEEPER,
}

// ── Match status colors ───────────────────────────────────────────────────────
export const STATUS_LIVE_TEXT      = WARNING_DARK       // #b45309
export const STATUS_LIVE_BG        = WARNING_BG         // #fef9c3
export const STATUS_COMPLETED_TEXT = SUCCESS            // #16a34a
export const STATUS_COMPLETED_BG   = SUCCESS_BG         // #f0fdf4
export const STATUS_UPCOMING_TEXT  = INFO_DARK          // #1d4ed8
export const STATUS_UPCOMING_BG    = INFO_SUBTLE        // #dbeafe
export const STATUS_PENDING_TEXT   = TEXT_MUTED         // #6b7280
export const STATUS_PENDING_BG     = BG_SUBTLE          // #f3f4f6

export function matchStatusColors(status: string): { text: string; bg: string } {
  switch (status) {
    case 'live':      return { text: STATUS_LIVE_TEXT,      bg: STATUS_LIVE_BG }
    case 'completed': return { text: STATUS_COMPLETED_TEXT, bg: STATUS_COMPLETED_BG }
    case 'upcoming':  return { text: STATUS_UPCOMING_TEXT,  bg: STATUS_UPCOMING_BG }
    default:          return { text: STATUS_PENDING_TEXT,   bg: STATUS_PENDING_BG }
  }
}
