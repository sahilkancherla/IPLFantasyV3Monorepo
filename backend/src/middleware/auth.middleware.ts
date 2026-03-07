import type { FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAnon } from '../db/client.js'
import { pool } from '../db/client.js'

export interface AuthUser {
  id: string
  email: string
  username: string
  full_name: string
  display_name: string | null
  avatar_url: string | null
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser
  }
}

export async function authenticate(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing authorization header' })
    return
  }

  const token = authHeader.slice(7)

  const { data: { user }, error } = await supabaseAnon.auth.getUser(token)
  if (error || !user) {
    reply.code(401).send({ error: 'Invalid or expired token' })
    return
  }

  const { rows } = await pool.query<AuthUser>(
    `SELECT id, username, full_name, display_name, avatar_url FROM profiles WHERE id = $1`,
    [user.id]
  )

  if (rows.length === 0) {
    reply.code(401).send({ error: 'Profile not found' })
    return
  }

  req.authUser = { ...rows[0], email: user.email ?? '' }
}
