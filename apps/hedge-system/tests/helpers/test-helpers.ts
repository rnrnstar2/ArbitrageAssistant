/**
 * テストヘルパー関数とユーティリティ
 */

import WebSocket from 'ws'
import { WebSocketClient, WebSocketConnectionOptions } from '@/lib/websocket/websocket-client'
import { WebSocketMessage } from '@/lib/websocket/message-types'
import { EAMessage, SystemCommand } from '@/types/ea-messages'

export interface TestEnvironment {
  websocketServer: MockWebSocketServer
  eaSimulator: EASimulator
  database: TestDatabase
  config: TestConfig
}

export interface TestConfig {
  websocketUrl: string
  port: number
  enableLogging: boolean
  timeout: number
}

export interface MockWebSocketServer {
  port: number
  server: WebSocket.Server | null
  clients: Set<WebSocket>
  messageHandlers: Map<string, (message: any) => void>
  start(): Promise<void>
  stop(): Promise<void>
  broadcast(message: any): void
  onMessage(type: string, handler: (message: any) => void): void
}

export interface EASimulator {
  websocketUrl: string
  client: WebSocket | null
  accounts: TestAccount[]
  positions: TestPosition[]
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendPositionUpdate(position: TestPosition): Promise<void>
  sendAccountInfo(account: TestAccount): Promise<void>
  generateTestPositions(count: number): Promise<TestPosition[]>
}

export interface TestDatabase {
  type: 'memory' | 'file'
  data: Map<string, any>
  initialize(): Promise<void>
  clear(): Promise<void>
  get(key: string): any
  set(key: string, value: any): void
}

export interface TestAccount {
  accountId: string
  balance: number
  equity: number
  freeMargin: number
  marginLevel: number
  bonusAmount: number
  profit: number
  credit: number
}

export interface TestPosition {
  positionId: string
  accountId: string
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  openPrice: number
  currentPrice: number
  profit: number
  swapPoints: number
  commission: number
  status: 'open' | 'closed'
}

export class MockWebSocketServer implements MockWebSocketServer {
  public port: number
  public server: WebSocket.Server | null = null
  public clients: Set<WebSocket> = new Set()
  public messageHandlers: Map<string, (message: any) => void> = new Map()

  constructor(options: { port: number; enableLogging?: boolean }) {
    this.port = options.port
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocket.Server({ port: this.port })
        
        this.server.on('connection', (ws: WebSocket) => {
          console.log('Client connected to mock server')
          this.clients.add(ws)

          ws.on('message', (data: WebSocket.Data) => {
            try {
              const message = JSON.parse(data.toString())
              const handler = this.messageHandlers.get(message.type)
              if (handler) {
                handler(message)
              }
              
              // Echo response for test commands
              if (message.type === 'test_connection') {
                ws.send(JSON.stringify({
                  type: 'test_response',
                  commandId: message.commandId,
                  timestamp: Date.now(),
                  success: true
                }))
              }
            } catch (error) {
              console.error('Error parsing message:', error)
            }
          })

          ws.on('close', () => {
            console.log('Client disconnected from mock server')
            this.clients.delete(ws)
          })
        })

        this.server.on('listening', () => {
          console.log(`Mock WebSocket server listening on port ${this.port}`)
          resolve()
        })

        this.server.on('error', (error) => {
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.clients.forEach(client => client.close())
        this.server.close(() => {
          console.log('Mock WebSocket server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  broadcast(message: any): void {
    const data = JSON.stringify(message)
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    })
  }

  onMessage(type: string, handler: (message: any) => void): void {
    this.messageHandlers.set(type, handler)
  }
}

export class EASimulator implements EASimulator {
  public websocketUrl: string
  public client: WebSocket | null = null
  public accounts: TestAccount[] = []
  public positions: TestPosition[] = []
  private messageQueue: any[] = []

  constructor(options: { websocketUrl: string; accounts: TestAccount[]; positions: TestPosition[] }) {
    this.websocketUrl = options.websocketUrl
    this.accounts = options.accounts
    this.positions = options.positions
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client = new WebSocket(this.websocketUrl)

        this.client.on('open', () => {
          console.log('EA Simulator connected')
          resolve()
        })

        this.client.on('error', (error) => {
          reject(error)
        })

        this.client.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString())
            console.log('EA Simulator received:', message)
          } catch (error) {
            console.error('Error parsing received message:', error)
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.close()
        this.client = null
      }
      resolve()
    })
  }

  async sendPositionUpdate(position: TestPosition): Promise<void> {
    const message: EAMessage = {
      type: 'position_update',
      timestamp: Date.now(),
      accountId: position.accountId,
      messageId: `pos-${Date.now()}-${Math.random()}`,
      data: position
    }

    return this.sendMessage(message)
  }

  async sendAccountInfo(account: TestAccount): Promise<void> {
    const message: EAMessage = {
      type: 'account_info',
      timestamp: Date.now(),
      accountId: account.accountId,
      messageId: `acc-${Date.now()}-${Math.random()}`,
      data: account
    }

    return this.sendMessage(message)
  }

  async generateTestPositions(count: number): Promise<TestPosition[]> {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD']
    const positions: TestPosition[] = []

    for (let i = 0; i < count; i++) {
      const symbol = symbols[i % symbols.length]
      const type = Math.random() > 0.5 ? 'buy' : 'sell'
      const openPrice = 1.0000 + Math.random() * 0.5
      const currentPrice = openPrice + (Math.random() - 0.5) * 0.01
      
      positions.push({
        positionId: `pos-${i + 1}`,
        accountId: this.accounts[0]?.accountId || 'test-account',
        symbol,
        type,
        lots: 0.1 + Math.random() * 0.9,
        openPrice,
        currentPrice,
        profit: (currentPrice - openPrice) * (type === 'buy' ? 1 : -1) * 100000,
        swapPoints: Math.random() * 10 - 5,
        commission: -5,
        status: 'open'
      })
    }

    return positions
  }

  async sendMessage(message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || this.client.readyState !== WebSocket.OPEN) {
        this.messageQueue.push(message)
        reject(new Error('WebSocket not connected'))
        return
      }

      try {
        this.client.send(JSON.stringify(message))
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }
}

export class TestDatabase implements TestDatabase {
  public type: 'memory' | 'file'
  public data: Map<string, any> = new Map()

  constructor(options: { type: 'memory' | 'file'; resetOnStart?: boolean }) {
    this.type = options.type
    if (options.resetOnStart) {
      this.data.clear()
    }
  }

  async initialize(): Promise<void> {
    console.log('Test database initialized')
  }

  async clear(): Promise<void> {
    this.data.clear()
  }

  get(key: string): any {
    return this.data.get(key)
  }

  set(key: string, value: any): void {
    this.data.set(key, value)
  }
}

export class TestMetricsCollector {
  private metrics: Map<string, number[]> = new Map()

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)
  }

  getMetrics(name: string): number[] {
    return this.metrics.get(name) || []
  }

  calculateAverage(name: string): number {
    const values = this.getMetrics(name)
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
  }

  calculatePercentile(name: string, percentile: number): number {
    const values = this.getMetrics(name).sort((a, b) => a - b)
    if (values.length === 0) return 0
    
    const index = Math.ceil((percentile * values.length) / 100) - 1
    return values[Math.max(0, index)]
  }

  clear(): void {
    this.metrics.clear()
  }
}

// ヘルパー関数
export function createTestConfig(): TestConfig {
  return {
    websocketUrl: 'ws://localhost:8080',
    port: 8080,
    enableLogging: false,
    timeout: 30000
  }
}

export function createTestAccount(overrides: Partial<TestAccount> = {}): TestAccount {
  return {
    accountId: 'test-account-1',
    balance: 10000,
    equity: 10000,
    freeMargin: 9000,
    marginLevel: 1000,
    bonusAmount: 500,
    profit: 0,
    credit: 0,
    ...overrides
  }
}

export function createTestPosition(overrides: Partial<TestPosition> = {}): TestPosition {
  return {
    positionId: 'test-position-1',
    accountId: 'test-account-1',
    symbol: 'EURUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 1.1000,
    currentPrice: 1.1010,
    profit: 10,
    swapPoints: 0,
    commission: -5,
    status: 'open',
    ...overrides
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function comparePositionData(sent: TestPosition, received: any): boolean {
  if (!received) return false
  
  return (
    sent.positionId === received.positionId &&
    sent.accountId === received.accountId &&
    sent.symbol === received.symbol &&
    sent.type === received.type &&
    Math.abs(sent.lots - received.lots) < 0.001 &&
    Math.abs(sent.openPrice - received.openPrice) < 0.00001 &&
    Math.abs(sent.currentPrice - received.currentPrice) < 0.00001
  )
}

// テスト用WebSocketClientラッパー
export class TestWebSocketClient {
  private client: WebSocketClient
  private receivedMessages: any[] = []
  private receivedPositions: any[] = []
  private commandResponses: Map<string, any> = new Map()

  constructor(url: string) {
    const options: WebSocketConnectionOptions = {
      url,
      authToken: 'test-token',
      clientId: 'test-client',
      userId: 'test-user',
      reconnectInterval: 1000,
      heartbeatInterval: 5000,
      maxReconnectAttempts: 3,
      connectionTimeout: 5000,
      logLevel: 'error' // Reduce logging noise in tests
    }
    
    this.client = new WebSocketClient(options)
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.client.on('message_received', (event, message) => {
      this.receivedMessages.push(message)
      
      if (message.type === 'position_update') {
        this.receivedPositions.push(message.payload)
      }
      
      if (message.type === 'test_response') {
        this.commandResponses.set(message.payload.commandId, message)
      }
    })
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 10000)

      this.client.on('connection_state_changed', (event, state) => {
        if (state === 'connected') {
          clearTimeout(timeout)
          resolve()
        } else if (state === 'error') {
          clearTimeout(timeout)
          reject(new Error('Connection failed'))
        }
      })

      this.client.connect()
    })
  }

  async disconnect(): Promise<void> {
    this.client.disconnect()
    await sleep(100) // Give it time to disconnect
  }

  isConnected(): boolean {
    return this.client.getConnectionState() === 'connected'
  }

  async authenticate(auth: { token: string; accountId: string }): Promise<{ success: boolean }> {
    // Mock authentication - in real implementation this would be handled by WebSocketClient
    return { success: true }
  }

  async sendHeartbeat(): Promise<any> {
    const heartbeatMessage: WebSocketMessage = {
      type: 'heartbeat',
      payload: { status: 'ping', timestamp: Date.now() },
      timestamp: Date.now()
    }
    
    this.client.send(heartbeatMessage)
    
    // Return mock response
    return { status: 'pong', timestamp: Date.now() }
  }

  async sendCommand(command: SystemCommand): Promise<void> {
    const message: WebSocketMessage = {
      type: 'system_command',
      payload: command,
      timestamp: Date.now()
    }
    
    this.client.send(message)
  }

  getReceivedMessages(): any[] {
    return [...this.receivedMessages]
  }

  getReceivedPositions(): any[] {
    return [...this.receivedPositions]
  }

  waitForResponse(commandId: string, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const checkResponse = () => {
        const response = this.commandResponses.get(commandId)
        if (response) {
          resolve(response)
          return
        }
        setTimeout(checkResponse, 100)
      }
      
      setTimeout(() => {
        reject(new Error(`Response timeout for command ${commandId}`))
      }, timeout)
      
      checkResponse()
    })
  }

  clearReceivedData(): void {
    this.receivedMessages = []
    this.receivedPositions = []
    this.commandResponses.clear()
  }

  getConnectionStats() {
    return this.client.getConnectionStats()
  }

  getQualityMetrics() {
    return this.client.getQualityMetrics()
  }
}