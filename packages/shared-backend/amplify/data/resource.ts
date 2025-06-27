import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { postConfirmation } from "../auth/post-confirmation/resource";

const schema = a
  .schema({
    // ===== ENUMS =====
    Symbol: a.enum(["USDJPY", "EURUSD", "EURGBP", "XAUUSD"]),
    PositionStatus: a.enum([
      "PENDING",
      "OPENING",
      "OPEN",
      "CLOSING",
      "CLOSED",
      "STOPPED",
      "CANCELED",
    ]),
    ActionType: a.enum(["ENTRY", "CLOSE"]),
    ActionStatus: a.enum(["PENDING", "EXECUTING", "EXECUTED", "FAILED"]),
    ExecutionType: a.enum(["ENTRY", "EXIT"]),
    UserRole: a.enum(["CLIENT", "ADMIN"]),
    PCStatus: a.enum(["ONLINE", "OFFLINE"]),

    // ===== MODELS =====
    User: a
      .model({
        email: a.string().required(),
        name: a.string().required(),
        role: a.ref("UserRole").required(),
        pcStatus: a.ref("PCStatus"),
        isActive: a.boolean().required(),
        accounts: a.hasMany("Account", "userId"),
        createdAt: a.datetime(),
        updatedAt: a.datetime(),
      })
      .authorization((allow) => [
        allow.authenticated().to(["read", "update"]),
        allow.groups(["admin"]).to(["create", "read", "update", "delete"]),
        allow.authenticated().to(["create"]),
      ]),

    Account: a
      .model({
        userId: a.string().required(),
        brokerType: a.string().required(),
        accountNumber: a.string().required(),
        serverName: a.string().required(),
        displayName: a.string().required(),
        balance: a.float(),
        credit: a.float(),
        equity: a.float(),
        isActive: a.boolean().default(true),
        lastUpdated: a.datetime(),
        user: a.belongsTo("User", "userId"),
        positions: a.hasMany("Position", "accountId"),
        actions: a.hasMany("Action", "accountId"),
        createdAt: a.datetime(),
        updatedAt: a.datetime(),
      })
      .secondaryIndexes((index) => [
        index("userId"),
      ])
      .authorization((allow) => [
        allow.authenticated().to(["create", "read", "update", "delete"]),
        allow.groups(["admin"]).to(["create", "read", "update", "delete"]),
        allow.groups(["operator"]).to(["read", "update"]),
        allow.groups(["viewer"]).to(["read"]),
      ]),

    Position: a
      .model({
        userId: a.string().required(),
        accountId: a.string().required(),
        executionType: a.ref("ExecutionType").required(),
        status: a.ref("PositionStatus").required(),
        symbol: a.ref("Symbol").required(),
        volume: a.float().required(),
        mtTicket: a.string(),
        entryPrice: a.float(),
        entryTime: a.datetime(),
        exitPrice: a.float(),
        exitTime: a.datetime(),
        exitReason: a.string(),
        trailWidth: a.float(),
        triggerActionIds: a.string(),
        memo: a.string(),
        account: a.belongsTo("Account", "accountId"),
        actions: a.hasMany("Action", "positionId"),
        triggerActions: a.hasMany("Action", "triggerPositionId"),
        createdAt: a.datetime(),
        updatedAt: a.datetime(),
      })
      .secondaryIndexes((index) => [
        index("userId").sortKeys(["status"]),
        index("userId").name("userIdTrailIndex").sortKeys(["trailWidth"]),
        index("accountId").sortKeys(["status"]),
      ])
      .authorization((allow) => [
        allow.authenticated().to(["create", "read", "update", "delete"]),
        allow.groups(["admin"]).to(["create", "read", "update", "delete"]),
        allow.groups(["operator"]).to(["read", "update"]),
        allow.groups(["viewer"]).to(["read"]),
      ]),

    Action: a
      .model({
        userId: a.string().required(),
        accountId: a.string().required(),
        positionId: a.string().required(),
        triggerPositionId: a.string(),
        type: a.ref("ActionType").required(),
        status: a.ref("ActionStatus").required(),
        account: a.belongsTo("Account", "accountId"),
        position: a.belongsTo("Position", "positionId"),
        triggerPosition: a.belongsTo("Position", "triggerPositionId"),
        createdAt: a.datetime(),
        updatedAt: a.datetime(),
      })
      .secondaryIndexes((index) => [
        index("userId").sortKeys(["status"]),
        index("accountId").sortKeys(["status"]),
        index("positionId").sortKeys(["type"]),
      ])
      .authorization((allow) => [
        allow.authenticated().to(["create", "read", "update", "delete"]),
        allow.groups(["admin"]).to(["create", "read", "update", "delete"]),
        allow.groups(["operator"]).to(["read", "update"]),
        allow.groups(["viewer"]).to(["read"]),
      ]),

    // ===== SUBSCRIPTIONS =====
    // Real-time subscriptions for Position updates
    onPositionUpdated: a
      .subscription()
      .for(a.ref("Position"))
      .authorization((allow) => [
        allow.authenticated(),
        allow.groups(["admin", "operator", "viewer"]),
      ]),

    // Real-time subscriptions for Action creation/updates
    onActionCreated: a
      .subscription()
      .for(a.ref("Action"))
      .authorization((allow) => [
        allow.authenticated(),
        allow.groups(["admin", "operator", "viewer"]),
      ]),

    // Real-time subscriptions for Account balance changes
    onAccountBalanceChanged: a
      .subscription()
      .for(a.ref("Account"))
      .authorization((allow) => [
        allow.authenticated(),
        allow.groups(["admin", "operator", "viewer"]),
      ]),
  })
  .authorization((allow) => [allow.resource(postConfirmation)]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  name: `ArbitrageAssistant-Data-${process.env.NODE_ENV || 'dev'}`,
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
