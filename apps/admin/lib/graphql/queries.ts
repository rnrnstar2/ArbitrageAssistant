// GraphQL Queries for MVP Core Operations (Position, Action, Account)

// Position Queries
export const listPositionsByUserId = `
  query ListPositionsByUserId($userId: ID!, $filter: ModelPositionFilterInput) {
    listPositions(filter: { 
      userId: { eq: $userId }
      and: [$filter]
    }) {
      items {
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
      nextToken
    }
  }
`;

// Trail monitoring positions (highest priority query)
export const listTrailPositions = `
  query ListTrailPositions($userId: ID!) {
    listPositions(filter: { 
      userId: { eq: $userId }
      trailWidth: { gt: 0 }
      status: { eq: OPEN }
    }) {
      items {
        id
        userId
        accountId
        symbol
        volume
        entryPrice
        trailWidth
        triggerActionIds
        status
      }
    }
  }
`;

// Open positions
export const listOpenPositions = `
  query ListOpenPositions($userId: ID!) {
    listPositions(filter: { 
      userId: { eq: $userId }
      status: { eq: OPEN }
    }) {
      items {
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
        trailWidth
        triggerActionIds
        memo
        createdAt
        updatedAt
      }
    }
  }
`;

// Action Queries
export const listActionsByUserId = `
  query ListActionsByUserId($userId: ID!, $filter: ModelActionFilterInput) {
    listActions(filter: { 
      userId: { eq: $userId }
      and: [$filter]
    }) {
      items {
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
      nextToken
    }
  }
`;

// Executing actions
export const listExecutingActions = `
  query ListExecutingActions($userId: ID!) {
    listActions(filter: { 
      userId: { eq: $userId }
      status: { eq: EXECUTING }
    }) {
      items {
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
  }
`;

// Pending actions
export const listPendingActions = `
  query ListPendingActions($userId: ID!) {
    listActions(filter: { 
      userId: { eq: $userId }
      status: { eq: PENDING }
    }) {
      items {
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
  }
`;

// Account Queries
export const listAccountsByUserId = `
  query ListAccountsByUserId($userId: ID!) {
    listAccounts(filter: { 
      userId: { eq: $userId }
      isActive: { eq: true }
    }) {
      items {
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
      }
    }
  }
`;