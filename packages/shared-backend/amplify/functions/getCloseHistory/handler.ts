import type { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  QueryCommand, 
  ScanCommand 
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface GetCloseHistoryArgs {
  accountIds?: string[];
  symbols?: string[];
  closeTypes?: string[];
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
  profitMin?: number;
  profitMax?: number;
  holdingDaysMin?: number;
  holdingDaysMax?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface CloseHistoryItem {
  id: string;
  positionId: string;
  accountId: string;
  symbol: string;
  type: string;
  lots: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  swapCost: number;
  holdingDays: number;
  closeType: string;
  trailSettings?: any;
  linkedAction?: any;
  status: string;
  executedAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export const handler: AppSyncResolverHandler<GetCloseHistoryArgs, any> = async (event) => {
  try {
    const args = event.arguments;
    const tableName = process.env.AMPLIFY_DATA_CLOSERECORD_TABLE_NAME;
    
    if (!tableName) {
      throw new Error('Table name not found in environment variables');
    }

    // Build filter expressions
    let filterExpression = '';
    let expressionAttributeNames: Record<string, string> = {};
    let expressionAttributeValues: Record<string, any> = {};
    let filterIndex = 0;

    const addFilter = (condition: string, value: any) => {
      if (filterExpression) {
        filterExpression += ' AND ';
      }
      filterExpression += condition;
      expressionAttributeValues[`:v${filterIndex}`] = value;
      filterIndex++;
    };

    // Apply filters
    if (args.accountIds && args.accountIds.length > 0) {
      const accountConditions = args.accountIds.map((_, index) => {
        expressionAttributeValues[`:accountId${index}`] = args.accountIds[index];
        return `accountId = :accountId${index}`;
      }).join(' OR ');
      addFilter(`(${accountConditions})`, null);
    }

    if (args.symbols && args.symbols.length > 0) {
      const symbolConditions = args.symbols.map((_, index) => {
        expressionAttributeValues[`:symbol${index}`] = args.symbols[index];
        return `#symbol = :symbol${index}`;
      }).join(' OR ');
      expressionAttributeNames['#symbol'] = 'symbol';
      addFilter(`(${symbolConditions})`, null);
    }

    if (args.closeTypes && args.closeTypes.length > 0) {
      const closeTypeConditions = args.closeTypes.map((_, index) => {
        expressionAttributeValues[`:closeType${index}`] = args.closeTypes[index];
        return `closeType = :closeType${index}`;
      }).join(' OR ');
      addFilter(`(${closeTypeConditions})`, null);
    }

    if (args.statuses && args.statuses.length > 0) {
      const statusConditions = args.statuses.map((_, index) => {
        expressionAttributeValues[`:status${index}`] = args.statuses[index];
        return `#status = :status${index}`;
      }).join(' OR ');
      expressionAttributeNames['#status'] = 'status';
      addFilter(`(${statusConditions})`, null);
    }

    if (args.dateFrom) {
      addFilter('executedAt >= :dateFrom', args.dateFrom);
    }

    if (args.dateTo) {
      addFilter('executedAt <= :dateTo', args.dateTo);
    }

    if (args.profitMin !== undefined) {
      addFilter('profit >= :profitMin', args.profitMin);
    }

    if (args.profitMax !== undefined) {
      addFilter('profit <= :profitMax', args.profitMax);
    }

    if (args.holdingDaysMin !== undefined) {
      addFilter('holdingDays >= :holdingDaysMin', args.holdingDaysMin);
    }

    if (args.holdingDaysMax !== undefined) {
      addFilter('holdingDays <= :holdingDaysMax', args.holdingDaysMax);
    }

    // Build scan parameters
    const scanParams: any = {
      TableName: tableName,
    };

    if (filterExpression) {
      scanParams.FilterExpression = filterExpression;
    }

    if (Object.keys(expressionAttributeNames).length > 0) {
      scanParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (Object.keys(expressionAttributeValues).length > 0) {
      scanParams.ExpressionAttributeValues = expressionAttributeValues;
    }

    // Execute scan
    const result = await docClient.send(new ScanCommand(scanParams));
    let items = result.Items as CloseHistoryItem[] || [];

    // Apply sorting
    const sortBy = args.sortBy || 'executedAt';
    const sortOrder = args.sortOrder || 'desc';
    
    items.sort((a, b) => {
      let aValue: any = a[sortBy as keyof CloseHistoryItem];
      let bValue: any = b[sortBy as keyof CloseHistoryItem];
      
      // Handle date sorting
      if (sortBy === 'executedAt' || sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }
      
      // Handle numeric sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });

    // Apply pagination
    const offset = args.offset || 0;
    const limit = args.limit || 50;
    const total = items.length;
    const paginatedItems = items.slice(offset, offset + limit);

    // Calculate additional fields
    const enrichedItems = paginatedItems.map(item => ({
      ...item,
      totalReturn: item.profit - (item.swapCost || 0),
      dailyReturn: item.holdingDays > 0 
        ? (item.profit - (item.swapCost || 0)) / item.holdingDays 
        : 0,
    }));

    // Calculate statistics
    const stats = {
      totalTrades: total,
      totalProfit: items.reduce((sum, item) => sum + item.profit, 0),
      totalSwapCost: items.reduce((sum, item) => sum + (item.swapCost || 0), 0),
      totalReturn: items.reduce((sum, item) => sum + (item.profit - (item.swapCost || 0)), 0),
      averageHoldingDays: total > 0 
        ? items.reduce((sum, item) => sum + item.holdingDays, 0) / total 
        : 0,
      successRate: total > 0 
        ? items.filter(item => item.status === 'executed').length / total 
        : 0,
      profitableRate: total > 0 
        ? items.filter(item => item.profit > 0).length / total 
        : 0,
    };

    return {
      items: enrichedItems,
      total,
      hasNextPage: offset + limit < total,
      hasPreviousPage: offset > 0,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit),
      stats,
    };

  } catch (error) {
    console.error('Error fetching close history:', error);
    throw new Error('Failed to fetch close history');
  }
};