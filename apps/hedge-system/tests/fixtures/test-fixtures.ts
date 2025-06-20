/**
 * テストフィクスチャとテストデータ
 */

import { TestAccount, TestPosition } from '@/tests/helpers/test-helpers'
import { EAMessage, SystemCommand } from '@/types/ea-messages'

// テストアカウントデータ
export const testAccounts: TestAccount[] = [
  {
    accountId: 'test-account-1',
    balance: 10000,
    equity: 10000,
    freeMargin: 9000,
    marginLevel: 1000,
    bonusAmount: 500,
    profit: 0,
    credit: 0
  },
  {
    accountId: 'test-account-2',
    balance: 5000,
    equity: 5500,
    freeMargin: 4500,
    marginLevel: 1100,
    bonusAmount: 300,
    profit: 500,
    credit: 0
  },
  {
    accountId: 'test-account-3',
    balance: 20000,
    equity: 19500,
    freeMargin: 18000,
    marginLevel: 975,
    bonusAmount: 1000,
    profit: -500,
    credit: 0
  }
]

// テストポジションデータ
export const testPositions: TestPosition[] = [
  {
    positionId: 'pos-001',
    accountId: 'test-account-1',
    symbol: 'EURUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 1.1000,
    currentPrice: 1.1010,
    profit: 10,
    swapPoints: 0.5,
    commission: -5,
    status: 'open'
  },
  {
    positionId: 'pos-002',
    accountId: 'test-account-1',
    symbol: 'GBPUSD',
    type: 'sell',
    lots: 0.2,
    openPrice: 1.3000,
    currentPrice: 1.2980,
    profit: 40,
    swapPoints: -0.3,
    commission: -10,
    status: 'open'
  },
  {
    positionId: 'pos-003',
    accountId: 'test-account-2',
    symbol: 'USDJPY',
    type: 'buy',
    lots: 0.15,
    openPrice: 150.00,
    currentPrice: 150.25,
    profit: 25,
    swapPoints: 1.2,
    commission: -7.5,
    status: 'open'
  },
  {
    positionId: 'pos-004',
    accountId: 'test-account-2',
    symbol: 'AUDUSD',
    type: 'sell',
    lots: 0.3,
    openPrice: 0.6500,
    currentPrice: 0.6485,
    profit: 45,
    swapPoints: -0.8,
    commission: -15,
    status: 'open'
  },
  {
    positionId: 'pos-005',
    accountId: 'test-account-3',
    symbol: 'USDCAD',
    type: 'buy',
    lots: 0.25,
    openPrice: 1.3500,
    currentPrice: 1.3480,
    profit: -50,
    swapPoints: 0.2,
    commission: -12.5,
    status: 'open'
  }
]

// テストメッセージフィクスチャ
export const testEAMessages: EAMessage[] = [
  {
    type: 'position_update',
    timestamp: Date.now(),
    accountId: 'test-account-1',
    messageId: 'msg-001',
    data: testPositions[0]
  },
  {
    type: 'account_info',
    timestamp: Date.now(),
    accountId: 'test-account-1',
    messageId: 'msg-002',
    data: testAccounts[0]
  },
  {
    type: 'market_data',
    timestamp: Date.now(),
    accountId: 'test-account-1',
    messageId: 'msg-003',
    data: {
      symbol: 'EURUSD',
      bid: 1.1005,
      ask: 1.1007,
      spread: 0.0002,
      timestamp: Date.now()
    }
  },
  {
    type: 'losscut_alert',
    timestamp: Date.now(),
    accountId: 'test-account-1',
    messageId: 'msg-004',
    data: {
      positionId: 'pos-001',
      marginLevel: 50,
      alertLevel: 'critical',
      estimatedTime: 300 // 5分
    }
  },
  {
    type: 'heartbeat',
    timestamp: Date.now(),
    accountId: 'test-account-1',
    messageId: 'msg-005',
    data: {
      status: 'alive',
      uptime: 3600000, // 1時間
      lastTrade: Date.now() - 300000 // 5分前
    }
  }
]

export const testSystemCommands: SystemCommand[] = [
  {
    type: 'open_position',
    commandId: 'cmd-001',
    timestamp: Date.now(),
    data: {
      symbol: 'EURUSD',
      type: 'buy',
      lots: 0.1,
      price: 1.1010,
      stopLoss: 1.0990,
      takeProfit: 1.1030,
      comment: 'Test position'
    }
  },
  {
    type: 'close_position',
    commandId: 'cmd-002',
    timestamp: Date.now(),
    data: {
      positionId: 'pos-001',
      price: 1.1015,
      comment: 'Manual close'
    }
  },
  {
    type: 'update_trail',
    commandId: 'cmd-003',
    timestamp: Date.now(),
    data: {
      positionId: 'pos-001',
      trailDistance: 10,
      trailStep: 5,
      enabled: true
    }
  },
  {
    type: 'test_connection',
    commandId: 'cmd-004',
    timestamp: Date.now(),
    data: {
      testType: 'ping',
      payload: 'test-data'
    }
  }
]

// パフォーマンステスト用の大量データ生成
export function generateLargePositionDataset(count: number): TestPosition[] {
  const positions: TestPosition[] = []
  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'EURJPY', 'GBPJPY', 'EURGBP']
  const types: ('buy' | 'sell')[] = ['buy', 'sell']
  
  for (let i = 0; i < count; i++) {
    const symbol = symbols[i % symbols.length]
    const type = types[i % types.length]
    const basePrice = getBasePrice(symbol)
    const openPrice = basePrice + (Math.random() - 0.5) * 0.01
    const currentPrice = openPrice + (Math.random() - 0.5) * 0.005
    
    positions.push({
      positionId: `perf-pos-${i + 1}`,
      accountId: `test-account-${(i % 3) + 1}`,
      symbol,
      type,
      lots: Math.round((0.01 + Math.random() * 0.99) * 100) / 100,
      openPrice,
      currentPrice,
      profit: (currentPrice - openPrice) * (type === 'buy' ? 1 : -1) * 100000,
      swapPoints: Math.random() * 10 - 5,
      commission: -(Math.random() * 20 + 5),
      status: 'open'
    })
  }
  
  return positions
}

export function generateLargeAccountDataset(count: number): TestAccount[] {
  const accounts: TestAccount[] = []
  
  for (let i = 0; i < count; i++) {
    const balance = 1000 + Math.random() * 99000
    const equity = balance + (Math.random() - 0.5) * balance * 0.1
    const freeMargin = equity * (0.7 + Math.random() * 0.2)
    
    accounts.push({
      accountId: `perf-account-${i + 1}`,
      balance,
      equity,
      freeMargin,
      marginLevel: (equity / (equity - freeMargin)) * 100,
      bonusAmount: Math.random() * balance * 0.1,
      profit: equity - balance,
      credit: 0
    })
  }
  
  return accounts
}

function getBasePrice(symbol: string): number {
  const basePrices: { [key: string]: number } = {
    'EURUSD': 1.1000,
    'GBPUSD': 1.3000,
    'USDJPY': 150.00,
    'AUDUSD': 0.6500,
    'USDCAD': 1.3500,
    'EURJPY': 165.00,
    'GBPJPY': 195.00,
    'EURGBP': 0.8500
  }
  
  return basePrices[symbol] || 1.0000
}

// エラーテスト用のフィクスチャ
export const errorTestScenarios = [
  {
    name: 'Invalid Message Format',
    message: 'invalid-json-string',
    expectedError: 'JSON parse error'
  },
  {
    name: 'Missing Required Fields',
    message: {
      type: 'position_update',
      // timestamp missing
      accountId: 'test-account-1',
      data: testPositions[0]
    },
    expectedError: 'Missing required field: timestamp'
  },
  {
    name: 'Invalid Account ID',
    message: {
      type: 'position_update',
      timestamp: Date.now(),
      accountId: 'invalid-account',
      messageId: 'msg-error-001',
      data: testPositions[0]
    },
    expectedError: 'Invalid account ID'
  },
  {
    name: 'Invalid Position Data',
    message: {
      type: 'position_update',
      timestamp: Date.now(),
      accountId: 'test-account-1',
      messageId: 'msg-error-002',
      data: {
        positionId: 'pos-error',
        // missing required fields
        symbol: 'EURUSD'
      }
    },
    expectedError: 'Invalid position data'
  }
]

// 負荷テスト用のシナリオ
export const loadTestScenarios = [
  {
    name: 'Normal Load',
    concurrentClients: 10,
    messagesPerSecond: 100,
    duration: 60000, // 1分
    expectedSuccessRate: 99.5
  },
  {
    name: 'High Load',
    concurrentClients: 50,
    messagesPerSecond: 500,
    duration: 120000, // 2分
    expectedSuccessRate: 99.0
  },
  {
    name: 'Stress Test',
    concurrentClients: 100,
    messagesPerSecond: 1000,
    duration: 300000, // 5分
    expectedSuccessRate: 95.0
  }
]

// レスポンス時間テスト用のベンチマーク
export const responseTimeTargets = {
  excellent: 50,   // 50ms以下
  good: 100,       // 100ms以下
  acceptable: 200, // 200ms以下
  poor: 500        // 500ms以下
}

export const throughputTargets = {
  minimum: 100,    // 100 requests/sec
  target: 500,     // 500 requests/sec
  maximum: 1000    // 1000 requests/sec
}