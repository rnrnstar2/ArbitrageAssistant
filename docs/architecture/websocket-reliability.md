# EA-WebSocket連携 信頼性確保アーキテクチャ

## 信頼性の課題

### リスク要因
1. **ネットワーク切断**: インターネット接続の不安定性
2. **EA停止**: MT4/MT5クライアントの予期しない終了
3. **データ不整合**: 部分的な情報更新による齟齬
4. **サーバー再起動**: AWS側のメンテナンスやデプロイ

### 結果として起こりうる問題
- オープンポジション情報の欠損
- 決済済みポジションの残存
- 利益・損失の誤表示
- リスク管理の失敗

## 信頼性確保メカニズム

### 1. 多層防御システム

```typescript
// 信頼性確保の5段階
interface ReliabilityMechanisms {
  heartbeat: HeartbeatSystem;        // レベル1: 生存確認
  fullSync: FullSyncSystem;          // レベル2: 完全同期
  reconciliation: ReconcileSystem;   // レベル3: 整合性確認
  recovery: RecoverySystem;          // レベル4: 自動復旧
  alerting: AlertSystem;             // レベル5: 人的介入
}
```

### 2. ハートビートシステム

#### EA側実装
```cpp
// EA/HeartbeatManager.mqh
class HeartbeatManager {
private:
    datetime lastHeartbeat;
    int heartbeatInterval; // 秒
    
public:
    HeartbeatManager() {
        heartbeatInterval = 30; // 30秒間隔
    }
    
    void SendHeartbeat() {
        if (TimeCurrent() - lastHeartbeat >= heartbeatInterval) {
            json heartbeatData = {
                {"type", "HEARTBEAT"},
                {"accountId", AccountNumber()},
                {"timestamp", TimeToString(TimeCurrent())},
                {"positionCount", PositionsTotal()},
                {"balance", AccountBalance()},
                {"equity", AccountEquity()},
                {"syncVersion", GetSyncVersion()}
            };
            
            WebSocketSend(heartbeatData.dump());
            lastHeartbeat = TimeCurrent();
        }
    }
    
    int GetSyncVersion() {
        // ポジションリストのハッシュ値計算
        string positionHash = "";
        for (int i = 0; i < PositionsTotal(); i++) {
            if (PositionSelect(i)) {
                positionHash += IntegerToString(PositionGetInteger(POSITION_IDENTIFIER));
                positionHash += DoubleToString(PositionGetDouble(POSITION_VOLUME));
            }
        }
        return StringCRC32(positionHash);
    }
};
```

#### サーバー側監視
```typescript
// lambda/heartbeat-monitor.ts
export class HeartbeatMonitor {
    private static readonly HEARTBEAT_TIMEOUT = 90; // 90秒
    
    async processHeartbeat(data: HeartbeatData) {
        // 1. ハートビート記録
        await this.updateLastHeartbeat(data.accountId, data.timestamp);
        
        // 2. 同期バージョン確認
        const dbSyncVersion = await this.getDBSyncVersion(data.accountId);
        if (dbSyncVersion !== data.syncVersion) {
            console.log(`Sync version mismatch: DB=${dbSyncVersion}, EA=${data.syncVersion}`);
            await this.triggerFullSync(data.accountId);
        }
        
        // 3. 基本情報の更新
        await this.updateAccountBasics(data.accountId, {
            balance: data.balance,
            equity: data.equity,
            positionCount: data.positionCount
        });
    }
    
    async checkStaleConnections() {
        const staleAccounts = await this.findStaleAccounts(this.HEARTBEAT_TIMEOUT);
        
        for (const accountId of staleAccounts) {
            await this.markPositionsAsStale(accountId);
            await this.sendStaleAlert(accountId);
        }
    }
}
```

### 3. 完全同期システム

#### 定期完全同期（5分間隔）
```cpp
// EA/FullSyncManager.mqh
class FullSyncManager {
public:
    void SendFullPositionSync() {
        json allPositions = json::array();
        
        for (int i = 0; i < PositionsTotal(); i++) {
            if (PositionSelect(i)) {
                json position = {
                    {"mt4PositionId", IntegerToString(PositionGetInteger(POSITION_IDENTIFIER))},
                    {"symbol", PositionGetString(POSITION_SYMBOL)},
                    {"type", PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL"},
                    {"volume", PositionGetDouble(POSITION_VOLUME)},
                    {"openPrice", PositionGetDouble(POSITION_PRICE_OPEN)},
                    {"openTime", TimeToString(PositionGetInteger(POSITION_TIME))},
                    {"currentPrice", PositionGetDouble(POSITION_PRICE_CURRENT)},
                    {"profit", PositionGetDouble(POSITION_PROFIT)},
                    {"swap", PositionGetDouble(POSITION_SWAP)}
                };
                allPositions.push_back(position);
            }
        }
        
        json syncMessage = {
            {"type", "FULL_SYNC"},
            {"accountId", AccountNumber()},
            {"timestamp", TimeToString(TimeCurrent())},
            {"positions", allPositions},
            {"syncVersion", CalculateSyncVersion(allPositions)}
        };
        
        WebSocketSend(syncMessage.dump());
    }
};
```

#### サーバー側完全同期処理
```typescript
// lambda/full-sync-processor.ts
export class FullSyncProcessor {
    async processFullSync(data: FullSyncData) {
        const accountId = data.accountId;
        
        // 1. 現在のDBポジション取得
        const dbPositions = await this.getDBPositions(accountId);
        
        // 2. EA送信ポジションとの差分計算
        const {
            toCreate,
            toUpdate,
            toDelete
        } = this.calculateDifferences(dbPositions, data.positions);
        
        // 3. バッチ更新実行
        await Promise.all([
            this.createPositions(toCreate),
            this.updatePositions(toUpdate),
            this.deletePositions(toDelete)
        ]);
        
        // 4. 同期バージョン更新
        await this.updateSyncVersion(accountId, data.syncVersion);
        
        console.log(`Full sync completed for ${accountId}: +${toCreate.length} ~${toUpdate.length} -${toDelete.length}`);
    }
    
    private calculateDifferences(dbPositions: Position[], eaPositions: Position[]) {
        const dbMap = new Map(dbPositions.map(p => [p.mt4PositionId, p]));
        const eaMap = new Map(eaPositions.map(p => [p.mt4PositionId, p]));
        
        const toCreate = eaPositions.filter(p => !dbMap.has(p.mt4PositionId));
        const toUpdate = eaPositions.filter(p => {
            const dbPos = dbMap.get(p.mt4PositionId);
            return dbPos && this.needsUpdate(dbPos, p);
        });
        const toDelete = dbPositions.filter(p => !eaMap.has(p.mt4PositionId));
        
        return { toCreate, toUpdate, toDelete };
    }
}
```

### 4. 自動復旧システム

```typescript
// lambda/recovery-system.ts
export class RecoverySystem {
    async handleConnectionRecovery(accountId: string) {
        console.log(`Starting recovery for account: ${accountId}`);
        
        // 1. 古いデータをマーク
        await this.markAllPositionsAsStale(accountId);
        
        // 2. EAに完全同期要求
        await this.requestFullSyncFromEA(accountId);
        
        // 3. 30秒後に完全同期が来なければアラート
        setTimeout(async () => {
            const stillStale = await this.hasStalePositions(accountId);
            if (stillStale) {
                await this.sendRecoveryFailedAlert(accountId);
            }
        }, 30000);
    }
    
    async requestFullSyncFromEA(accountId: string) {
        const message = {
            type: 'REQUEST_FULL_SYNC',
            accountId,
            timestamp: new Date().toISOString()
        };
        
        await this.sendToEA(accountId, message);
    }
}
```

### 5. アラートシステム

```typescript
// lambda/alert-system.ts
export class AlertSystem {
    async sendStaleDataAlert(accountId: string) {
        const alert = {
            type: 'STALE_DATA',
            severity: 'HIGH',
            accountId,
            message: `Account ${accountId} has stale position data. Connection may be lost.`,
            timestamp: new Date(),
            actions: [
                'Check EA connection',
                'Verify MT4/MT5 is running',
                'Restart EA if necessary'
            ]
        };
        
        await Promise.all([
            this.sendSlackAlert(alert),
            this.sendEmailAlert(alert),
            this.logToDashboard(alert)
        ]);
    }
    
    async sendSyncVersionMismatchAlert(accountId: string, dbVersion: number, eaVersion: number) {
        const alert = {
            type: 'SYNC_VERSION_MISMATCH',
            severity: 'MEDIUM',
            accountId,
            message: `Sync version mismatch detected. DB: ${dbVersion}, EA: ${eaVersion}`,
            autoAction: 'Full sync triggered automatically',
            timestamp: new Date()
        };
        
        await this.logToDashboard(alert);
    }
}
```

## 実装優先順位

### Phase 1: 基本的な信頼性（1週間）
1. ハートビートシステム実装
2. 完全同期システム実装
3. 基本的なアラート機能

### Phase 2: 高度な信頼性（2週間）
1. 自動復旧システム実装
2. 詳細な同期バージョン管理
3. 包括的なアラートシステム

### Phase 3: 監視・最適化（1週間）
1. 信頼性メトリクス収集
2. パフォーマンス最適化
3. 監視ダッシュボード構築

## 期待される信頼性指標

- **データ整合性**: 99.9%以上
- **復旧時間**: 平均30秒以内
- **偽アラート率**: 1%以下
- **ダウンタイム**: 月1分以下

このアーキテクチャにより、EA-WebSocket連携の信頼性を大幅に向上させ、本番環境での安定運用を実現できます。