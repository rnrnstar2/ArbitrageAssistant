import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  ClientPC: a.model({
    name: a.string().required(),
    status: a.string().default('offline'),
    lastSeen: a.datetime(),
    accounts: a.hasMany('Account', 'clientPCId'),
  })
  .authorization(allow => [allow.owner()]),

  Account: a.model({
    clientPCId: a.id(),
    clientPC: a.belongsTo('ClientPC', 'clientPCId'),
    name: a.string().required(),
    broker: a.string().required(),
    accountNumber: a.string().required(),
    balance: a.float().required(),
    equity: a.float().required(),
    margin: a.float().required(),
    freeMargin: a.float().required(),
    marginLevel: a.float().required(),
    bonusAmount: a.float().default(0),
    isActive: a.boolean().default(true),
    positions: a.hasMany('Position', 'accountId'),
    closeRecords: a.hasMany('CloseRecord', 'accountId'),
  })
  .authorization(allow => [allow.owner()]),

  Position: a.model({
    accountId: a.id().required(),
    account: a.belongsTo('Account', 'accountId'),
    symbol: a.string().required(),
    volume: a.float().required(),
    openPrice: a.float().required(),
    currentPrice: a.float(),
    type: a.enum(['BUY', 'SELL']),
    openTime: a.datetime().required(),
    closeTime: a.datetime(),
    profit: a.float().default(0),
    status: a.enum(['OPEN', 'CLOSED']),
  })
  .authorization(allow => [allow.owner()]),

  Entry: a.model({
    accountId: a.id().required(),
    symbol: a.string().required(),
    volume: a.float().required(),
    price: a.float().required(),
    type: a.enum(['BUY', 'SELL']),
    executedAt: a.datetime().required(),
    status: a.enum(['SUCCESS', 'FAILED']),
  })
  .authorization(allow => [allow.owner()]),

  CloseRecord: a.model({
    positionId: a.id().required(),
    accountId: a.id().required(),
    account: a.belongsTo('Account', 'accountId'),
    symbol: a.string().required(),
    type: a.enum(['BUY', 'SELL']),
    lots: a.float().required(),
    openPrice: a.float().required(),
    closePrice: a.float().required(),
    profit: a.float().required(),
    swapCost: a.float().default(0),
    holdingDays: a.integer().default(0),
    closeType: a.string().default('market'),
    status: a.string().default('pending'),
    executedAt: a.datetime(),
    error: a.string(),
  })
  .authorization(allow => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
