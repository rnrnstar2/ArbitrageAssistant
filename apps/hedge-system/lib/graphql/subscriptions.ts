// GraphQL Subscription definitions for Action monitoring

export const SUBSCRIBE_TO_ACTIONS = /* GraphQL */ `
  subscription OnActionUpdate($accountId: String!) {
    onActionUpdate(accountId: $accountId) {
      actionId
      strategyId
      type
      status
      positionId
      params
      triggerType
      targetPCId
      trailWidth
      createdAt
      updatedAt
    }
  }
`;

export const SUBSCRIBE_TO_STRATEGY_ACTIONS = /* GraphQL */ `
  subscription OnStrategyActionUpdate($strategyId: ID!) {
    onStrategyActionUpdate(strategyId: $strategyId) {
      actionId
      strategyId
      type
      status
      positionId
      params
      createdAt
      updatedAt
    }
  }
`;

export const SUBSCRIBE_TO_POSITION_UPDATES = /* GraphQL */ `
  subscription OnPositionUpdate($accountId: String!) {
    onPositionUpdate(accountId: $accountId) {
      positionId
      strategyId
      status
      symbol
      volume
      entryPrice
      currentPrice
      profit
      stopLoss
      takeProfit
      trailWidth
      primary
      updatedAt
    }
  }
`;