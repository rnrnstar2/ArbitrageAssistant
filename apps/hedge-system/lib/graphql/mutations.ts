// GraphQL Mutation definitions for Action management

export const UPDATE_ACTION_STATUS = /* GraphQL */ `
  mutation UpdateActionStatus($actionId: ID!, $status: ActionStatus!, $result: AWSJSON) {
    updateAction(input: { actionId: $actionId, status: $status, result: $result }) {
      actionId
      status
      result
      updatedAt
    }
  }
`;

export const CREATE_ENTRY_ACTION = /* GraphQL */ `
  mutation CreateEntryAction($input: CreateActionInput!) {
    createAction(input: $input) {
      actionId
      strategyId
      type
      positionId
      params
      status
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_CLOSE_ACTION = /* GraphQL */ `
  mutation CreateCloseAction($input: CreateActionInput!) {
    createAction(input: $input) {
      actionId
      strategyId
      type
      positionId
      params
      status
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_TRAIL_ACTION = /* GraphQL */ `
  mutation CreateTrailAction($input: CreateActionInput!) {
    createAction(input: $input) {
      actionId
      strategyId
      type
      positionId
      params
      status
      triggerType
      trailWidth
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_POSITION_STATUS = /* GraphQL */ `
  mutation UpdatePositionStatus($positionId: ID!, $status: PositionStatus!) {
    updatePosition(input: { positionId: $positionId, status: $status }) {
      positionId
      status
      updatedAt
    }
  }
`;

export const UPDATE_STRATEGY_STATUS = /* GraphQL */ `
  mutation UpdateStrategyStatus($strategyId: ID!, $status: String!) {
    updateStrategy(input: { strategyId: $strategyId, status: $status }) {
      strategyId
      status
      updatedAt
    }
  }
`;

export const REPORT_ACCOUNT_STATUS = /* GraphQL */ `
  mutation ReportAccountStatus($accountId: ID!, $status: String!, $pcId: String!) {
    reportAccountStatus(input: { accountId: $accountId, status: $status, pcId: $pcId }) {
      accountId
      status
      pcId
      updatedAt
    }
  }
`;