import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import { config } from './config.js'
import { authRoutes } from './routes/auth.js'
import { leagueRoutes } from './routes/leagues.js'
import { playerRoutes } from './routes/players.js'
import { auctionRoutes } from './routes/auction.js'
import { teamRoutes } from './routes/teams.js'
import { leaderboardRoutes } from './routes/leaderboard.js'
import { scheduleRoutes } from './routes/schedule.js'
import { lineupRoutes } from './routes/lineups.js'
import { waiverRoutes } from './routes/waivers.js'
import { tradeRoutes } from './routes/trades.js'
import { scoreRoutes } from './routes/scores.js'
import { adminRoutes } from './routes/admin.js'
import { registerAuctionWebSocket } from './ws/auction.ws.js'

export async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  })

  // Plugins
  await app.register(helmet, {
    contentSecurityPolicy: false,
  })

  const corsOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim())
  await app.register(cors, {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  await app.register(websocket)

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Routes
  await app.register(authRoutes)
  await app.register(leagueRoutes)
  await app.register(playerRoutes)
  await app.register(auctionRoutes)
  await app.register(teamRoutes)
  await app.register(leaderboardRoutes)
  await app.register(scheduleRoutes)
  await app.register(lineupRoutes)
  await app.register(waiverRoutes)
  await app.register(tradeRoutes)
  await app.register(scoreRoutes)
  await app.register(adminRoutes)

  // WebSocket
  await registerAuctionWebSocket(app)

  return app
}
