import * as SecureStore from 'expo-secure-store'

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:3000'

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface WsManagerOptions {
  leagueId: string
  onMessage: (msg: unknown) => void
  onStatusChange: (status: WsStatus) => void
}

export class WsManager {
  private ws: WebSocket | null = null
  private options: WsManagerOptions
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  private shouldReconnect = true
  private pingInterval: ReturnType<typeof setInterval> | null = null

  constructor(options: WsManagerOptions) {
    this.options = options
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true
    await this._connect()
  }

  private async _connect(): Promise<void> {
    const token = await SecureStore.getItemAsync('sb-access-token')
    if (!token) {
      this.options.onStatusChange('error')
      return
    }

    this.options.onStatusChange('connecting')

    this.ws = new WebSocket(`${WS_URL}/ws/auction`)

    this.ws.onopen = () => {
      this.reconnectDelay = 1000  // reset backoff
      this.options.onStatusChange('connected')

      // Send JOIN
      this.send({
        type: 'JOIN',
        leagueId: this.options.leagueId,
        token,
      })

      // Start ping/pong
      this.pingInterval = setInterval(() => {
        this.send({ type: 'PING' })
      }, 30000)
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        this.options.onMessage(msg)
      } catch {
        console.warn('WS: invalid JSON received')
      }
    }

    this.ws.onerror = () => {
      this.options.onStatusChange('error')
    }

    this.ws.onclose = () => {
      this._clearPing()
      this.options.onStatusChange('disconnected')

      if (this.shouldReconnect) {
        this._scheduleReconnect()
      }
    }
  }

  send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  bid(leagueId: string, amount: number): void {
    this.send({ type: 'BID', leagueId, amount })
  }

  nominate(leagueId: string, playerId: string): void {
    this.send({ type: 'NOMINATE', leagueId, playerId })
  }

  pass(leagueId: string): void {
    this.send({ type: 'PASS', leagueId })
  }

  confirm(leagueId: string): void {
    this.send({ type: 'CONFIRM', leagueId })
  }

  reset(leagueId: string): void {
    this.send({ type: 'RESET', leagueId })
  }

  disconnect(): void {
    this.shouldReconnect = false
    this._clearReconnect()
    this._clearPing()
    this.ws?.close()
    this.ws = null
  }

  private _scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
      this._connect().catch(console.error)
    }, this.reconnectDelay)
  }

  private _clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private _clearPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}
