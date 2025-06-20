import { gql } from '@apollo/client'

// ポジション更新のサブスクリプション
export const POSITION_UPDATE_SUBSCRIPTION = gql`
  subscription OnPositionUpdate($filters: PositionFilters) {
    onPositionUpdate(filters: $filters) {
      id
      accountId
      symbol
      type
      lots
      openPrice
      currentPrice
      profit
      openTime
      updateTime
      trailSettings {
        enabled
        trailDistance
        stepSize
        startTrigger
      }
      nextAction {
        type
        conditions
        priority
      }
      closeSettings {
        targetPrice
        trailSettings {
          enabled
          trailDistance
          stepSize
          startTrigger
        }
        linkedCloseAction {
          positionId
          action
          settings {
            enabled
            trailDistance
            stepSize
            startTrigger
          }
        }
      }
      relatedPositionId
    }
  }
`

// アカウント更新のサブスクリプション
export const ACCOUNT_UPDATE_SUBSCRIPTION = gql`
  subscription OnAccountUpdate($accountIds: [String!]!) {
    onAccountUpdate(accountIds: $accountIds) {
      id
      clientPCId
      broker
      accountNumber
      balance
      equity
      margin
      marginLevel
      bonusAmount
      status
      positions {
        id
        symbol
        type
        lots
        profit
        currentPrice
      }
    }
  }
`

// クライアントPC接続状態のサブスクリプション
export const CLIENT_CONNECTION_SUBSCRIPTION = gql`
  subscription OnClientConnectionUpdate {
    onClientConnectionUpdate {
      id
      userId
      name
      status
      lastHeartbeat
      accounts {
        id
        broker
        accountNumber
        status
      }
    }
  }
`

// アラート通知のサブスクリプション
export const ALERT_NOTIFICATION_SUBSCRIPTION = gql`
  subscription OnAlertNotification($userId: String!) {
    onAlertNotification(userId: $userId) {
      id
      ruleId
      type
      message
      severity
      timestamp
      accountId
      positionId
      acknowledged
    }
  }
`

// EA接続状態のサブスクリプション
export const EA_CONNECTION_SUBSCRIPTION = gql`
  subscription OnEAConnectionUpdate($clientPCIds: [String!]!) {
    onEAConnectionUpdate(clientPCIds: $clientPCIds) {
      clientPCId
      accountId
      status
      lastDataReceived
      errorMessage
      connectionQuality
    }
  }
`

// リアルタイム価格更新のサブスクリプション
export const PRICE_UPDATE_SUBSCRIPTION = gql`
  subscription OnPriceUpdate($symbols: [String!]!) {
    onPriceUpdate(symbols: $symbols) {
      symbol
      bid
      ask
      timestamp
      spread
    }
  }
`

// システムイベントのサブスクリプション
export const SYSTEM_EVENT_SUBSCRIPTION = gql`
  subscription OnSystemEvent($eventTypes: [String!]) {
    onSystemEvent(eventTypes: $eventTypes) {
      id
      type
      message
      severity
      timestamp
      clientPCId
      accountId
      data
    }
  }
`

// 集約データのサブスクリプション
export const ANALYTICS_UPDATE_SUBSCRIPTION = gql`
  subscription OnAnalyticsUpdate($userId: String!) {
    onAnalyticsUpdate(userId: $userId) {
      totalExposure
      netPosition
      totalProfit
      totalLoss
      riskScore
      exposureBySymbol
      marginUtilization
      averageSpread
      timestamp
    }
  }
`