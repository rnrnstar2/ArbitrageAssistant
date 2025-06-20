import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  submitEntry: a
    .mutation()
    .arguments({
      accountId: a.string().required(),
      symbol: a.string().required(),
      type: a.string().required(),
      lots: a.float().required(),
      price: a.float(),
      trailSettings: a.json(),
      hedgeSettings: a.json(),
    })
    .returns(a.json())
    .handler(a.handler.function("createEntry"))
    .authorization((allow) => [allow.authenticated()]),

  getCloseHistory: a
    .query()
    .arguments({
      accountIds: a.json(),
      symbols: a.json(),
      closeTypes: a.json(),
      statuses: a.json(),
      dateFrom: a.datetime(),
      dateTo: a.datetime(),
      profitMin: a.float(),
      profitMax: a.float(),
      holdingDaysMin: a.integer(),
      holdingDaysMax: a.integer(),
      sortBy: a.string(),
      sortOrder: a.string(),
      limit: a.integer(),
      offset: a.integer(),
    })
    .returns(a.json())
    .handler(a.handler.function("getCloseHistory"))
    .authorization((allow) => [allow.authenticated()]),
  
  closePosition: a
    .mutation()
    .arguments({
      positionId: a.string().required(),
      closePrice: a.float().required(),
      closeType: a.string().required(),
      trailSettings: a.json(),
      linkedAction: a.json(),
    })
    .returns(a.json())
    .handler(a.handler.function("closePosition"))
    .authorization((allow) => [allow.authenticated()]),
  
  batchClosePositions: a
    .mutation()
    .arguments({
      positionIds: a.json().required(),
      closeType: a.string().required(),
      trailSettings: a.json(),
      priority: a.string().required(),
    })
    .returns(a.json())
    .handler(a.handler.function("batchClosePositions"))
    .authorization((allow) => [allow.authenticated()]),

  createPosition: a
    .mutation()
    .arguments({
      accountId: a.id().required(),
      symbol: a.string().required(),
      type: a.string().required(),
      lots: a.float().required(),
      openPrice: a.float().required(),
      currentPrice: a.float().required(),
      profit: a.float().required(),
      status: a.string().required(),
      openedAt: a.datetime().required(),
      trailSettings: a.json(),
      closeSettings: a.json(),
      relatedPositionId: a.id(),
    })
    .returns(a.ref("Position"))
    .handler(a.handler.function("createPositionRecord"))
    .authorization((allow) => [allow.authenticated()]),

  updatePosition: a
    .mutation()
    .arguments({
      id: a.id().required(),
      currentPrice: a.float(),
      profit: a.float(),
      swapTotal: a.float(),
      status: a.string(),
      closedAt: a.datetime(),
      trailSettings: a.json(),
      closeSettings: a.json(),
    })
    .returns(a.ref("Position"))
    .handler(a.handler.function("updatePositionRecord"))
    .authorization((allow) => [allow.authenticated()]),
  User: a
    .model({
      email: a.string().required(),
      role: a.string().required(), // admin | client
      clientPCs: a.hasMany("ClientPC", "userId"),
      closeRules: a.hasMany("CloseRule", "userId"),
    })
    .authorization((allow) => [allow.ownerDefinedIn("id")]),

  ClientPC: a
    .model({
      userId: a.id().required(),
      name: a.string().required(),
      status: a.string().required(), // online | offline
      lastSeen: a.datetime(),
      user: a.belongsTo("User", "userId"),
      accounts: a.hasMany("Account", "clientPCId"),
    })
    .authorization((allow) => [allow.owner()]),

  Account: a
    .model({
      clientPCId: a.id().required(),
      broker: a.string().required(),
      accountNumber: a.string().required(),
      balance: a.float().required(),
      bonusAmount: a.float().required(),
      equity: a.float().required(),
      marginLevel: a.float(),
      clientPC: a.belongsTo("ClientPC", "clientPCId"),
      positions: a.hasMany("Position", "accountId"),
      entries: a.hasMany("Entry", "accountId"),
      closeRecords: a.hasMany("CloseRecord", "accountId"),
    })
    .authorization((allow) => [allow.owner()]),

  Position: a
    .model({
      accountId: a.id().required(),
      symbol: a.string().required(),
      type: a.string().required(), // buy | sell
      lots: a.float().required(),
      openPrice: a.float().required(),
      currentPrice: a.float().required(),
      profit: a.float().required(),
      swapTotal: a.float().default(0),
      trailSettings: a.json(),
      closeSettings: a.json(),
      relatedPositionId: a.id(),
      status: a.string().required(), // open | pending_close | closed
      openedAt: a.datetime().required(),
      closedAt: a.datetime(),
      account: a.belongsTo("Account", "accountId"),
    })
    .authorization((allow) => [allow.owner()]),


  Entry: a
    .model({
      accountId: a.id().required(),
      symbol: a.string().required(),
      type: a.string().required(), // buy | sell
      lots: a.float().required(),
      price: a.float(),
      trailSettings: a.json(),
      hedgeSettings: a.json(),
      status: a.string().required(), // pending | executed | failed | timeout
      createdAt: a.datetime().required(),
      executedAt: a.datetime(),
      resultPositionId: a.id(),
      error: a.string(),
      account: a.belongsTo("Account", "accountId"),
    })
    .authorization((allow) => [allow.owner()]),

  CloseRecord: a
    .model({
      positionId: a.id().required(),
      accountId: a.id().required(),
      symbol: a.string().required(),
      type: a.string().required(), // buy | sell
      lots: a.float().required(),
      openPrice: a.float().required(),
      closePrice: a.float().required(),
      profit: a.float().required(),
      swapCost: a.float().default(0),
      holdingDays: a.integer().required(),
      closeType: a.string().required(), // market | limit
      trailSettings: a.json(),
      linkedAction: a.json(),
      status: a.string().required(), // pending | executed | failed
      executedAt: a.datetime(),
      error: a.string(),
      account: a.belongsTo("Account", "accountId"),
    })
    .authorization((allow) => [allow.owner()]),

  CloseRule: a
    .model({
      name: a.string().required(),
      conditions: a.json().required(),
      actions: a.json().required(),
      isActive: a.boolean().required(),
      userId: a.id().required(),
      user: a.belongsTo("User", "userId"),
    })
    .authorization((allow) => [allow.owner()]),

  WebSocketConnection: a
    .model({
      connectionId: a.string().required(),
      clientId: a.string(),
      userId: a.string(),
      connectedAt: a.datetime().required(),
      lastHeartbeat: a.datetime().required(),
    })
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  name: "ArbitrageAssistantData",
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
