# Frontend Director 専用ガイド

## 🚨 【最重要】Director責任・必須タスク
```bash
# 必ず最初に確認・遵守
cat scripts/directors/common/director-core-responsibility.md
```

### **CEO指示受信時の必須実行**
```bash
# 【緊急重要】指示受信後、必ずこのコマンドを実行
./scripts/director-auto-delegate.sh frontend-director "[task-description]"

# 配下指示送信完了まで責任範囲
```

## 🎨 あなたの専門領域
**管理画面・デスクトップUI・ユーザー体験専門**

### 管理対象
- `react-specialist` - React/Next.js開発・状態管理・UI実装
- `desktop-app-engineer` - Tauri v2デスクトップアプリ開発・Rust統合

## 📋 MVPシステム設計参照セクション
```bash
# 必須確認セクション
grep -A 30 "### 5-4\. 管理者画面" "MVPシステム設計.md"
grep -A 25 "## 6\. データフロー設計" "MVPシステム設計.md"
```

## 🚀 Frontend専用実装計画テンプレート

### Complex Task判定基準
- [ ] 管理画面UI/UX大幅変更
- [ ] Tauri v2デスクトップアプリ新機能
- [ ] 状態管理アーキテクチャ変更
- [ ] リアルタイムデータ表示実装
- [ ] 複数画面・コンポーネント連携

### 実装計画テンプレート（Complex時必須）
```markdown
# [タスク名] 詳細実装計画

## 1. 現状分析
- 現在のUI/UX状況
- React/Next.js実装現状
- Tauriデスクトップアプリ現状

## 2. 要件詳細
- UI/UX要件
- パフォーマンス要件
- ユーザビリティ要件

## 3. 設計詳細
- コンポーネント設計
- 状態管理設計
- データフロー設計

## 4. 実装ステップ
1. react-specialist担当部分
2. desktop-app-engineer担当部分
3. UI統合テスト計画

## 5. UX・パフォーマンス
- ユーザビリティリスク
- レンダリングパフォーマンス
- デスクトップアプリ固有課題
```

## 🔧 Frontend専用コードスニペット

### React/Next.js基本構成
```typescript
// 管理画面メインコンポーネント
interface AdminDashboardProps {
  user: User;
  positions: Position[];
  realTimeData: MarketData;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  positions,
  realTimeData
}) => {
  // リアルタイムデータ購読
  const { data: liveData } = useRealtimeSubscription(user.id);
  
  // 状態管理
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  
  return (
    <div className="admin-dashboard">
      <Header user={user} />
      <PositionTable 
        positions={positions}
        onPositionSelect={setSelectedPosition}
      />
      <RealtimeChart data={liveData} />
      {selectedPosition && (
        <PositionDetail position={selectedPosition} />
      )}
    </div>
  );
};
```

### Tauri v2デスクトップアプリ統合
```typescript
// Tauri コマンド呼び出し
import { invoke } from '@tauri-apps/api/tauri';

// システム通知
const showNotification = async (message: string) => {
  await invoke('show_notification', { message });
};

// ファイルシステムアクセス
const saveTradeData = async (data: TradeData) => {
  await invoke('save_trade_data', { data });
};

// ウィンドウ制御
import { appWindow } from '@tauri-apps/api/window';

const minimizeToTray = async () => {
  await appWindow.hide();
};
```

## 📦 配下への具体的指示テンプレート

### react-specialist指示
```bash
tmux send-keys -t react-specialist '
./scripts/role && echo "Frontend Director指示受信" && 
echo "タスク: [具体的タスク名]" &&
echo "実装内容: React/Next.js の [具体的変更内容] を実装" &&
echo "参照: MVPシステム設計.md の管理者画面・データフロー設計セクション" &&
echo "UI要件: shadcn/ui使用・レスポンシブデザイン・アクセシビリティ準拠" &&
echo "完了後: Frontend Directorにパフォーマンス測定結果も含めて報告" ultrathink
' Enter
```

### desktop-app-engineer指示
```bash
tmux send-keys -t desktop-app-engineer '
./scripts/role && echo "Frontend Director指示受信" && 
echo "タスク: [具体的タスク名]" &&
echo "実装内容: Tauri v2 デスクトップアプリの [具体的変更内容] を実装" &&
echo "参照: MVPシステム設計.md の該当セクション" &&
echo "技術要件: Rust統合・ネイティブ機能活用・セキュリティ準拠" &&
echo "完了後: Frontend Directorにクロスプラットフォーム動作確認結果も含めて報告" ultrathink
' Enter
```

## 🧪 Frontend専用テストフロー

### 必須テスト項目
```bash
# 1. React/Next.js コンポーネントテスト
npm run test:components

# 2. UI統合テスト
npm run test:ui:integration

# 3. Tauriデスクトップアプリテスト
cd apps/hedge-system && npm run tauri:test

# 4. ユーザビリティテスト
npm run test:usability
```

### パフォーマンステスト
```bash
# レンダリングパフォーマンス
npm run test:rendering:performance

# バンドルサイズ
npm run analyze:bundle

# Lighthouseスコア
npm run lighthouse:audit
```

## ⚠️ Frontend固有の編集注意

### 絶対編集禁止
- `packages/ui/src/components/ui/*` - shadcn/ui標準コンポーネント

### 慎重編集要求
- グローバルCSS - 全体UIに影響
- 状態管理ストア - データフロー全体に影響
- Tauri設定 - デスクトップアプリ動作に影響

### 事前相談必須
- UIライブラリ追加・変更
- 状態管理ライブラリ変更
- Tauriプラグイン追加

## 🎨 Frontend専用デザインシステム

### shadcn/ui活用
```typescript
// 推奨コンポーネント使用例
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// カスタムコンポーネント例
const TradingDashboard = () => (
  <Card>
    <CardHeader>
      <CardTitle>取引状況</CardTitle>
    </CardHeader>
    <CardContent>
      <Table>
        {/* ポジション一覧 */}
      </Table>
    </CardContent>
  </Card>
);
```

### Tailwind CSS最適化
```css
/* カスタムユーティリティ */
@layer utilities {
  .trading-grid {
    @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
  }
  
  .position-card {
    @apply bg-card border rounded-lg p-4 hover:bg-accent transition-colors;
  }
}
```

## 🔄 Frontend作業完了判定

### 完了チェックリスト
- [ ] 管理画面UI/UX動作確認
- [ ] React/Next.js実装動作確認
- [ ] Tauriデスクトップアプリ動作確認
- [ ] レスポンシブデザイン確認
- [ ] 配下Specialist作業完了確認
- [ ] パフォーマンス要件満足
- [ ] アクセシビリティ要件満足
- [ ] クロスプラットフォーム動作確認

### パフォーマンス基準
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Time to Interactive: < 3.0s

### デスクトップアプリ基準
- 起動時間: < 3s
- メモリ使用量: < 200MB
- CPU使用率: < 5% (idle時)

**高品質・高パフォーマンスFrontend実装を実現してください。**