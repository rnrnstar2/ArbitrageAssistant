import { type ClientSchema } from "@aws-amplify/backend";
declare const schema: import("@aws-amplify/data-schema").ModelSchema<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
    types: {
        Symbol: import("@aws-amplify/data-schema").EnumType<readonly ["USDJPY", "EURUSD", "EURGBP", "XAUUSD"]>;
        PositionStatus: import("@aws-amplify/data-schema").EnumType<readonly ["PENDING", "OPENING", "OPEN", "CLOSING", "CLOSED", "STOPPED", "CANCELED"]>;
        ActionType: import("@aws-amplify/data-schema").EnumType<readonly ["ENTRY", "CLOSE"]>;
        ActionStatus: import("@aws-amplify/data-schema").EnumType<readonly ["PENDING", "EXECUTING", "EXECUTED", "FAILED"]>;
        ExecutionType: import("@aws-amplify/data-schema").EnumType<readonly ["ENTRY", "EXIT"]>;
        UserRole: import("@aws-amplify/data-schema").EnumType<readonly ["CLIENT", "ADMIN"]>;
        PCStatus: import("@aws-amplify/data-schema").EnumType<readonly ["ONLINE", "OFFLINE"]>;
        User: import("@aws-amplify/data-schema").ModelType<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
            fields: {
                email: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                name: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                role: import("@aws-amplify/data-schema").RefType<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
                    type: "ref";
                    link: "UserRole";
                    valueRequired: false;
                    array: false;
                    arrayRequired: false;
                    authorization: [];
                }, "valueRequired", true>, "required", undefined>;
                pcStatus: import("@aws-amplify/data-schema").RefType<{
                    type: "ref";
                    link: "PCStatus";
                    valueRequired: false;
                    array: false;
                    arrayRequired: false;
                    authorization: [];
                }, never, undefined>;
                isActive: import("@aws-amplify/data-schema").ModelField<boolean, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.Boolean>;
                accounts: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"Account", import("@aws-amplify/data-schema").ModelRelationshipTypes.hasMany, true>, "Account", "required", undefined>;
                createdAt: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
                updatedAt: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
            };
            identifier: import("@aws-amplify/data-schema").ModelDefaultIdentifier;
            secondaryIndexes: [];
            authorization: [];
            disabledOperations: [];
        }, "authorization", (Omit<import("@aws-amplify/data-schema").Authorization<"owner", "owner", false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
            identityClaim: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, property: string) => Omit<SELF, "identityClaim">;
        }, "to"> | Omit<import("@aws-amplify/data-schema").Authorization<"groups", undefined, false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
            withClaimIn: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, property: string) => Omit<SELF, "withClaimIn">;
        }, "to"> | Omit<import("@aws-amplify/data-schema").Authorization<"private", undefined, false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
        }, "to">)[]>, "authorization">;
        Account: import("@aws-amplify/data-schema").ModelType<import("@aws-amplify/data-schema-types").SetTypeSubArg<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
            fields: {
                userId: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                brokerType: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                accountNumber: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                serverName: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                displayName: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                balance: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Float>;
                credit: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Float>;
                equity: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Float>;
                isActive: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<boolean>, "default", undefined, import("@aws-amplify/data-schema").ModelFieldType.Boolean>;
                lastUpdated: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
                user: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"User", import("@aws-amplify/data-schema").ModelRelationshipTypes.belongsTo, false>, "User", "required" | "valueRequired", undefined>;
                positions: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"Position", import("@aws-amplify/data-schema").ModelRelationshipTypes.hasMany, true>, "Position", "required", undefined>;
                actions: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"Action", import("@aws-amplify/data-schema").ModelRelationshipTypes.hasMany, true>, "Action", "required", undefined>;
                createdAt: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
                updatedAt: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
            };
            identifier: import("@aws-amplify/data-schema").ModelDefaultIdentifier;
            secondaryIndexes: [];
            authorization: [];
            disabledOperations: [];
        }, "secondaryIndexes", [{
            defaultQueryFieldSuffix: "UserId";
            queryField: never;
            pk: {
                userId: string;
            };
            sk: never;
            compositeSk: never;
        }]>, "authorization", (Omit<import("@aws-amplify/data-schema").Authorization<"owner", "owner", false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
            identityClaim: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, property: string) => Omit<SELF, "identityClaim">;
        }, "to"> | Omit<import("@aws-amplify/data-schema").Authorization<"groups", undefined, false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
            withClaimIn: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, property: string) => Omit<SELF, "withClaimIn">;
        }, "to">)[]>, "secondaryIndexes" | "authorization">;
        Position: import("@aws-amplify/data-schema").ModelType<import("@aws-amplify/data-schema-types").SetTypeSubArg<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
            fields: {
                userId: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                accountId: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                executionType: import("@aws-amplify/data-schema").RefType<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
                    type: "ref";
                    link: "ExecutionType";
                    valueRequired: false;
                    array: false;
                    arrayRequired: false;
                    authorization: [];
                }, "valueRequired", true>, "required", undefined>;
                status: import("@aws-amplify/data-schema").RefType<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
                    type: "ref";
                    link: "PositionStatus";
                    valueRequired: false;
                    array: false;
                    arrayRequired: false;
                    authorization: [];
                }, "valueRequired", true>, "required", undefined>;
                symbol: import("@aws-amplify/data-schema").RefType<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
                    type: "ref";
                    link: "Symbol";
                    valueRequired: false;
                    array: false;
                    arrayRequired: false;
                    authorization: [];
                }, "valueRequired", true>, "required", undefined>;
                volume: import("@aws-amplify/data-schema").ModelField<number, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.Float>;
                mtTicket: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                entryPrice: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Float>;
                entryTime: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
                exitPrice: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Float>;
                exitTime: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
                exitReason: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                trailWidth: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<number>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.Float>;
                triggerActionIds: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                memo: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                account: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"Account", import("@aws-amplify/data-schema").ModelRelationshipTypes.belongsTo, false>, "Account", "required" | "valueRequired", undefined>;
                actions: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"Action", import("@aws-amplify/data-schema").ModelRelationshipTypes.hasMany, true>, "Action", "required", undefined>;
                triggerActions: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"Action", import("@aws-amplify/data-schema").ModelRelationshipTypes.hasMany, true>, "Action", "required", undefined>;
                createdAt: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
                updatedAt: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
            };
            identifier: import("@aws-amplify/data-schema").ModelDefaultIdentifier;
            secondaryIndexes: [];
            authorization: [];
            disabledOperations: [];
        }, "secondaryIndexes", [{
            defaultQueryFieldSuffix: "UserIdAndStatus";
            queryField: never;
            pk: {
                userId: string;
            };
            sk: {
                status: "deferredRefResolving:PositionStatus";
            };
            compositeSk: never;
        }, {
            defaultQueryFieldSuffix: "AccountIdAndStatus";
            queryField: never;
            pk: {
                accountId: string;
            };
            sk: {
                status: "deferredRefResolving:PositionStatus";
            };
            compositeSk: never;
        }]>, "authorization", (Omit<import("@aws-amplify/data-schema").Authorization<"owner", "owner", false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
            identityClaim: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, property: string) => Omit<SELF, "identityClaim">;
        }, "to"> | Omit<import("@aws-amplify/data-schema").Authorization<"groups", undefined, false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
            withClaimIn: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, property: string) => Omit<SELF, "withClaimIn">;
        }, "to">)[]>, "secondaryIndexes" | "authorization">;
        Action: import("@aws-amplify/data-schema").ModelType<import("@aws-amplify/data-schema-types").SetTypeSubArg<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
            fields: {
                userId: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                accountId: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                positionId: import("@aws-amplify/data-schema").ModelField<string, "required", undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                triggerPositionId: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.String>;
                type: import("@aws-amplify/data-schema").RefType<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
                    type: "ref";
                    link: "ActionType";
                    valueRequired: false;
                    array: false;
                    arrayRequired: false;
                    authorization: [];
                }, "valueRequired", true>, "required", undefined>;
                status: import("@aws-amplify/data-schema").RefType<import("@aws-amplify/data-schema-types").SetTypeSubArg<{
                    type: "ref";
                    link: "ActionStatus";
                    valueRequired: false;
                    array: false;
                    arrayRequired: false;
                    authorization: [];
                }, "valueRequired", true>, "required", undefined>;
                account: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"Account", import("@aws-amplify/data-schema").ModelRelationshipTypes.belongsTo, false>, "Account", "required" | "valueRequired", undefined>;
                position: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"Position", import("@aws-amplify/data-schema").ModelRelationshipTypes.belongsTo, false>, "Position", "required" | "valueRequired", undefined>;
                triggerPosition: import("@aws-amplify/data-schema").ModelRelationshipField<import("@aws-amplify/data-schema").ModelRelationshipTypeArgFactory<"Position", import("@aws-amplify/data-schema").ModelRelationshipTypes.belongsTo, false>, "Position", "required" | "valueRequired", undefined>;
                createdAt: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
                updatedAt: import("@aws-amplify/data-schema").ModelField<import("@aws-amplify/data-schema").Nullable<string>, never, undefined, import("@aws-amplify/data-schema").ModelFieldType.DateTime>;
            };
            identifier: import("@aws-amplify/data-schema").ModelDefaultIdentifier;
            secondaryIndexes: [];
            authorization: [];
            disabledOperations: [];
        }, "secondaryIndexes", [{
            defaultQueryFieldSuffix: "UserIdAndStatus";
            queryField: never;
            pk: {
                userId: string;
            };
            sk: {
                status: "deferredRefResolving:ActionStatus";
            };
            compositeSk: never;
        }, {
            defaultQueryFieldSuffix: "AccountIdAndStatus";
            queryField: never;
            pk: {
                accountId: string;
            };
            sk: {
                status: "deferredRefResolving:ActionStatus";
            };
            compositeSk: never;
        }, {
            defaultQueryFieldSuffix: "PositionIdAndType";
            queryField: never;
            pk: {
                positionId: string;
            };
            sk: {
                type: "deferredRefResolving:ActionType";
            };
            compositeSk: never;
        }]>, "authorization", (Omit<import("@aws-amplify/data-schema").Authorization<"owner", "owner", false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
            identityClaim: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, property: string) => Omit<SELF, "identityClaim">;
        }, "to"> | Omit<import("@aws-amplify/data-schema").Authorization<"groups", undefined, false> & {
            to: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, operations: ("list" | "get" | "create" | "update" | "delete" | "read" | "sync" | "listen" | "search")[]) => Omit<SELF, "to">;
            withClaimIn: <SELF extends import("@aws-amplify/data-schema").Authorization<any, any, any>>(this: SELF, property: string) => Omit<SELF, "withClaimIn">;
        }, "to">)[]>, "secondaryIndexes" | "authorization">;
    };
    authorization: [];
    configuration: any;
}, "authorization", (import("@aws-amplify/data-schema").ResourceAuthorization & {
    to: <SELF extends import("@aws-amplify/data-schema").ResourceAuthorization>(this: SELF, operations: ("listen" | "query" | "mutate")[]) => Omit<SELF, "to">;
})[]>, "authorization">;
export type Schema = ClientSchema<typeof schema>;
export declare const data: import("@aws-amplify/plugin-types").ConstructFactory<import("@aws-amplify/graphql-api-construct").AmplifyGraphqlApi>;
export {};
