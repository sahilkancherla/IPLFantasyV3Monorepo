/**
 * Warms the platform image cache at app boot with:
 *   - every player's headshot URL
 *   - every IPL team logo
 *
 * Important: Image.prefetch shares the same HTTP networking stack as fetch().
 * If we fan out aggressively at app boot we starve the backend API queries
 * (lineups, matches, breakdowns, etc.) — they end up queued behind hundreds
 * of image requests. So we run with low concurrency, a per-image timeout,
 * and we wait a few seconds before starting so the home screen's first
 * round of data has already gone over the wire.
 *
 * Team logos are prefetched first because they're tiny (~10) and are visible
 * on every matchup/lineup screen — getting those primed pays off immediately.
 *
 * The native RN Image cache persists across app launches, so subsequent
 * boots are near-instant cache hits per URL.
 */

import { Image } from 'react-native'
import { api } from './api'

interface PlayerLite {
  id: string
  image_url: string | null
}

interface IplTeamLite {
  slug: string
  logo_path: string
}

const CONCURRENCY = 2
const PER_IMAGE_TIMEOUT_MS = 8000
const STARTUP_DELAY_MS = 3000

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

let inFlight: Promise<void> | null = null

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([
    p,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ])
}

async function prefetchAll(urls: string[]) {
  let i = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < urls.length) {
      const idx = i++
      try {
        await withTimeout(Image.prefetch(urls[idx]), PER_IMAGE_TIMEOUT_MS)
      } catch {
        // One bad URL shouldn't poison the queue.
      }
    }
  })
  await Promise.all(workers)
}

export function preloadImages(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    // Let the home screen's first data fetches go out before we start
    // saturating connections with image requests.
    await new Promise((r) => setTimeout(r, STARTUP_DELAY_MS))

    // 1) Team logos first — tiny set, used everywhere
    try {
      const { teams } = await api.get<{ teams: IplTeamLite[] }>('/ipl-teams')
      if (SUPABASE_URL) {
        const logoUrls = teams.map((t) => `${SUPABASE_URL}/storage/v1/object/public/team-logos/${t.logo_path}`)
        await prefetchAll(logoUrls)
      }
    } catch {
      // Logos will lazy-load on first render if this fails.
    }

    // 2) Player headshots — large set, takes longer
    try {
      const { players } = await api.get<{ players: PlayerLite[] }>('/players')
      const urls = players.map((p) => p.image_url).filter((u): u is string => !!u)
      await prefetchAll(urls)
    } catch {
      // Network failure is fine — Avatar lazy-loads on first display.
    }
  })()
  return inFlight
}
