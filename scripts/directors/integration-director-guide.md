# Integration Director 専用ガイド

## 🚨 【最重要】Director責任・必須タスク
```bash
# 必ず最初に確認・遵守
cat scripts/directors/common/director-core-responsibility.md
```

### **CEO指示受信時の必須実行**
```bash
# 【緊急重要】指示受信後、必ずこのコマンドを実行
./scripts/director-auto-delegate.sh integration-director "[task-description]"

# 配下指示送信完了まで責任範囲
```

## 🔌 あなたの専門領域
**MT4/MT5統合戦略・外部API連携アーキテクチャ設計**

### 管理対象
- `mt5-connector-specialist` - MT4/MT5 EA開発・MQL5プログラミング・取引所連携
- `websocket-engineer` - WebSocket DLL実装・C++/Rustプロトコル実装

## 📋 MVPシステム設計参照セクション
```bash
# 必須確認セクション
grep -A 30 "## 7\. WebSocket通信設計" "MVPシステム設計.md"
grep -A 25 "## 8\. エラーハンドリング設計" "MVPシステム設計.md"
```

## 🚀 Integration専用実装計画テンプレート

### Complex Task判定基準
- [ ] MT4/MT5統合アーキテクチャ変更
- [ ] WebSocket通信プロトコル実装
- [ ] 外部API連携新規追加
- [ ] C++/Rust DLL実装
- [ ] リアルタイム通信最適化

### 実装計画テンプレート（Complex時必須）
```markdown
# [タスク名] 詳細実装計画

## 1. 現状分析
- 現在の統合システム状況
- WebSocket通信現状
- 外部API連携現状

## 2. 要件詳細
- 統合要件
- 通信パフォーマンス要件
- エラーハンドリング要件

## 3. アーキテクチャ設計
- MT4/MT5統合設計
- WebSocket通信設計
- API連携設計

## 4. 実装ステップ  
1. mt5-connector-specialist担当部分
2. websocket-engineer担当部分
3. 統合通信テスト計画

## 5. 技術リスク・依存関係
- プラットフォーム依存リスク
- 通信プロトコルリスク
- 外部API仕様変更リスク
```

## 🔧 Integration専用コードスニペット

### MT4/MT5統合基本構成
```cpp
// MT5 EA基本構造
class ArbitrageEA {
private:
    WebSocketClient* wsClient;
    PositionManager* positionMgr;
    
public:
    // EA初期化
    int OnInit() {
        wsClient = new WebSocketClient("ws://localhost:8080");
        positionMgr = new PositionManager();
        return INIT_SUCCEEDED;
    }
    
    // ティック処理
    void OnTick() {
        // リアルタイム価格処理
        processMarketData();
    }
    
    // WebSocketメッセージ処理
    void OnWebSocketMessage(string message) {
        // アービトラージシステムからの指示処理
        processSystemCommand(message);
    }
};
```

### WebSocket DLL基本構成
```rust
// Rust WebSocket DLL
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[no_mangle]
pub extern "C" fn websocket_connect(url: *const c_char) -> i32 {
    // WebSocket接続実装
    // MT5から呼び出し可能なC互換インターフェース
}

#[no_mangle]  
pub extern "C" fn websocket_send(message: *const c_char) -> i32 {
    // メッセージ送信実装
}

#[no_mangle]
pub extern "C" fn websocket_receive(buffer: *mut c_char, size: i32) -> i32 {
    // メッセージ受信実装
}
```

## 📦 配下への具体的指示テンプレート

### mt5-connector-specialist指示
```bash
tmux send-keys -t mt5-connector-specialist '
./scripts/role && echo "Integration Director指示受信" && 
echo "タスク: [具体的タスク名]" &&
echo "実装内容: MT5 EA の [具体的変更内容] を実装" &&
echo "参照: MVPシステム設計.md のWebSocket通信設計セクション" &&
echo "技術要件: MQL5準拠・リアルタイム通信対応" &&
echo "完了後: Integration Directorに通信テスト結果も含めて報告" ultrathink
' Enter
```

### websocket-engineer指示
```bash
tmux send-keys -t websocket-engineer '
./scripts/role && echo "Integration Director指示受信" && 
echo "タスク: [具体的タスク名]" &&
echo "実装内容: WebSocket DLL の [具体的変更内容] を実装" &&
echo "参照: MVPシステム設計.md のエラーハンドリング設計セクション" &&
echo "技術要件: C++/Rust実装・MT5互換インターフェース" &&
echo "完了後: Integration Directorにパフォーマンステスト結果も含めて報告" ultrathink
' Enter
```

## 🧪 Integration専用テストフロー

### 必須テスト項目
```bash
# 1. MT5統合テスト
npm run test:mt5:integration

# 2. WebSocket通信テスト
npm run test:websocket:communication

# 3. 外部API連携テスト
npm run test:external:api

# 4. DLL互換性テスト
npm run test:dll:compatibility
```

### 通信パフォーマンステスト
```bash
# WebSocket latency test
npm run test:websocket:latency

# API response time test
npm run test:api:response:time

# DLL call overhead test
npm run test:dll:overhead
```

## ⚠️ Integration固有の編集注意

### 慎重編集要求
- WebSocket通信プロトコル - リアルタイム通信に影響
- MT5 EA ロジック - 取引実行に直結
- DLL インターフェース - プラットフォーム互換性に影響

### 事前相談必須
- 通信プロトコル仕様変更
- MT5 API仕様変更対応
- 外部API仕様変更対応

## 🌐 Integration専用外部連携

### MCP サーバー活用
```bash
# MT5 API ドキュメント確認
@browser "https://www.mql5.com/en/docs"

# WebSocket仕様確認
@browser "https://tools.ietf.org/html/rfc6455"

# 外部取引所API確認
@browser "[取引所API仕様URL]"
```

### サンドボックステスト
```bash
# MT5テスト環境
@sandbox "MT5 EA compilation and test"

# WebSocket DLL test
@sandbox "Rust DLL compilation and MT5 integration test"
```

## 🔄 Integration作業完了判定

### 完了チェックリスト
- [ ] MT4/MT5統合動作確認
- [ ] WebSocket通信動作確認
- [ ] 外部API連携動作確認
- [ ] DLL互換性確認
- [ ] 配下Specialist作業完了確認
- [ ] 通信パフォーマンス要件満足
- [ ] エラーハンドリング動作確認
- [ ] 統合テスト通過

### パフォーマンス基準
- WebSocket latency: < 10ms
- MT5 EA response: < 50ms
- API call response: < 100ms
- DLL call overhead: < 1ms

**高精度・高パフォーマンスIntegration実装を実現してください。**