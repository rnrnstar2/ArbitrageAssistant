/**
 * WebSocket Performance Test - レイテンシ < 50ms 確認
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocketHandler } from '../lib/websocket-handler';

describe('WebSocket Performance Test', () => {
  let wsHandler: WebSocketHandler;

  beforeAll(async () => {
    wsHandler = new WebSocketHandler();
  });

  afterAll(async () => {
    if (wsHandler.isConnected()) {
      await wsHandler.disconnect();
    }
  });

  it('should have low latency for command execution < 50ms', async () => {
    // WebSocket接続開始
    const connectStart = Date.now();
    await wsHandler.connect(8888); // テスト用ポート
    const connectTime = Date.now() - connectStart;

    // 接続レイテンシチェック
    expect(connectTime).toBeLessThan(1000); // 接続は1秒以内
    
    // モックのOPENコマンド送信レイテンシ測定
    const commandStart = Date.now();
    const result = await wsHandler.sendOpenCommand({
      accountId: 'test-account',
      positionId: 'test-position',
      symbol: 'USDJPY',
      volume: 0.1
    });
    const commandTime = Date.now() - commandStart;

    // レイテンシ要件確認（< 50ms）
    expect(commandTime).toBeLessThan(50);
    console.log(`Command execution time: ${commandTime}ms`);
    
    // 接続品質確認
    const quality = await wsHandler.getConnectionQuality();
    expect(quality.quality).toBe('EXCELLENT');
    expect(quality.latency).toBeLessThan(50);
  });

  it('should maintain performance under load', async () => {
    if (!wsHandler.isConnected()) {
      await wsHandler.connect(8888);
    }

    // 10回の連続コマンド実行
    const latencies: number[] = [];
    
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await wsHandler.sendOpenCommand({
        accountId: `test-account-${i}`,
        positionId: `test-position-${i}`,
        symbol: 'USDJPY',
        volume: 0.1
      });
      const latency = Date.now() - start;
      latencies.push(latency);
    }

    // 平均レイテンシ確認
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    expect(avgLatency).toBeLessThan(50);
    
    // 最大レイテンシ確認
    const maxLatency = Math.max(...latencies);
    expect(maxLatency).toBeLessThan(100);

    console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Max latency: ${maxLatency}ms`);
    console.log(`Latencies: ${latencies.join(', ')}ms`);
  });

  it('should handle WebSocket stats reporting', async () => {
    if (!wsHandler.isConnected()) {
      await wsHandler.connect(8888);
    }

    const stats = await wsHandler.getStats();
    
    expect(stats).toBeDefined();
    expect(stats.isRunning).toBe(true);
    expect(stats.totalMessagesSent).toBeGreaterThanOrEqual(0);
    expect(stats.errors).toBe(0);
    
    console.log('WebSocket Stats:', stats);
  });
});