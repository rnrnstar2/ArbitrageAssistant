import { GraphQLMutation, GraphQLQuery, SyncOperation, ConflictItem } from './types';
import { Position, Account, EAConnection } from '../types';

export class GraphQLSyncClient {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(endpoint: string, authToken?: string) {
    this.endpoint = endpoint;
    this.headers = {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    };
  }

  /**
   * GraphQL クエリを実行
   */
  async executeQuery<T = any>(query: GraphQLQuery): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        query: query.operation,
        variables: query.variables,
      }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL query failed: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  /**
   * GraphQL ミューテーションを実行
   */
  async executeMutation<T = any>(mutation: GraphQLMutation): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        query: mutation.operation,
        variables: mutation.variables,
      }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL mutation failed: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  /**
   * ポジション同期
   */
  async syncPositions(accountId: string, positions: Position[]): Promise<void> {
    const mutation: GraphQLMutation = {
      name: 'syncPositions',
      variables: {
        accountId,
        positions: positions.map(this.transformPositionForGraphQL),
      },
      operation: `
        mutation SyncPositions($accountId: String!, $positions: [PositionInput!]!) {
          syncPositions(accountId: $accountId, positions: $positions) {
            success
            message
            conflictedPositions {
              ticket
              serverData
              clientData
            }
          }
        }
      `,
    };

    const result = await this.executeMutation(mutation);
    
    if (!result.syncPositions.success) {
      throw new Error(`Position sync failed: ${result.syncPositions.message}`);
    }

    // コンフリクトがある場合は処理
    if (result.syncPositions.conflictedPositions?.length > 0) {
      throw new ConflictError('Position conflicts detected', result.syncPositions.conflictedPositions);
    }
  }

  /**
   * アカウント同期
   */
  async syncAccount(accountId: string, account: Account): Promise<void> {
    const mutation: GraphQLMutation = {
      name: 'syncAccount',
      variables: {
        accountId,
        account: this.transformAccountForGraphQL(account),
      },
      operation: `
        mutation SyncAccount($accountId: String!, $account: AccountInput!) {
          syncAccount(accountId: $accountId, account: $account) {
            success
            message
            conflictData
          }
        }
      `,
    };

    const result = await this.executeMutation(mutation);
    
    if (!result.syncAccount.success) {
      throw new Error(`Account sync failed: ${result.syncAccount.message}`);
    }

    if (result.syncAccount.conflictData) {
      throw new ConflictError('Account conflict detected', result.syncAccount.conflictData);
    }
  }

  /**
   * EA接続状態同期
   */
  async syncConnection(accountId: string, connection: EAConnection): Promise<void> {
    const mutation: GraphQLMutation = {
      name: 'syncConnection',
      variables: {
        accountId,
        connection: this.transformConnectionForGraphQL(connection),
      },
      operation: `
        mutation SyncConnection($accountId: String!, $connection: ConnectionInput!) {
          syncConnection(accountId: $accountId, connection: $connection) {
            success
            message
          }
        }
      `,
    };

    const result = await this.executeMutation(mutation);
    
    if (!result.syncConnection.success) {
      throw new Error(`Connection sync failed: ${result.syncConnection.message}`);
    }
  }

  /**
   * 複数操作をバッチで実行
   */
  async executeBatch(operations: SyncOperation[]): Promise<Map<string, { success: boolean; error?: string }>> {
    const results = new Map<string, { success: boolean; error?: string }>();
    
    // GraphQL のバッチ実行をサポートしている場合
    const batchMutation: GraphQLMutation = {
      name: 'executeBatch',
      variables: {
        operations: operations.map(op => ({
          id: op.id,
          type: op.type,
          entity: op.entity,
          accountId: op.accountId,
          data: this.transformDataForGraphQL(op.entity, op.data),
        })),
      },
      operation: `
        mutation ExecuteBatch($operations: [SyncOperationInput!]!) {
          executeBatch(operations: $operations) {
            results {
              id
              success
              message
              conflictData
            }
          }
        }
      `,
    };

    try {
      const result = await this.executeMutation(batchMutation);
      
      for (const opResult of result.executeBatch.results) {
        results.set(opResult.id, {
          success: opResult.success,
          error: opResult.success ? undefined : opResult.message,
        });
      }
    } catch (error) {
      // バッチ実行が失敗した場合は個別実行
      for (const operation of operations) {
        try {
          await this.executeSingleOperation(operation);
          results.set(operation.id, { success: true });
        } catch (opError) {
          results.set(operation.id, { 
            success: false, 
            error: opError instanceof Error ? opError.message : 'Unknown error' 
          });
        }
      }
    }

    return results;
  }

  /**
   * サーバーデータを取得（コンフリクト解決用）
   */
  async fetchServerData(accountId: string, entity: 'position' | 'account' | 'connection', entityId?: string): Promise<any> {
    let query: GraphQLQuery;

    switch (entity) {
      case 'position':
        query = {
          name: 'getPosition',
          variables: { accountId, ticket: entityId },
          operation: `
            query GetPosition($accountId: String!, $ticket: String!) {
              getPosition(accountId: $accountId, ticket: $ticket) {
                ticket
                symbol
                type
                volume
                openPrice
                currentPrice
                profit
                swap
                sl
                tp
                openTime
                comment
                lastUpdated
              }
            }
          `,
        };
        break;

      case 'account':
        query = {
          name: 'getAccount',
          variables: { accountId },
          operation: `
            query GetAccount($accountId: String!) {
              getAccount(accountId: $accountId) {
                accountId
                balance
                equity
                margin
                marginFree
                marginLevel
                credit
                profit
                server
                currency
                leverage
                lastUpdated
              }
            }
          `,
        };
        break;

      case 'connection':
        query = {
          name: 'getConnection',
          variables: { accountId },
          operation: `
            query GetConnection($accountId: String!) {
              getConnection(accountId: $accountId) {
                accountId
                clientPCId
                status
                lastSeen
                version
                broker
                accountNumber
                connectionInfo
                lastUpdated
              }
            }
          `,
        };
        break;

      default:
        throw new Error(`Unknown entity type: ${entity}`);
    }

    const result = await this.executeQuery(query);
    return result[query.name];
  }

  private async executeSingleOperation(operation: SyncOperation): Promise<void> {
    switch (operation.entity) {
      case 'position':
        await this.syncPositions(operation.accountId, [operation.data]);
        break;
      case 'account':
        await this.syncAccount(operation.accountId, operation.data);
        break;
      case 'connection':
        await this.syncConnection(operation.accountId, operation.data);
        break;
      default:
        throw new Error(`Unknown entity type: ${operation.entity}`);
    }
  }

  private transformPositionForGraphQL(position: Position): any {
    return {
      ticket: position.ticket,
      symbol: position.symbol,
      type: position.type,
      volume: position.volume,
      openPrice: position.openPrice,
      currentPrice: position.currentPrice,
      profit: position.profit,
      swap: position.swap,
      sl: position.sl,
      tp: position.tp,
      openTime: position.openTime.toISOString(),
      comment: position.comment,
    };
  }

  private transformAccountForGraphQL(account: Account): any {
    return {
      accountId: account.accountId,
      balance: account.balance,
      equity: account.equity,
      margin: account.margin,
      marginFree: account.marginFree,
      marginLevel: account.marginLevel,
      credit: account.credit,
      profit: account.profit,
      server: account.server,
      currency: account.currency,
      leverage: account.leverage,
    };
  }

  private transformConnectionForGraphQL(connection: EAConnection): any {
    return {
      accountId: connection.accountId,
      clientPCId: connection.clientPCId,
      status: connection.status,
      lastSeen: connection.lastSeen.toISOString(),
      version: connection.version,
      broker: connection.broker,
      accountNumber: connection.accountNumber,
      connectionInfo: {
        ipAddress: connection.connectionInfo.ipAddress,
        userAgent: connection.connectionInfo.userAgent,
        connectedAt: connection.connectionInfo.connectedAt.toISOString(),
      },
    };
  }

  private transformDataForGraphQL(entity: string, data: any): any {
    switch (entity) {
      case 'position':
        return this.transformPositionForGraphQL(data);
      case 'account':
        return this.transformAccountForGraphQL(data);
      case 'connection':
        return this.transformConnectionForGraphQL(data);
      default:
        return data;
    }
  }
}

export class ConflictError extends Error {
  public readonly conflictData: any;

  constructor(message: string, conflictData: any) {
    super(message);
    this.name = 'ConflictError';
    this.conflictData = conflictData;
  }
}