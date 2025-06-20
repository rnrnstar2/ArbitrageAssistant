'use client'

import { EventEmitter } from 'events'

export interface WebSocketMessage {
  id?: string
  type: 'connection_init' | 'connection_ack' | 'start' | 'stop' | 'data' | 'error' | 'complete' | 'ping' | 'pong'
  payload?: any
}

export interface SubscriptionOptions {
  query: string
  variables?: Record<string, any>
  operationName?: string
}

export class MonitoringWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null
  private subscriptions = new Map<string, SubscriptionOptions>()
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private connectionTimeout: NodeJS.Timeout | null = null
  private url: string
  private protocols: string[]

  constructor(url: string, protocols: string[] = ['graphql-ws']) {
    super()
    this.url = url
    this.protocols = protocols
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connectionState === 'connected') {
        resolve()
        return
      }

      this.connectionState = 'connecting'
      this.emit('connecting')

      try {
        this.ws = new WebSocket(this.url, this.protocols)

        // 接続タイムアウトの設定
        this.connectionTimeout = setTimeout(() => {
          if (this.connectionState === 'connecting') {
            this.ws?.close()
            reject(new Error('Connection timeout'))
          }
        }, 10000)

        this.ws.onopen = () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          this.connectionState = 'connected'
          this.reconnectAttempts = 0
          this.emit('connected')

          // 初期化メッセージの送信
          this.send({
            type: 'connection_init',
            payload: {
              authorization: this.getAuthToken()
            }
          })

          // ハートビートの開始
          this.startHeartbeat()

          // 既存のサブスクリプションの再開
          this.resubscribeAll()

          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
            this.emit('error', error)
          }
        }

        this.ws.onerror = (event) => {
          console.error('WebSocket error:', event)
          this.emit('error', new Error('WebSocket error'))
          
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }
          
          reject(new Error('WebSocket connection failed'))
        }

        this.ws.onclose = (event) => {
          this.connectionState = 'disconnected'
          this.stopHeartbeat()
          
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          this.emit('disconnected', event.code, event.reason)

          // 自動再接続
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect()
          }
        }

      } catch (error) {
        this.connectionState = 'disconnected'
        this.emit('error', error)
        reject(error)
      }
    })
  }

  disconnect(): void {
    this.connectionState = 'disconnected'
    this.stopHeartbeat()
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting')
      this.ws = null
    }

    this.subscriptions.clear()
    this.emit('disconnected', 1000, 'Client disconnecting')
  }

  subscribe(id: string, options: SubscriptionOptions): void {
    this.subscriptions.set(id, options)

    if (this.connectionState === 'connected') {
      this.send({
        id,
        type: 'start',
        payload: options
      })
    }
  }

  unsubscribe(id: string): void {
    if (this.subscriptions.has(id)) {
      this.subscriptions.delete(id)
      
      if (this.connectionState === 'connected') {
        this.send({
          id,
          type: 'stop'
        })
      }
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'connection_ack':
        this.emit('connection_ack')
        break

      case 'data':
        if (message.id) {
          this.emit('data', message.id, message.payload)
          this.emit(`data:${message.id}`, message.payload)
        }
        break

      case 'error':
        if (message.id) {
          this.emit('subscription_error', message.id, message.payload)
          this.emit(`error:${message.id}`, message.payload)
        } else {
          this.emit('error', new Error(message.payload?.message || 'Unknown error'))
        }
        break

      case 'complete':
        if (message.id) {
          this.emit('subscription_complete', message.id)
          this.emit(`complete:${message.id}`)
        }
        break

      case 'ping':
        this.send({ type: 'pong' })
        break

      case 'pong':
        // ハートビート応答を受信
        break

      default:
        console.warn('Unknown message type:', message.type)
    }
  }

  private send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  private resubscribeAll(): void {
    for (const [id, options] of this.subscriptions) {
      this.send({
        id,
        type: 'start',
        payload: options
      })
    }
  }

  private scheduleReconnect(): void {
    this.connectionState = 'reconnecting'
    this.reconnectAttempts++

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)
    
    this.emit('reconnecting', this.reconnectAttempts, delay)

    setTimeout(() => {
      if (this.connectionState === 'reconnecting') {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error)
        })
      }
    }, delay)
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.send({ type: 'ping' })
      }
    }, 30000) // 30秒間隔
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private getAuthToken(): string {
    // 実際の実装では、認証トークンを取得
    return localStorage.getItem('auth_token') || ''
  }

  get isConnected(): boolean {
    return this.connectionState === 'connected'
  }

  get state(): string {
    return this.connectionState
  }

  get subscriptionCount(): number {
    return this.subscriptions.size
  }
}