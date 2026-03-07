import { create } from 'zustand'

export interface League {
  id: string
  name: string
  invite_code: string
  admin_id: string
  starting_budget: number
  max_squad_size: number
  max_teams: number
  roster_size: number
  max_batsmen: number
  max_wicket_keepers: number
  max_all_rounders: number
  max_bowlers: number
  currency: 'usd' | 'lakhs'
  trade_deadline_week: number | null
  veto_hours: number
  status: 'draft_pending' | 'draft_active' | 'league_active' | 'league_complete'
  bid_timeout_secs: number
  created_at: string
}

interface LeagueState {
  leagues: League[]
  currentLeague: League | null
  setLeagues: (leagues: League[]) => void
  setCurrentLeague: (league: League | null) => void
  updateLeague: (id: string, updates: Partial<League>) => void
}

export const useLeagueStore = create<LeagueState>((set) => ({
  leagues: [],
  currentLeague: null,

  setLeagues: (leagues) => set({ leagues }),

  setCurrentLeague: (currentLeague) => set({ currentLeague }),

  updateLeague: (id, updates) =>
    set((state) => ({
      leagues: state.leagues.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      currentLeague:
        state.currentLeague?.id === id
          ? { ...state.currentLeague, ...updates }
          : state.currentLeague,
    })),
}))
