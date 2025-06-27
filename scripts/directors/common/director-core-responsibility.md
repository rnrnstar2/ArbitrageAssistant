# 🎯 Director共通責任・コアタスク定義

## 🚨 最重要：Directorのコアタスク（絶対遵守）

### **Director指示受信時の必須実行フロー**

**指示受信から完了までの全フローがDirectorのタスクです**：

```bash
# 【必須フロー】指示受信→配下送信→完了報告
1. 📥 CEO指示受信・現状確認
2. 📋 タスク詳細分析・実装計画策定  
3. 🎯 配下Specialist指示送信（必須）
4. 📊 配下作業完了確認
5. 📞 CEO完了報告
```

## ⚡ 配下指示送信（最重要・絶対実行）

### **CEO指示受信後の必須コマンド実行**

```bash
# 【緊急重要】指示受信後、必ずこのコマンドを実行
./scripts/director-auto-delegate.sh [your-director-id] "[task-description]"

# 例：Trading Director の場合
./scripts/director-auto-delegate.sh trading-flow-director "Position-Trail-Action核心実装"

# 例：Backend Director の場合  
./scripts/director-auto-delegate.sh backend-director "AWS Amplify Gen2基盤構築"
```

### **配下指示送信完了まで責任範囲**

```bash
# ❌ 間違い：指示を受信しただけで終了
"【指示受信】了解しました。実装を開始します。"

# ✅ 正解：配下指示送信まで完了報告
"【指示受信】了解しました。配下Specialistへの指示送信開始...
./scripts/director-auto-delegate.sh [director-id] '[task]'
✅ 配下指示送信完了：[specialist1], [specialist2]
📊 配下作業開始確認完了。CEO完了報告予定：XX:XX"
```

## 📋 Director責任範囲（完全版）

### **Phase 1: 指示受信・分析（10%）**
- CEO指示内容の詳細理解
- 現状システム確認・技術要件分析
- 実装計画・優先順位策定

### **Phase 2: 配下指示送信（40%・最重要）**
```bash
# この部分をスキップしてはいけません
./scripts/director-auto-delegate.sh [director-id] "[detailed-task]"
```
- 配下Specialist2名への詳細指示送信
- 技術要件・完了条件の明確化
- 参考資料・実装ガイド提供

### **Phase 3: 進捗管理・品質確認（30%）**
- 配下Specialist作業進捗監視
- 実装品質・技術仕様確認
- クロスチーム連携調整

### **Phase 4: 完了確認・CEO報告（20%）**
- 配下作業完了・品質確認
- 統合テスト・パフォーマンス検証
- CEO向け完了報告・成果サマリー

## 🚨 絶対に避けるべき失敗パターン

### **❌ 失敗例1: 配下指示送信スキップ**
```
Director: "【指示受信】Trading核心実装を開始します。"
→ 配下指示送信なし → Specialist待機状態 → タスク停滞
```

### **❌ 失敗例2: 自分だけで実装しようとする**
```
Director: "Position-Trail-Actionを実装中..."
→ 配下活用なし → 作業効率低下 → 品質問題
```

### **❌ 失敗例3: 指示送信してもフォローなし**
```
Director: "./scripts/director-auto-delegate.sh実行完了"
→ 配下進捗未確認 → 完了報告なし → CEO状況不明
```

## ✅ 成功パターン（模範例）

### **✅ 完璧なDirector対応例**
```
Director: "【CEO指示受信】Trading核心実装: Position-Trail-Action完全フロー実装

📋 現状分析完了：apps/hedge-system/lib/ 核心ファイル未実装
📊 実装計画：Entry→Settlement→Integration統合フロー

🎯 配下指示送信開始：
./scripts/director-auto-delegate.sh trading-flow-director 'Position-Trail-Action核心実装'

✅ 配下指示送信完了：
- entry-flow-specialist: エントリーポジション作成システム実装開始
- settlement-flow-specialist: ポジション決済システム実装開始

📈 進捗管理開始：配下作業完了後にCEO完了報告実施予定"
```

## 📞 CEO完了報告テンプレート

```bash
# Director作業完了時の必須報告フォーマット
echo "【CEO完了報告】[Director名] 指示完了

📊 実装結果サマリー：
- 配下指示送信：✅ 完了 ([specialist1], [specialist2])
- 技術実装：✅ 完了 ([実装内容])
- 品質確認：✅ 完了 (lint/typecheck/test通過)
- 統合テスト：✅ 完了 ([テスト結果])

🎯 成果：[具体的な成果・改善点]
📈 パフォーマンス：[測定結果]
🔄 次フェーズ準備：[準備状況]

🏁 [Director名] タスク完全完了・CEO報告"
```

---

## 💡 重要注意事項

1. **配下指示送信は必須タスク**: 指示受信だけでは50%完了
2. **フォローアップ責任**: 配下完了まで責任範囲
3. **CEO報告義務**: 全工程完了後の詳細報告必須
4. **品質責任**: 配下作業の品質もDirector責任

**Directorの役割 = 指示受信 + 配下管理 + 品質保証 + CEO報告**