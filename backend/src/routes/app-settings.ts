import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware.js'
import { pool } from '../db/client.js'

const patchSchema = z.object({
  value: z.unknown(),
})

export async function appSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // GET /app-settings — any authenticated user reads the public toggles.
  app.get('/app-settings', async (_req, reply) => {
    const { rows } = await pool.query<{ key: string; value: unknown }>(
      `SELECT key, value FROM app_settings`
    )
    const settings: Record<string, unknown> = {}
    for (const r of rows) settings[r.key] = r.value
    return reply.send({ settings })
  })

  // PATCH /app-settings/:key — super admin only.
  app.patch<{ Params: { key: string } }>(
    '/app-settings/:key',
    async (req, reply) => {
      if (!req.authUser?.is_super_admin) {
        return reply.code(403).send({ error: 'Super admin only' })
      }
      const body = patchSchema.safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const { rows } = await pool.query(
        `INSERT INTO app_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
         RETURNING key, value`,
        [req.params.key, JSON.stringify(body.data.value), req.authUser.id]
      )
      return reply.send({ setting: rows[0] })
    }
  )
}
