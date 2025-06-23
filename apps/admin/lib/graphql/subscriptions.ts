// GraphQL Subscriptions for MVP Multi-System Coordination

// Action status change monitoring (most critical for execution assignment)
export const onActionStatusChanged = `
  subscription OnActionStatusChanged($userId: ID!) {
    onUpdateAction(filter: { userId: { eq: $userId } }) {
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

// Position status change monitoring
export const onPositionStatusChanged = `
  subscription OnPositionStatusChanged($userId: ID!) {
    onUpdatePosition(filter: { userId: { eq: $userId } }) {
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
      trailWidth
      triggerActionIds
      updatedAt
    }
  }
`;

// New action creation monitoring
export const onActionCreated = `
  subscription OnActionCreated($userId: ID!) {
    onCreateAction(filter: { userId: { eq: $userId } }) {
      id
      userId
      accountId
      positionId
      triggerPositionId
      type
      status
      createdAt
    }
  }
`;

// Account updates monitoring (balance, credit changes)
export const onAccountUpdated = `
  subscription OnAccountUpdated($userId: ID!) {
    onUpdateAccount(filter: { userId: { eq: $userId } }) {
      id
      userId
      displayName
      balance
      credit
      equity
      lastUpdated
    }
  }
`;