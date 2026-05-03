/**
 * upload-player-headshots.ts
 *
 * Uploads scraped IPL player headshots from `scripts/team_icons/<team-slug>/`
 * to a public Supabase Storage bucket, then updates `players.image_url` to the
 * resulting public URL. Matches by (name, ipl_team) with light normalization.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/upload-player-headshots.ts            # upload + update
 *   npx tsx scripts/upload-player-headshots.ts --dry-run  # only report matches
 *
 * Re-runnable: storage uploads use upsert, and the UPDATE is idempotent.
 */

import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const { Pool } = pg

const BUCKET = 'player-headshots'
const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const RAW_DIR = join(REPO_ROOT, 'scripts', 'raw')
const ICONS_DIR = join(REPO_ROOT, 'scripts', 'team_icons')
const DRY_RUN = process.argv.includes('--dry-run')

// Manual alias map — scraped name → DB name. Fill this in based on the
// per-team "DB players with no scraped match" lines from a --dry-run pass.
// Match is case/punctuation-insensitive, so only add entries for names that
// genuinely differ (different spelling, missing initial, etc.). Leave the
// scraped name as the key exactly as it appears in scripts/raw/<team>.json.
const NAME_ALIASES: Record<string, string> = {
  'Matthew William Short': 'Matthew Short',
  'Lungisani Ngidi': 'Lungi Ngidi',
  'Mohd. Arshad Khan': 'Arshad Khan',
  'Shahrukh Khan': 'M Shahrukh Khan',
  'Gurnoor Singh Brar': 'Gurnoor Brar',
  'Tejasvi Singh': 'Tejasvi Dahiya',
  'Varun Chakaravarthy': 'Varun Chakravarthy',
  'Shahbaz Ahamad': 'Shahbaz Ahmed',
  'Mohammad Shami': 'Mohammed Shami',
  'M. Siddharth': 'Manimaran Siddharth',
  'Digvesh Singh': 'Digvesh Rathi',
  'Surya Kumar Yadav': 'Suryakumar Yadav',
  'N. Tilak Varma': 'Tilak Varma',
  'Raj Angad Bawa': 'Raj Bawa',
  'Mohammad Izhar': 'Mohd Izhar',
  'Allah Ghazanfar': 'AM Ghazanfar',
  'Harnoor Pannu': 'Harnoor Singh',
  'Mitch Owen': 'Mitchell Owen',
  'Vyshak Vijaykumar': 'Vijaykumar Vyshak',
  'Pravin Dubey': 'Praveen Dubey',
  'Lhuan-dre Pretorious': 'Lhuan-dre Pretorius',
  'Aman Rao Perala': 'Aman Rao',
  'Yudhvir Singh Charak': 'Yudhvir Singh',
  'Rasikh Dar': 'Rasikh Salam',
  'Smaran Ravichandran': 'Ravichandran Smaran',
}

// scripts/raw/<team-slug>.json → players.ipl_team value
const TEAM_SLUG_TO_NAME: Record<string, string> = {
  'chennai-super-kings': 'Chennai Super Kings',
  'delhi-capitals': 'Delhi Capitals',
  'gujarat-titans': 'Gujarat Titans',
  'kolkata-knight-riders': 'Kolkata Knight Riders',
  'lucknow-super-giants': 'Lucknow Super Giants',
  'mumbai-indians': 'Mumbai Indians',
  'punjab-kings': 'Punjab Kings',
  'rajasthan-royals': 'Rajasthan Royals',
  'royal-challengers-bengaluru': 'Royal Challengers Bengaluru',
  'sunrisers-hyderabad': 'Sunrisers Hyderabad',
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function slugify(name: string): string {
  return name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

// Normalize a player name for fuzzy matching. Strips dots, collapses spaces,
// lowercases, and removes a small set of common honorifics.
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function ensureBucket() {
  const { data: existing } = await supabase.storage.getBucket(BUCKET)
  if (existing) return
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/png', 'image/jpeg'],
  })
  if (error && !/already exists/i.test(error.message)) throw error
  console.log(`✓ created bucket "${BUCKET}"`)
}

interface Scraped {
  name: string
  role: string
  src: string
}

async function processTeam(slug: string) {
  const teamName = TEAM_SLUG_TO_NAME[slug]
  if (!teamName) {
    console.warn(`⚠ unknown team slug: ${slug}`)
    return { matched: 0, unmatched: [] as string[] }
  }

  const players: Scraped[] = JSON.parse(readFileSync(join(RAW_DIR, `${slug}.json`), 'utf8'))

  // Pull DB players for this team once
  const { rows: dbPlayers } = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM players WHERE ipl_team = $1`,
    [teamName]
  )
  const dbByNorm = new Map(dbPlayers.map((p) => [normalizeName(p.name), p]))

  const matched: string[] = []
  const unmatched: string[] = []

  for (const p of players) {
    const lookupName = NAME_ALIASES[p.name] ?? p.name
    const dbMatch = dbByNorm.get(normalizeName(lookupName))
    if (!dbMatch) {
      unmatched.push(p.name)
      continue
    }

    const slug2 = slugify(p.name)
    const localPath = join(ICONS_DIR, slug, `${slug2}.png`)
    const storagePath = `${slug}/${slug2}.png`

    if (!DRY_RUN) {
      const buf = readFileSync(localPath)
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buf, { contentType: 'image/png', upsert: true })
      if (upErr) {
        console.error(`  ✗ upload ${storagePath}: ${upErr.message}`)
        continue
      }
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = pub.publicUrl

    if (!DRY_RUN) {
      await pool.query(`UPDATE players SET image_url = $1 WHERE id = $2`, [publicUrl, dbMatch.id])
    }

    matched.push(p.name)
  }

  console.log(`✓ ${slug}: ${matched.length}/${players.length} matched` +
    (unmatched.length ? ` · unmatched: ${unmatched.join(', ')}` : ''))

  // Also report DB players for this team that didn't get an image (e.g. names
  // in DB that aren't in the scraped roster).
  const matchedNorms = new Set(matched.map(normalizeName))
  const orphanDb = dbPlayers
    .filter((p) => !matchedNorms.has(normalizeName(p.name)))
    .map((p) => p.name)
  if (orphanDb.length) {
    console.log(`  ↳ DB players with no scraped match: ${orphanDb.join(', ')}`)
  }

  return { matched: matched.length, unmatched }
}

async function main() {
  if (!process.env.DATABASE_URL || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing DATABASE_URL / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no uploads, no DB writes)' : 'LIVE'}`)
  if (!DRY_RUN) await ensureBucket()

  const slugs = readdirSync(RAW_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()

  let total = 0
  const allUnmatched: string[] = []
  for (const slug of slugs) {
    const { matched, unmatched } = await processTeam(slug)
    total += matched
    allUnmatched.push(...unmatched.map((n) => `${slug}: ${n}`))
  }

  console.log(`\n=== Summary ===`)
  console.log(`Total matched: ${total}`)
  console.log(`Total unmatched (scraped player not in DB): ${allUnmatched.length}`)
  if (allUnmatched.length) {
    console.log(allUnmatched.map((s) => `  - ${s}`).join('\n'))
  }

  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
