# 🎯 ArbitrageAssistant MVP開発 タスク実行手順

## 📋 実行概要

**Haconiwa 6x3 Grid構成**に基づく5部門Director並列開発システム

- **組織構成**: CEO → 5 Directors → 18 Specialists
- **実行方式**: タスクファイル分割による順次実行
- **品質基準**: ESLint 0 warnings, TypeScript 0 errors, Build Success

---

## 🚀 実行フェーズ

### **フェーズ1: 基盤構築（直列実行推奨）**

#### 1️⃣ Backend Director（最優先）
```bash
# AWS Amplify Gen2 + GraphQL + DynamoDB
claude "tasks/director-backend.md を実行して。完了後このファイルを削除"
```
**依存関係**: なし  
**所要時間**: 約30分  
**完了条件**: `packages/shared-backend/amplify/data/resource.ts` GraphQLスキーマ完成

#### 2️⃣ Trading Director（Backend完了後）
```bash
# TypeScript + Tauri 金融計算ロジック
claude "tasks/director-trading.md を実行して。完了後このファイルを削除"
```
**依存関係**: Backend GraphQL API  
**所要時間**: 約45分  
**完了条件**: `apps/hedge-system/lib/` 金融計算エンジン完成

---

### **フェーズ2: 統合・UI構築（並列実行可能）**

#### 3️⃣ Integration Director
```bash
# MQL5 + C++ WebSocket + MT5統合
claude "tasks/director-integration.md を実行して。完了後このファイルを削除"
```
**依存関係**: Trading Engine連携  
**所要時間**: 約60分  
**完了条件**: `ea/HedgeSystemConnector.mq5` + WebSocket統合完成

#### 4️⃣ Frontend Director  
```bash
# Next.js + React + Tailwind CSS
claude "tasks/director-frontend.md を実行して。完了後このファイルを削除"
```
**依存関係**: Backend GraphQL API  
**所要時間**: 約40分  
**完了条件**: `apps/admin/` + `apps/hedge-system/` UI完成

---

### **フェーズ3: 品質・DevOps（最終段階）**

#### 5️⃣ DevOps Director（全完了後）
```bash
# Turborepo + CI/CD + Vitest + 品質チェック
claude "tasks/director-devops.md を実行して。完了後このファイルを削除"
```
**依存関係**: 全部門実装完了  
**所要時間**: 約20分  
**完了条件**: CI/CD + テスト + ビルド最適化完成

---

## ✅ 品質チェック（各Director完了後必須）

### **各Director実行後チェック**
```bash
# 1. Lint・型チェック
npm run lint
cd apps/hedge-system && npm run check-types  
cd apps/admin && npm run check-types

# 2. ビルド確認
npm run build

# 3. テスト実行
npm run test

# 期待結果: 全てエラー0件
```

### **エラー発生時の対処**
```bash
# 型エラー修正指示例
"[Director名]: 以下の型エラーを修正してください：
[エラー内容をコピペ]"

# ビルドエラー調査指示例  
"DevOps Director: 以下のビルドエラーを調査・修正してください：
[エラー内容をコピペ]"
```

---

## 📊 進捗追跡チェックリスト

### **実装完了チェック**
- [ ] **Backend**: `packages/shared-backend/amplify/data/resource.ts` GraphQLスキーマ
- [ ] **Trading**: `apps/hedge-system/lib/hedge-system-core.ts` 金融計算エンジン
- [ ] **Integration**: `ea/HedgeSystemConnector.mq5` + WebSocket統合
- [ ] **Frontend**: `apps/admin/` + `apps/hedge-system/` UI実装
- [ ] **DevOps**: CI/CD + テスト + ビルド最適化

### **品質チェック完了**
- [ ] ESLint: 0 warnings
- [ ] TypeScript: 0 errors  
- [ ] Build: Success
- [ ] Tests: Pass
- [ ] MVP機能動作確認

---

## 🚨 緊急時・課題対応

### **技術課題エスカレーション**
```markdown
"Human CEO へ報告:

[Director名] で以下の課題が発生：
- 課題内容: [具体的な技術的課題]
- 影響度: [High/Medium/Low]
- 提案解決策: [解決方法]
- 必要判断: [CEO判断が必要な内容]"
```

### **優先順位変更**
**課題発生時の柔軟対応**:
1. **Backend + Trading**: 必須（金融計算コア）
2. **Integration**: 重要（MT5連携）
3. **Frontend**: 中程度（UI/UX）
4. **DevOps**: 最低限（品質保証）

---

## 🎉 MVP完成・リリース手順

### **全Director完了後**
```bash
# 1. 最終品質チェック
npm run lint
npm run test  
npm run build

# 2. MVP機能確認
# - GraphQL API動作確認
# - 金融計算エンジン動作確認
# - UI/UX動作確認

# 3. リリース実行
npm run release:hedge patch

# 4. 完成通知
osascript -e 'display notification "MVP完成！" with title "ArbitrageAssistant" sound name "Glass"'
```

---

## 📈 成功指標・KPI

### **開発効率**
- **全体完成時間**: < 3時間
- **各Director実行時間**: < 60分/部門
- **品質チェック通過率**: 100%

### **技術品質**
- **ESLint warnings**: 0
- **TypeScript errors**: 0  
- **Test coverage**: > 80%
- **Build success**: 100%

---

## 🔄 次回開発時の改善

### **学習事項**
- [ ] 各Director実行時間の記録・最適化
- [ ] 技術課題の事前回避策検討
- [ ] 並列実行可能箇所の拡大

### **Haconiwa完全版対応準備**
- [ ] 真のマルチエージェント並列実行対応
- [ ] CEO自動指令機能対応
- [ ] リアルタイム進捗監視対応

---

## 📞 サポート・問い合わせ

**Human CEO業務**: `tasks/user-ceo-responsibilities.md` 参照  
**技術仕様**: `MVPシステム設計.md` 参照  
**Haconiwa設計**: `arbitrage-assistant.yaml` 参照

---

**🚀 準備完了！Human CEOの判断で開発開始してください！**