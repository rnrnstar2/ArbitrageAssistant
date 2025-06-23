import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { postConfirmation } from '../auth/post-confirmation/resource';

const schema = a.schema({
  // ===== ENUMS (列挙型) =====
  Symbol: a.enum([
    'USDJPY',
    'EURUSD',
    'EURGBP',
    'XAUUSD'
  ]),
  PositionStatus: a.enum([
    'PENDING',    // エントリー指令済みで約定待ち
    'OPENING',    // エントリー実行中（MT4/MT5で約定処理中）
    'OPEN',       // エントリー約定済み・ポジション保有中
    'CLOSING',    // 決済指令済みでクローズ処理中
    'CLOSED',     // ポジション決済済み（利益確定または手仕舞い完了）
    'STOPPED',    // ロスカット執行済み（損切りで強制終了）
    'CANCELED'    // 発注失敗等でポジション成立しなかった場合
  ]),
  ActionType: a.enum([
    'ENTRY',        // 新規エントリー
    'CLOSE'         // 通常クローズ
  ]),
  ActionStatus: a.enum([
    'PENDING',   // アクション待機中
    'EXECUTING', // 実行中
    'EXECUTED',  // 実行完了
    'FAILED'     // 実行失敗
  ]),
  UserRole: a.enum(['CLIENT', 'ADMIN']),
  PCStatus: a.enum(['ONLINE', 'OFFLINE']),

  // ===== MODELS (モデル) =====
  User: a.model({
    email: a.string().required(),       // ユーザーのメールアドレス（認証用）
    name: a.string().required(),        // ユーザー表示名
    role: a.ref('UserRole').required(), // ユーザー権限（CLIENT/ADMIN）
    pcStatus: a.ref('PCStatus'),        // PC接続状態（ONLINE/OFFLINE）
    isActive: a.boolean().required(),   // アカウント有効性フラグ
    accounts: a.hasMany('Account', 'userId'), // 所有する口座一覧
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
    .authorization(allow => [
      allow.owner().to(['read', 'update']),
      allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
      allow.authenticated().to(['create'])
    ]),

  Account: a.model({
    userId: a.string().required(),                    // 所有者ユーザーID（User外部キー）
    brokerType: a.string().required(),                // ブローカー種別（MT4/MT5）
    accountNumber: a.string().required(),             // 口座番号
    serverName: a.string().required(),                // サーバー名
    displayName: a.string().required(),               // 表示名
    balance: a.float(),                               // 残高
    equity: a.float(),                                // 有効証拠金
    margin: a.float(),                                // 使用証拠金
    freeMargin: a.float(),                            // 余剰証拠金
    marginLevel: a.float(),                           // 証拠金維持率
    pcId: a.string(),                                 // 接続PC識別子
    isActive: a.boolean().default(true),              // 有効/無効フラグ
    lastUpdated: a.datetime(),                        // 最終更新日時
    connectionStatus: a.string().default('OFFLINE'),  // 接続状態
    user: a.belongsTo('User', 'userId'),              // ユーザーリレーション
    positions: a.hasMany('Position', 'accountId'),    // ポジション一覧
    actions: a.hasMany('Action', 'accountId'),        // アクション履歴
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
    .authorization(allow => [
      allow.owner().to(['create', 'read', 'update', 'delete']),
      allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['operator']).to(['read', 'update']),
      allow.groups(['viewer']).to(['read'])
    ]),

  Position: a.model({
    accountId: a.string().required(),               // 口座ID（Account外部キー - 必須）
    strategyId: a.string(),                         // 戦略ID（Strategy外部キー - Optional）
    status: a.ref('PositionStatus').required(),     // ポジション状態（PENDING/OPEN/CLOSING等）
    symbol: a.ref('Symbol').required(),             // 取引銘柄（USDJPY/EURUSD等）
    volume: a.float().required(),                   // 取引数量（ロット数）
    direction: a.string().required(),               // 売買方向（BUY/SELL）
    ticket: a.string(),                             // MT4/MT5チケット番号
    entryPrice: a.float(),                          // エントリー価格（約定価格）
    entryTime: a.datetime(),                        // エントリー時刻（約定時刻）
    exitPrice: a.float(),                           // 決済価格（クローズ約定価格）
    exitTime: a.datetime(),                         // 決済時刻（クローズ約定時刻）
    exitReason: a.string(),                         // 決済理由（利確/損切り/手動等）
    trailWidth: a.float(),                          // 個別トレーリング幅（pips）
    stopLoss: a.float(),                            // ストップロス価格
    takeProfit: a.float(),                          // テイクプロフィット価格
    currentPrice: a.float(),                        // 現在価格
    primary: a.boolean().default(false),            // 主要ポジションフラグ
    unrealizedPnL: a.float(),                       // 未実現損益
    realizedPnL: a.float(),                         // 実現損益
    commission: a.float(),                          // 手数料
    swap: a.float(),                                // スワップポイント
    account: a.belongsTo('Account', 'accountId'),   // 口座リレーション
    strategy: a.belongsTo('Strategy', 'strategyId'), // 戦略リレーション
    actions: a.hasMany('Action', 'positionId'),     // アクション履歴リレーション
    triggerActions: a.hasMany('Action', 'triggerPositionId'), // トリガー元として関連するアクション
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
    .authorization(allow => [
      allow.owner().to(['create', 'read', 'update', 'delete']),
      allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['operator']).to(['read', 'update']),
      allow.groups(['viewer']).to(['read'])
    ]),

  Action: a.model({
    accountId: a.string().required(),                // 口座ID（Account外部キー - 必須）
    strategyId: a.string(),                          // 戦略ID（Strategy外部キー - Optional）
    positionId: a.string().required(),               // ポジションID（Position外部キー - 必須）
    triggerPositionId: a.string(),                   // トリガー元ポジションID（Optional）
    type: a.ref('ActionType').required(),            // アクション種別（ENTRY/CLOSE）
    status: a.ref('ActionStatus').required(),        // 実行状態（PENDING/EXECUTING/EXECUTED/FAILED）
    triggerType: a.string().required(),              // トリガー種別（STRATEGY/POSITION/MANUAL）
    targetPCId: a.string(),                          // 実行PC指定（Optional）
    trailWidth: a.float(),                           // エントリー時設定トレール幅（pips）
    executedAt: a.datetime(),                        // 実行日時
    errorMessage: a.string(),                        // エラーメッセージ（失敗時）
    retryCount: a.integer().default(0),              // リトライ回数
    maxRetries: a.integer().default(3),              // 最大リトライ回数
    parameters: a.json(),                            // アクションパラメータ（JSON形式）
    result: a.json(),                                // 実行結果（JSON形式）
    account: a.belongsTo('Account', 'accountId'),    // 口座リレーション
    strategy: a.belongsTo('Strategy', 'strategyId'), // 戦略リレーション
    position: a.belongsTo('Position', 'positionId'), // ポジションリレーション
    triggerPosition: a.belongsTo('Position', 'triggerPositionId'), // トリガー元ポジションリレーション
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
    .authorization(allow => [
      allow.owner().to(['create', 'read', 'update', 'delete']),
      allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['operator']).to(['read', 'update']),
      allow.groups(['viewer']).to(['read'])
    ]),

  Strategy: a.model({
    name: a.string().required(),                      // 戦略名
    description: a.string(),                          // 戦略説明
    trailWidth: a.float(),                            // トレーリング戦略の基本幅（pips）- 決済戦略用
    symbol: a.ref('Symbol'),                          // 対象銘柄（Optional、ALL戦略の場合null）
    type: a.string().required(),                      // 戦略種別（ENTRY/EXIT/HEDGE/REBALANCE）
    status: a.string().required(),                    // 戦略状態（PREPARED/EXECUTING/EXECUTED/COMPLETED/FAILED）
    priority: a.integer().default(0),                 // 実行優先度（0が最高）
    conditions: a.json(),                             // 実行条件（JSON形式）
    parameters: a.json(),                             // 戦略パラメータ（JSON形式）
    executedAt: a.datetime(),                         // 実行日時
    completedAt: a.datetime(),                        // 完了日時
    isActive: a.boolean().default(true),              // アクティブフラグ
    positions: a.hasMany('Position', 'strategyId'),   // 配下ポジション一覧
    actions: a.hasMany('Action', 'strategyId'),       // 配下アクション一覧
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
    .authorization(allow => [
      allow.owner().to(['create', 'read', 'update', 'delete']),
      allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['operator']).to(['read', 'update']),
      allow.groups(['viewer']).to(['read'])
    ]),

  // ===== MONITORING & SYSTEM MODELS =====
  SystemStatus: a.model({
    pcId: a.string().required(),                      // PC識別ID
    userId: a.string().required(),                    // ユーザーID
    status: a.ref('PCStatus').required(),             // PC状態（ONLINE/OFFLINE）
    lastHeartbeat: a.datetime().required(),           // 最終生存確認時刻
    version: a.string(),                              // システムバージョン
    metadata: a.json(),                               // 追加メタデータ
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
    .authorization(allow => [
      allow.owner().to(['create', 'read', 'update', 'delete']),
      allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['operator']).to(['read', 'update']),
      allow.groups(['viewer']).to(['read'])
    ]),

  MarketData: a.model({
    symbol: a.ref('Symbol').required(),               // 銘柄
    bid: a.float().required(),                        // 売値
    ask: a.float().required(),                        // 買値
    spread: a.float().required(),                     // スプレッド
    timestamp: a.datetime().required(),               // データ取得時刻
    source: a.string().required(),                    // データソース
    metadata: a.json(),                               // 追加メタデータ
    createdAt: a.datetime(),
  })
    .authorization(allow => [
      allow.authenticated().to(['create', 'read']),
      allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['operator']).to(['create', 'read']),
      allow.groups(['viewer']).to(['read'])
    ]),

  Alert: a.model({
    type: a.string().required(),                      // アラート種別
    level: a.string().required(),                     // レベル（INFO/WARNING/ERROR/CRITICAL）
    title: a.string().required(),                     // タイトル
    message: a.string().required(),                   // メッセージ
    source: a.string().required(),                    // 発生源
    isRead: a.boolean().default(false),               // 既読フラグ
    isResolved: a.boolean().default(false),           // 解決済みフラグ
    metadata: a.json(),                               // 追加メタデータ
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
    .authorization(allow => [
      allow.authenticated().to(['create', 'read', 'update']),
      allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['operator']).to(['create', 'read', 'update']),
      allow.groups(['viewer']).to(['read'])
    ]),

})
  .authorization((allow) => [allow.resource(postConfirmation)]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
