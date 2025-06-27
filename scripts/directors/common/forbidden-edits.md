# 編集禁止ファイルリスト - 厳格遵守

## 🚨 絶対編集禁止（触れてはいけない）

### shadcn/ui標準コンポーネント
```
packages/ui/src/components/ui/
├── button.tsx           # 標準版信頼・編集禁止
├── card.tsx             # 標準版信頼・編集禁止
├── input.tsx            # 標準版信頼・編集禁止
├── table.tsx            # 標準版信頼・編集禁止
├── dialog.tsx           # 標準版信頼・編集禁止
├── dropdown-menu.tsx    # 標準版信頼・編集禁止
├── form.tsx             # 標準版信頼・編集禁止
├── label.tsx            # 標準版信頼・編集禁止
├── select.tsx           # 標準版信頼・編集禁止
├── textarea.tsx         # 標準版信頼・編集禁止
├── toast.tsx            # 標準版信頼・編集禁止
└── tooltip.tsx          # 標準版信頼・編集禁止
```

### 外部依存関係
```
node_modules/            # 外部ライブラリ・編集禁止
```

### Git管理ファイル
```
.git/                    # Git内部ファイル・編集禁止
.gitignore              # 管理済み・慎重編集
```

### ビルド生成物
```
dist/                    # ビルド生成・編集禁止
build/                   # ビルド生成・編集禁止
.next/                   # Next.js生成・編集禁止
target/                  # Rust生成・編集禁止
```

### GraphQL生成ファイル
```
packages/shared-backend/src/graphql/generated/    # 自動生成・編集禁止
apps/*/src/graphql/generated/                     # 自動生成・編集禁止
```

## ⚠️ 慎重編集要求（事前確認必須）

### 設定ファイル（全体影響）
```
package.json             # 依存関係変更時は事前相談
tsconfig.json           # TypeScript設定変更時は事前相談
tailwind.config.*       # スタイル全体影響時は事前相談
turbo.json              # ビルド全体影響時は事前相談
```

### AWS・インフラ設定
```
packages/shared-backend/amplify/data/resource.ts     # スキーマ変更時は影響範囲確認
packages/shared-backend/amplify/auth/resource.ts     # 認証設定変更時は全体影響確認
packages/shared-backend/amplify/backend.ts           # バックエンド設定変更時は事前相談
```

### Tauri設定
```
apps/hedge-system/src-tauri/tauri.conf.json          # デスクトップアプリ動作に影響
apps/hedge-system/src-tauri/Cargo.toml               # Rust依存関係変更時は事前相談
```

### CI/CD設定
```
.github/workflows/       # CI/CD全体に影響・事前相談必須
```

## 📋 編集前確認フロー

### 1. 編集対象ファイル確認
```bash
# 編集禁止チェック
./scripts/check-edit-forbidden.sh [ファイルパス]
```

### 2. 影響範囲分析
```bash
# 依存関係確認
npm run analyze:dependencies [ファイルパス]

# 影響範囲確認
npm run analyze:impact [ファイルパス]
```

### 3. 事前相談手順
```
1. 編集理由・目的を明確化
2. 影響範囲を分析・文書化
3. 上位層（Director/CEO）に相談
4. 承認後に慎重編集実行
5. 編集後テスト・検証実行
```

## 🔒 編集権限マトリックス

| ファイルタイプ | CEO | Director | Specialist | 編集条件 |
|---------------|-----|----------|------------|---------|
| shadcn/ui | ❌ | ❌ | ❌ | 編集禁止 |
| 設定ファイル | ✅ | ⚠️ | ❌ | 事前相談 |
| 実装ファイル | ✅ | ✅ | ✅ | 専門領域内 |
| テストファイル | ✅ | ✅ | ✅ | 専門領域内 |
| ドキュメント | ✅ | ✅ | ⚠️ | 担当領域内 |

## 📝 編集記録・追跡

### 重要変更の記録
```bash
# 変更記録作成
echo "$(date): [Agent ID] - [ファイル] - [変更理由]" >> changes.log
```

### 変更影響の監視
```bash
# 変更後の影響確認
npm run lint                    # コード品質確認
npm run type-check             # 型整合性確認
npm run test                   # 機能動作確認
npm run build                  # ビルド確認
```

## 🚨 違反時の対処

### 編集禁止違反時
1. 即座に変更を元に戻す
2. 上位層に報告
3. 影響範囲を確認
4. 必要に応じて全体テスト実行

### 慎重編集違反時
1. 変更を一時停止
2. 影響範囲を分析
3. 上位層に相談
4. 承認後に継続 or 元に戻す

**この編集ルールを厳格に遵守してください。違反は品質・安定性・セキュリティに直結します。**