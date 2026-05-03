/**
 * upload-team-logos.ts
 *
 * Uploads scraped IPL team outline logos from `scripts/team_logos/` to a
 * public Supabase Storage bucket. The mobile app then fetches them by
 * deterministic URL (see mobile/constants/teams.ts).
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/upload-team-logos.ts
 *
 * Re-runnable: storage uploads use upsert, so this is safe to run repeatedly.
 */

import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const LOGOS_DIR = join(REPO_ROOT, 'scripts', 'team_logos')
const BUCKET = 'team-logos'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function ensureBucket() {
  const { data: existing } = await supabase.storage.getBucket(BUCKET)
  if (existing) return
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '1MB',
    allowedMimeTypes: ['image/png'],
  })
  if (error && !/already exists/i.test(error.message)) throw error
  console.log(`✓ created bucket "${BUCKET}"`)
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  await ensureBucket()

  const files = readdirSync(LOGOS_DIR).filter((f) => f.endsWith('.png')).sort()
  for (const f of files) {
    const buf = readFileSync(join(LOGOS_DIR, f))
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(f, buf, { contentType: 'image/png', upsert: true })
    if (error) {
      console.error(`✗ ${f}: ${error.message}`)
      continue
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(f)
    console.log(`✓ ${f} → ${pub.publicUrl}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
