# MT4/MT5統合システム エンドツーエンドテスト計画

## 📋 概要
本計画は、MT4/MT5統合システムのMVPリリースに向けた包括的なテスト戦略を定義します。

## 🎯 テスト目標
1. **機能完全性**: 全取引フロー（OPEN/CLOSE/TRAIL）の動作確認
2. **パフォーマンス**: レイテンシ10ms以下、24時間安定稼働
3. **信頼性**: 自動再接続、エラーリカバリの確認
4. **統合性**: Hedge System ↔ MT5間の双方向通信検証

## 📊 現在の実装状況
- WebSocket DLL: 98%完成（ビルド待ち）
- HedgeSystemConnector.mq5: 95%完成（トレール機能未実装）
- Hedge System側: 基本機能のみ（TrailEngine未実装）
- 統合テスト: 0%（未着手）

## 🔧 前提条件
1. WebSocket DLLビルド完了（websocket-engineer担当）
2. MT5デモ環境準備完了（mt5-connector-specialist担当）
3. Hedge System開発サーバー稼働中

## 📅 テストフェーズ

### Phase 1: 単体機能テスト（1週目）
#### 1.1 DLL基本動作テスト
```mq5
// test/unit/dll_basic_test.mq5
void TestDLLLoad() {
    // DLLロード確認
    int result = WSInit();
    assert(result == 1, "DLL load failed");
}

void TestWebSocketConnection() {
    // 接続テスト
    string url = "ws://localhost:8080/ws";
    int connected = WSConnect(url);
    assert(connected == 1, "WebSocket connection failed");
}
```

#### 1.2 メッセージ送受信テスト
- JSON形式の送信テスト
- 受信メッセージパーステスト
- バッファオーバーフローテスト

### Phase 2: 統合機能テスト（2週目）
#### 2.1 取引フローテスト
```mq5
// test/integration/trading_flow_test.mq5
void TestOpenPositionFlow() {
    // 1. OPENコマンド送信
    SendOpenCommand("USDJPY", "BUY", 1.0);
    
    // 2. OPENEDイベント受信確認
    string response = WaitForEvent("OPENED", 5000);
    assert(StringFind(response, "mtTicket") != -1);
    
    // 3. MT5ポジション確認
    int total = PositionsTotal();
    assert(total > 0, "Position not created in MT5");
}
```

#### 2.2 トレール機能テスト
- SET_TRAILコマンド受信
- 価格監視とトレール判定
- TRAIL_TRIGGEREDイベント送信

### Phase 3: パフォーマンステスト（3週目）
#### 3.1 レイテンシ測定
```mq5
void TestMessageLatency() {
    ulong start = GetMicrosecondCount();
    SendTestMessage();
    WaitForResponse();
    ulong end = GetMicrosecondCount();
    
    double latency = (end - start) / 1000.0; // ms
    assert(latency < 10.0, "Latency exceeds 10ms");
}
```

#### 3.2 負荷テスト
- 100メッセージ/秒の送信
- 24時間連続稼働テスト
- メモリリーク検証

### Phase 4: 障害復旧テスト（4週目）
#### 4.1 ネットワーク障害
- 接続切断→自動再接続
- パケットロス状況での動作
- タイムアウト処理

#### 4.2 システム障害
- Hedge Systemダウン→復旧
- MT5再起動→再接続
- DLLクラッシュリカバリ

## 📊 テストメトリクス

| メトリクス | 目標値 | 測定方法 |
|-----------|--------|----------|
| 接続成功率 | 99.9% | 1000回接続テスト |
| メッセージレイテンシ | < 10ms | 往復時間測定 |
| 24時間稼働率 | 100% | 連続稼働テスト |
| メモリ使用量 | < 50MB | タスクマネージャー監視 |
| CPU使用率 | < 5% | パフォーマンスモニター |

## 🛠️ テスト環境

### MT5側
- MetaTrader 5 Build 3200+
- Windows 10/11 or macOS 12+
- デモ口座（FXCM or XM）

### Hedge System側
- AWS EC2 t3.medium
- WebSocketサーバー（port 8080）
- GraphQL API（AppSync）

### ネットワーク
- ローカル開発: localhost
- ステージング: VPN経由
- 本番想定: インターネット経由

## 📝 テストケース管理

### テストケースリポジトリ
```
ea/test/
├── unit/               # 単体テスト
│   ├── dll_basic_test.mq5
│   └── json_parser_test.mq5
├── integration/        # 統合テスト
│   ├── trading_flow_test.mq5
│   ├── trail_function_test.mq5
│   └── error_handling_test.mq5
└── performance/        # パフォーマンステスト
    ├── latency_test.mq5
    └── stress_test.mq5
```

### 実行方法
```bash
# 全テスト実行
./scripts/run-all-tests.sh

# カテゴリ別実行
./scripts/run-tests.sh unit
./scripts/run-tests.sh integration
./scripts/run-tests.sh performance
```

## 🚨 リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| DLLビルド失敗 | 高 | 事前にビルド環境検証 |
| MT5 API変更 | 中 | 最新ドキュメント確認 |
| ネットワーク遅延 | 中 | タイムアウト値調整 |
| メモリリーク | 高 | Valgrind等で検証 |

## 📊 テスト結果レポート

テスト完了後、以下の形式でレポートを作成：

```markdown
# テスト結果レポート - [日付]

## サマリー
- 総テストケース数: XXX
- 成功: XXX (XX%)
- 失敗: XXX
- スキップ: XXX

## 詳細結果
[各テストの詳細結果]

## パフォーマンス測定結果
[レイテンシ、CPU、メモリ等]

## 課題と改善提案
[発見された問題と対策]
```

## 🎯 成功基準
1. 全機能テストケースの95%以上が合格
2. パフォーマンス目標を全て達成
3. 24時間連続稼働テストに合格
4. 重大なバグがゼロ

## 📅 スケジュール
- Week 1: 単体テスト実施
- Week 2: 統合テスト実施
- Week 3: パフォーマンステスト
- Week 4: 障害復旧テスト・最終確認

本計画に基づいて、MT4/MT5統合システムの品質を保証し、MVPリリースの準備を完了させます。