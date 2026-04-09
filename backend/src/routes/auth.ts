import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseAdmin, supabaseAnon } from '../db/client.js'
import { authenticate } from '../middleware/auth.middleware.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(80),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  displayName: z.string().max(50).optional(),
  avatarUrl: z.string().url().optional(),
  email: z.string().email().optional(),
})

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/register
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() })
    }

    const { email, password, fullName } = body.data

    // Auto-generate unique username from email prefix
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20)
    let username = baseUsername
    let suffix = 1
    while (true) {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
      if (!existing) break
      username = `${baseUsername}${suffix++}`
    }

    // Create Supabase auth user (trigger will insert profile row)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (error) {
      req.log.warn({ supabaseError: error.message, code: error.code }, 'createUser failed')
      return reply.code(400).send({ error: error.message })
    }

    // Upsert profile with correct username and full_name
    await supabaseAdmin
      .from('profiles')
      .upsert({ id: data.user.id, username, full_name: fullName, display_name: fullName })

    // Sign in to get token
    const { data: session, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !session.session) {
      return reply.code(500).send({ error: 'Account created but sign-in failed' })
    }

    return reply.code(201).send({
      user: { id: data.user.id, email, username, fullName },
      session: {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_at: session.session.expires_at,
      },
    })
  })

  // POST /auth/login
  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() })
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email: body.data.email,
      password: body.data.password,
    })

    if (error || !data.session) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, display_name, avatar_url')
      .eq('id', data.user.id)
      .single()

    return reply.send({
      user: profile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    })
  })

  // GET /auth/me
  app.get('/auth/me', { preHandler: authenticate }, async (req, reply) => {
    return reply.send({ user: req.authUser })
  })

  // DELETE /auth/me — permanently deletes the user's account
  app.delete('/auth/me', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.authUser!.id
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) {
      req.log.error({ error: error.message }, 'Failed to delete user')
      return reply.code(500).send({ error: 'Failed to delete account' })
    }
    return reply.code(204).send()
  })

  // PATCH /auth/me
  app.patch('/auth/me', { preHandler: authenticate }, async (req, reply) => {
    const body = updateProfileSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() })
    }

    const { fullName, displayName, avatarUrl, email } = body.data
    const userId = req.authUser!.id

    // Update email in Supabase Auth if provided
    if (email !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email })
      if (error) return reply.code(400).send({ error: error.message })
    }

    const profileUpdates: Record<string, string> = {}
    if (fullName !== undefined) profileUpdates.full_name = fullName
    if (displayName !== undefined) profileUpdates.display_name = displayName
    if (avatarUrl !== undefined) profileUpdates.avatar_url = avatarUrl
    if (email !== undefined) profileUpdates.email = email

    if (Object.keys(profileUpdates).length === 0) {
      return reply.send({ user: req.authUser })
    }

    const { data: updated } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId)
      .select()
      .single()

    return reply.send({ user: updated })
  })
}
