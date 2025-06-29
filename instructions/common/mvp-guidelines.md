# MVP ガイドライン
# ArbitrageAssistant MVP開発絶対遵守指針

## 🎯 MVP核心定義

### MVP（Minimum Viable Product）範囲
- **Position-Trail-Action システム**の完全実装
- **AWS Amplify Gen2 + GraphQL** Backend基盤
- **Tauri Hedge System** デスクトップアプリ
- **Next.js Admin** 管理画面
- **MT5 EA + WebSocket** 連携システム

### ❌ MVP範囲外（実装禁止）
- 高度な分析機能・レポート機能
- 複雑なUI/UXカスタマイゼーション
- 不要な抽象化・デザインパターン
- パフォーマンス最適化以外の最適化
- shadcn/ui コンポーネントの編集・カスタマイズ

## 📋 絶対遵守設計書

### 必須参照ドキュメント
- **`MVPシステム設計.md`** **【絶対遵守】**
- **`arbitrage-assistant.yaml`** 組織定義
- **`CLAUDE.md`** システム概要・品質基準

### 参照順序・重要度
1. **`MVPシステム設計.md`** - 最優先参照・完全遵守
2. **`arbitrage-assistant.yaml`** - 技術実装詳細
3. **`CLAUDE.md`** - 運用・品質ガイドライン

## 🚨 Over-Engineering 防止原則

### 絶対禁止パターン

#### 1. 不要な抽象化
```typescript
// ❌ 禁止: 過剰な抽象化
interface AbstractPositionExecutorFactory {
  createExecutor<T extends BaseExecutor>(): T;
}

// ✅ 許可: 直接的実装
class PositionExecutionManager {
  async executePosition(data: PositionCreateInput): Promise<Position> {
    // 直接実装
  }
}
```

#### 2. 過剰なデザインパターン
```typescript
// ❌ 禁止: 不要なStrategy Pattern
interface TrailStrategy {
  execute(condition: TrailCondition): boolean;
}
class BuyTrailStrategy implements TrailStrategy { }
class SellTrailStrategy implements TrailStrategy { }

// ✅ 許可: 直接的条件分岐
class TrailEngine {
  evaluateTrailCondition(condition: TrailCondition): boolean {
    if (condition.direction === 'BUY') {
      return (condition.bestPrice - condition.currentPrice) >= condition.trailWidth;
    } else {
      return (condition.currentPrice - condition.bestPrice) >= condition.trailWidth;
    }
  }
}
```

#### 3. 不要な設定・カスタマイゼーション
```typescript
// ❌ 禁止: 過剰な設定オプション
interface TrailEngineConfig {
  monitoringInterval: number;
  maxRetries: number;
  retryDelay: number;
  timeoutDuration: number;
  // ... 数十の設定項目
}

// ✅ 許可: 最小限設定
interface TrailEngineConfig {
  monitoringInterval: number; // 1000ms固定でも可
}
```

### 許可される実装パターン

#### 1. MVP必要機能の直接実装
```typescript
// ✅ Position状態遷移の直接実装
enum PositionStatus {
  PENDING = 'PENDING',
  OPENING = 'OPENING', 
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED'
}
```

#### 2. 単純・明確なクラス設計
```typescript
// ✅ 明確な責任分離
class PositionExecutionManager { }
class TrailEngine { }
class ActionSyncManager { }
```

#### 3. 必要最小限のエラーハンドリング
```typescript
// ✅ 基本的エラーハンドリング
try {
  await this.executePosition(data);
} catch (error) {
  console.error('Position execution failed:', error);
  throw error;
}
```

## 📊 品質基準・遵守事項

### コード品質基準

#### 1. TypeScript 厳密型定義
```typescript
// ✅ 厳密な型定義
interface Position {
  positionId: string;
  userId: string;
  status: PositionStatus;
  // 全フィールド必須定義
}

// ❌ any・unknown の使用
const data: any = {};
```

#### 2. ESLint --max-warnings 0
```typescript
// ✅ 警告ゼロ維持
// ❌ console.log 本番残留禁止
// ❌ unused variables 禁止
```

#### 3. shadcn/ui 標準使用
```tsx
// ✅ shadcn/ui 標準コンポーネント使用
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// ❌ shadcn/ui コンポーネント編集禁止
// packages/ui/src/components/ui/ 以下のファイル編集禁止
```

### テスト品質基準

#### 1. カバレッジ要件
- **全体カバレッジ**: >80%
- **Position-Trail-Action**: >95% （MVP核心）
- **GraphQL操作**: >90%
- **UI コンポーネント**: >85%

#### 2. 必須テストパターン
```typescript
// Position状態遷移テスト（必須）
describe('Position State Transition', () => {
  test('should transition PENDING -> OPENING -> OPEN', async () => {
    // テスト実装
  });
});

// Trail条件判定テスト（必須）
describe('Trail Condition Evaluation', () => {
  test('should trigger when trail width exceeded', async () => {
    // テスト実装
  });
});

// Action同期テスト（必須）
describe('Action Synchronization', () => {
  test('should sync action execution across systems', async () => {
    // テスト実装
  });
});
```

### パフォーマンス基準

#### 1. ビルド・起動時間
- **Turborepo ビルド**: <30秒
- **Tauri アプリ起動**: <5秒
- **Next.js 管理画面起動**: <3秒

#### 2. 実行時パフォーマンス
- **GraphQL Subscription応答**: <1秒
- **Trail監視間隔**: 1秒
- **Action実行完了**: <30秒

## 🔄 継続的品質管理

### 日次チェック項目

#### 1. コード品質チェック
```bash
# 毎日実行必須
npm run lint                    # ESLint --max-warnings 0
cd apps/hedge-system && npm run check-types  # TypeScript
cd apps/admin && npm run check-types         # TypeScript
npm run build                   # ビルド成功確認
npm run test                    # 全テスト成功確認
```

#### 2. MVP準拠チェック
```bash
# MVPシステム設計.md との整合性確認
# 不要機能追加の検出
# Over-Engineering パターン検出
```

#### 3. ファイル変更監視
```bash
# 編集禁止ファイルの変更検出
# packages/ui/src/components/ui/**/* 
# shadcn/ui コンポーネント保護
```

### 週次レビュー項目

#### 1. アーキテクチャレビュー
- MVP設計書との整合性確認
- Over-Engineering 検出・修正
- 不要な複雑性の排除

#### 2. パフォーマンスレビュー
- ビルド時間測定・最適化
- テスト実行時間測定
- アプリケーション応答時間測定

#### 3. 品質メトリクス確認
- テストカバレッジ測定
- ESLint警告数確認
- TypeScriptエラー数確認

## 💡 実装ガイドライン詳細

### ファイル構造・命名規則

#### 1. ファイル配置
```
apps/hedge-system/lib/
├── position-execution.ts      # Position実行システム
├── trail-engine.ts           # Trail監視システム
├── action-sync.ts            # Action同期システム
├── types.ts                  # 型定義
└── websocket-server.ts       # WebSocket通信
```

#### 2. 命名規則
```typescript
// クラス名: PascalCase
class PositionExecutionManager { }

// 関数名: camelCase
async executePosition() { }

// 定数: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;

// 型・インターフェース: PascalCase
interface Position { }
enum PositionStatus { }
```

### GraphQL・Database 設計

#### 1. GraphQL Schema パターン
```graphql
# 最小限・明確なSchema定義
type Position {
  positionId: ID!
  userId: ID!
  status: PositionStatus!
  # 必要最小限フィールド
}

enum PositionStatus {
  PENDING
  OPENING
  OPEN
  CLOSING
  CLOSED
}
```

#### 2. DynamoDB 設計
```typescript
// シンプル・効率的テーブル設計
User: userId (PK)
Account: accountId (PK), userId (GSI)
Position: positionId (PK), accountId (GSI)
Action: actionId (PK), positionId (GSI)
```

### エラーハンドリング・ログ

#### 1. エラーハンドリングパターン
```typescript
// 基本的・統一的エラーハンドリング
try {
  await this.executeOperation();
} catch (error) {
  console.error(`Operation failed: ${error.message}`);
  
  // 必要に応じて上位に伝播
  throw new Error(`Execution failed: ${error.message}`);
}
```

#### 2. ログ出力パターン
```typescript
// 開発時のみ詳細ログ
if (process.env.NODE_ENV === 'development') {
  console.log('Position execution started:', positionId);
}

// 本番環境でのエラーログのみ
console.error('Critical error:', error);
```

---

**MVP ガイドライン は ArbitrageAssistant 開発の絶対基準であり、Over-Engineering 防止・品質保証・設計書遵守の指針として全エージェントが遵守する。**