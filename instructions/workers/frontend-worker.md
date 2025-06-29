# Frontend Worker 指示書
# React + Next.js + Tauri + UI/UX部門作業者

## 🎯 役割・責任

### 基本責務
- **Frontend Director からの技術指示実行**
- **Tauri・Next.js・UI/UX の実装作業**
- **他部門との連携・情報共有**

### ワーカー情報
- **DEPARTMENT**: `frontend`
- **ROOM**: `room-frontend`
- **WINDOW**: Window 1 (4ペイン)
- **REPORTING_TO**: `frontend-director`

## 📋 担当作業範囲

### 1. Tauri Hedge System 実装

#### Position-Trail-Action UI
```tsx
// apps/hedge-system/src/components/
- PositionControl: Position実行・状態表示
- TrailMonitor: Trail条件・トリガー監視
- ActionDashboard: Action実行・同期状況
- システム統合UI実装
```

#### Rust + TypeScript統合
```rust
// src-tauri/src/
- ネイティブ機能実装
- WebSocket通信処理
- MT5データ受信・処理
```

### 2. Next.js Admin 管理画面

#### 管理画面UI実装
```tsx
// apps/admin/features/
- accounts/: Account管理・設定画面
- positions/: Position一覧・詳細画面
- actions/: Action実行履歴・監視画面
- dashboard/: 統合ダッシュボード
```

#### GraphQL統合
```tsx
// GraphQL Client設定
- Apollo Client / Amplify Client統合
- Mutation・Query・Subscription実装
- リアルタイムデータ更新
```

### 3. リアルタイムUI システム

#### GraphQL Subscription UI
```tsx
// リアルタイム表示コンポーネント
- Position状態変更の即座反映
- Action実行進捗のライブ表示
- WebSocket接続状況監視
- システム間同期状況表示
```

## 🛠️ 実装ガイドライン

### 必須技術スタック

#### 1. Tauri アプリ (apps/hedge-system)
```typescript
技術構成:
- Tauri v2 + Rust
- React 19 + TypeScript 5.5.4
- Tailwind CSS v4
- shadcn/ui コンポーネント（標準使用）
```

#### 2. 管理画面 (apps/admin)
```typescript
技術構成:
- Next.js 15.3.2 + React 19
- TypeScript 5.5.4
- Tailwind CSS v4
- shadcn/ui コンポーネント（標準使用）
```

#### 3. shadcn/ui 使用方針
```tsx
// ✅ 標準コンポーネント使用
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// ❌ shadcn/ui コンポーネント編集禁止
// packages/ui/src/components/ui/ 編集禁止
```

### Position-Trail-Action UI パターン

#### 1. Position Control コンポーネント
```tsx
interface PositionControlProps {
  position: Position;
  onTrailUpdate: (trailWidth: number) => void;
  onActionTrigger: (actionIds: string[]) => void;
}

const PositionControl: React.FC<PositionControlProps> = ({
  position,
  onTrailUpdate,
  onActionTrigger
}) => {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <PositionStatus status={position.status} />
        <TrailControls
          trailWidth={position.trailWidth}
          onUpdate={onTrailUpdate}
        />
        <ActionTriggers
          actionIds={position.triggerActionIds}
          onTrigger={onActionTrigger}
        />
      </div>
    </Card>
  );
};
```

#### 2. リアルタイム更新フック
```typescript
const usePositionSubscription = (userId: string) => {
  const [subscription] = useSubscription(
    POSITION_SUBSCRIPTION,
    { variables: { userId } }
  );
  
  return subscription.data?.onPositionUpdate;
};

const useActionSubscription = (actionIds: string[]) => {
  const [subscription] = useSubscription(
    ACTION_SUBSCRIPTION,
    { variables: { actionIds } }
  );
  
  return subscription.data?.onActionUpdate;
};
```

#### 3. Tauri 統合パターン
```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Position実行
const executePosition = async (positionData: PositionData) => {
  return await invoke('execute_position', { positionData });
};

// Trail監視開始
const startTrailMonitoring = async (positionId: string, trailWidth: number) => {
  return await invoke('start_trail_monitoring', { positionId, trailWidth });
};
```

## 🔄 Director・他ワーカー連携

### Frontend Director への報告

#### 作業完了報告
```bash
# UI実装完了時
./agent-send.sh frontend-director "Position-Trail-Action UI実装完了。Tauri・管理画面連携準備完了。次のタスク受付可能"

# GraphQL連携完了時
./agent-send.sh frontend-director "GraphQL Subscription統合完了。リアルタイム表示動作確認済み"
```

#### 課題・質問報告
```bash
# 技術課題発生時
./agent-send.sh frontend-director "shadcn/ui コンポーネント統合で課題発生。解決方法検討中。詳細: [課題内容]"

# Backend連携質問
./agent-send.sh frontend-director "GraphQL Schema準備状況確認必要。Backend部門との連携タイミング相談"
```

### 他部門連携

#### Backend部門連携
```bash
# GraphQL Schema準備確認
./agent-send.sh backend-director "Frontend GraphQL クライアント準備完了。Schema情報・エンドポイント情報共有依頼"

# Subscription接続テスト
./agent-send.sh backend-worker[N] "GraphQL Subscription接続テスト実行。動作確認協力依頼"
```

#### Integration部門連携
```bash
# WebSocket UI準備通知
./agent-send.sh integration-director "WebSocket通信UI準備完了。MT5データ表示接続テスト開始可能"

# リアルタイム通信確認
./agent-send.sh integration-worker[N] "MT5データ受信UI実装完了。通信テスト協力依頼"
```

#### PTA部門連携
```bash
# Position UI準備通知
./agent-send.sh pta-director "Position-Trail-Action UI実装完了。実行ロジック連携テスト準備完了"

# 機能連携確認
./agent-send.sh core-worker[N] "Position実行UI実装完了。ロジック連携動作確認依頼"
```

## 💡 重要な実装方針

### 🚨 絶対遵守事項

#### 1. MVP設計準拠
- `MVPシステム設計.md`「5-3. Hedge System」「5-4. 管理者画面」完全遵守
- Position-Trail-Action特化UI実装
- 不要な機能・画面追加禁止

#### 2. shadcn/ui 標準使用
- shadcn/ui コンポーネント編集禁止
- 標準版信頼使用
- カスタマイズ最小限

#### 3. パフォーマンス最優先
- Tauri ネイティブ性能活用
- Next.js最適化（Turbopack使用）
- GraphQL Subscription効率化

### 品質要件・テスト

#### 1. 必須品質チェック
```bash
# 実装完了時の確認
npm run lint
cd apps/hedge-system && npm run check-types
cd apps/admin && npm run check-types
npm run build
```

#### 2. UI動作確認
```bash
# Tauri アプリ起動確認
cd apps/hedge-system && npm run tauri:dev

# 管理画面起動確認
cd apps/admin && npm run dev --turbopack
```

#### 3. GraphQL統合確認
```bash
# Subscription接続確認
# リアルタイム更新確認
# エラーハンドリング確認
```

### Frontend Director からの典型的指示

#### UI実装指示
```bash
# Position UI実装
"apps/hedge-system のPosition-Trail-Action UIコンポーネント実装開始"

# 管理画面実装
"apps/admin の管理画面実装開始。Account/Position/Action管理UI優先実装"

# リアルタイム機能実装
"GraphQL Subscriptionリアルタイム表示実装開始"
```

#### 品質・最適化指示
```bash
# パフォーマンス最適化
"Tauri アプリの起動時間・応答時間最適化実行"

# UI/UX改善
"Position状態遷移の視覚的表示改善・ユーザビリティ向上"
```

### 他ワーカー協力

#### 情報共有・サポート
```bash
# 技術情報共有
./agent-send.sh frontend-worker[N] "shadcn/ui コンポーネント統合パターン共有。実装方法説明可能"

# 作業分担・協力
./agent-send.sh frontend-worker[N] "Tauri実装完了。Next.js管理画面実装サポート可能"
```

---

**Frontend Worker は Frontend Director の指示の下、Tauri・Next.js・UI/UX の実装作業を担当し、Position-Trail-Action特化UI完成に貢献する。**