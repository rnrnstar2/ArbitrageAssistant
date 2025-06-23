// GraphQL Mutations for MVP Core Operations (Position, Action, Account)

// Position Operations
export const createPosition = `
  mutation CreatePosition($input: CreatePositionInput!) {
    createPosition(input: $input) {
      id
      userId
      accountId
      executionType
      status
      symbol
      volume
      mtTicket
      entryPrice
      entryTime
      exitPrice
      exitTime
      exitReason
      trailWidth
      triggerActionIds
      memo
      createdAt
      updatedAt
    }
  }
`;

export const updatePosition = `
  mutation UpdatePosition($input: UpdatePositionInput!) {
    updatePosition(input: $input) {
      id
      userId
      accountId
      executionType
      status
      symbol
      volume
      mtTicket
      entryPrice
      entryTime
      exitPrice
      exitTime
      exitReason
      trailWidth
      triggerActionIds
      memo
      createdAt
      updatedAt
    }
  }
`;

// Action Operations
export const createAction = `
  mutation CreateAction($input: CreateActionInput!) {
    createAction(input: $input) {
      id
      userId
      accountId
      positionId
      triggerPositionId
      type
      status
      createdAt
      updatedAt
    }
  }
`;

export const updateAction = `
  mutation UpdateAction($input: UpdateActionInput!) {
    updateAction(input: $input) {
      id
      userId
      accountId
      positionId
      triggerPositionId
      type
      status
      createdAt
      updatedAt
    }
  }
`;

// Account Operations
export const updateAccount = `
  mutation UpdateAccount($input: UpdateAccountInput!) {
    updateAccount(input: $input) {
      id
      userId
      brokerType
      accountNumber
      serverName
      displayName
      balance
      credit
      equity
      isActive
      lastUpdated
      createdAt
      updatedAt
    }
  }
`;

// Account Status Report (for PC-Account assignment)
export const REPORT_ACCOUNT_STATUS = `
  mutation ReportAccountStatus(
    $accountId: String!,
    $status: String!,
    $pcId: String!
  ) {
    updateAccount(input: {
      id: $accountId,
      lastUpdated: "${new Date().toISOString()}"
    }) {
      id
      lastUpdated
    }
  }
`;