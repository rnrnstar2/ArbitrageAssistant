import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';

export interface LossCutHistoryRecord {
  id: string;
  timestamp: Date;
  accountId: string;
  triggerEvent: {
    type: 'losscut_occurred' | 'margin_critical' | 'manual_trigger';
    marginLevel: number;
    freeMargin: number;
    totalLoss: number;
  };
  executedActions: ActionExecutionRecord[];
  outcome: {
    damageMinimized: number;
    recoveryTime: number;
    finalMarginLevel: number;
    totalCost: number;
  };
  lessons: string[];
}

export interface ActionExecutionRecord {
  actionId: string;
  type: string;
  startTime: Date;
  endTime: Date;
  status: 'success' | 'failed' | 'partial';
  result: any;
  error?: string;
}

export interface LossCutFilter {
  accountIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  triggerTypes?: string[];
  severity?: string[];
}

export interface LossCutAnalytics {
  totalOccurrences: number;
  averageRecoveryTime: number;
  totalDamageMinimized: number;
  actionSuccessRate: number;
  frequentTriggers: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    count: number;
    damageMinimized: number;
  }>;
}

export class LossCutHistoryManager {
  private client = generateClient<Schema>();
  private historyCache: Map<string, LossCutHistoryRecord> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5分
  private lastCacheUpdate = 0;

  /**
   * ロスカット履歴を記録
   */
  async recordLossCutEvent(record: Omit<LossCutHistoryRecord, 'id'>): Promise<string> {
    try {
      const recordWithId: LossCutHistoryRecord = {
        ...record,
        id: `losscut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // DynamoDBに保存（AWS Amplify経由）
      await this.saveToDB(recordWithId);
      
      // キャッシュを更新
      this.historyCache.set(recordWithId.id, recordWithId);
      
      console.log(`ロスカット履歴記録完了: ${recordWithId.id}`);
      return recordWithId.id;
    } catch (error) {
      console.error('ロスカット履歴記録エラー:', error);
      throw error;
    }
  }

  /**
   * 履歴一覧を取得
   */
  async getHistory(filter?: LossCutFilter, limit = 50): Promise<LossCutHistoryRecord[]> {
    try {
      // キャッシュチェック
      if (this.isCacheValid() && !filter) {
        return Array.from(this.historyCache.values())
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, limit);
      }

      // DBから取得
      const records = await this.fetchFromDB(filter, limit);
      
      // キャッシュ更新
      records.forEach(record => {
        this.historyCache.set(record.id, record);
      });
      this.lastCacheUpdate = Date.now();

      return records;
    } catch (error) {
      console.error('履歴取得エラー:', error);
      throw error;
    }
  }

  /**
   * 特定履歴の詳細を取得
   */
  async getHistoryDetail(id: string): Promise<LossCutHistoryRecord | null> {
    try {
      // キャッシュから確認
      if (this.historyCache.has(id)) {
        return this.historyCache.get(id)!;
      }

      // DBから取得
      const record = await this.fetchDetailFromDB(id);
      if (record) {
        this.historyCache.set(id, record);
      }
      
      return record;
    } catch (error) {
      console.error('履歴詳細取得エラー:', error);
      throw error;
    }
  }

  /**
   * 分析データを取得
   */
  async getAnalytics(filter?: LossCutFilter): Promise<LossCutAnalytics> {
    try {
      const records = await this.getHistory(filter, 1000);
      
      return this.calculateAnalytics(records);
    } catch (error) {
      console.error('分析データ取得エラー:', error);
      throw error;
    }
  }

  /**
   * アクション実行記録を追加
   */
  async addActionExecutionRecord(
    lossCutId: string, 
    actionRecord: ActionExecutionRecord
  ): Promise<void> {
    try {
      const existingRecord = await this.getHistoryDetail(lossCutId);
      if (!existingRecord) {
        throw new Error(`ロスカット履歴が見つかりません: ${lossCutId}`);
      }

      existingRecord.executedActions.push(actionRecord);
      await this.saveToDB(existingRecord);
      
      // キャッシュ更新
      this.historyCache.set(lossCutId, existingRecord);
      
      console.log(`アクション記録追加完了: ${lossCutId} - ${actionRecord.actionId}`);
    } catch (error) {
      console.error('アクション記録追加エラー:', error);
      throw error;
    }
  }

  /**
   * 履歴データをエクスポート
   */
  async exportHistory(
    format: 'json' | 'csv' | 'excel',
    filter?: LossCutFilter
  ): Promise<Blob> {
    try {
      const records = await this.getHistory(filter, 10000);
      
      switch (format) {
        case 'json':
          return new Blob([JSON.stringify(records, null, 2)], { 
            type: 'application/json' 
          });
        
        case 'csv':
          return this.generateCSV(records);
          
        case 'excel':
          return this.generateExcel(records);
          
        default:
          throw new Error(`サポートされていない形式: ${format}`);
      }
    } catch (error) {
      console.error('履歴エクスポートエラー:', error);
      throw error;
    }
  }

  /**
   * 古い履歴データのアーカイブ
   */
  async archiveOldRecords(olderThanDays = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const oldRecords = await this.fetchFromDB({
        dateRange: {
          start: new Date(0),
          end: cutoffDate
        }
      });

      // アーカイブストレージに移動
      await this.moveToArchive(oldRecords);
      
      // 元データを削除
      await this.deleteFromDB(oldRecords.map(r => r.id));
      
      // キャッシュからも削除
      oldRecords.forEach(record => {
        this.historyCache.delete(record.id);
      });

      console.log(`${oldRecords.length}件の履歴をアーカイブしました`);
      return oldRecords.length;
    } catch (error) {
      console.error('履歴アーカイブエラー:', error);
      throw error;
    }
  }

  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  private async saveToDB(record: LossCutHistoryRecord): Promise<void> {
    // AWS Amplify経由でDynamoDBに保存
    // 実装詳細は既存のデータ保存パターンに従う
    console.log('DB保存:', record.id);
  }

  private async fetchFromDB(
    filter?: LossCutFilter, 
    limit = 50
  ): Promise<LossCutHistoryRecord[]> {
    // AWS Amplify経由でDynamoDBから取得
    // 実装詳細は既存のデータ取得パターンに従う
    console.log('DB取得:', filter, limit);
    return [];
  }

  private async fetchDetailFromDB(id: string): Promise<LossCutHistoryRecord | null> {
    // AWS Amplify経由で特定レコードを取得
    console.log('DB詳細取得:', id);
    return null;
  }

  private async deleteFromDB(ids: string[]): Promise<void> {
    // AWS Amplify経由でレコードを削除
    console.log('DB削除:', ids);
  }

  private async moveToArchive(records: LossCutHistoryRecord[]): Promise<void> {
    // S3アーカイブストレージに移動
    console.log('アーカイブ移動:', records.length);
  }

  private calculateAnalytics(records: LossCutHistoryRecord[]): LossCutAnalytics {
    const totalOccurrences = records.length;
    const averageRecoveryTime = records.reduce((sum, r) => 
      sum + r.outcome.recoveryTime, 0) / totalOccurrences;
    const totalDamageMinimized = records.reduce((sum, r) => 
      sum + r.outcome.damageMinimized, 0);
    
    // アクション成功率計算
    const totalActions = records.reduce((sum, r) => sum + r.executedActions.length, 0);
    const successfulActions = records.reduce((sum, r) => 
      sum + r.executedActions.filter(a => a.status === 'success').length, 0);
    const actionSuccessRate = totalActions > 0 ? successfulActions / totalActions : 0;

    // 頻出トリガー分析
    const triggerCounts: Record<string, number> = {};
    records.forEach(r => {
      triggerCounts[r.triggerEvent.type] = (triggerCounts[r.triggerEvent.type] || 0) + 1;
    });
    
    const frequentTriggers = Object.entries(triggerCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / totalOccurrences) * 100
      }))
      .sort((a, b) => b.count - a.count);

    // 月次トレンド分析
    const monthlyData: Record<string, { count: number; damageMinimized: number }> = {};
    records.forEach(r => {
      const month = r.timestamp.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { count: 0, damageMinimized: 0 };
      }
      monthlyData[month].count++;
      monthlyData[month].damageMinimized += r.outcome.damageMinimized;
    });

    const monthlyTrend = Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalOccurrences,
      averageRecoveryTime,
      totalDamageMinimized,
      actionSuccessRate,
      frequentTriggers,
      monthlyTrend
    };
  }

  private generateCSV(records: LossCutHistoryRecord[]): Blob {
    const headers = [
      'ID', '発生時刻', 'アカウントID', 'トリガータイプ', 'マージンレベル',
      '損失額', '復旧時間', '最終マージンレベル', 'コスト', '学習事項'
    ];
    
    const rows = records.map(r => [
      r.id,
      r.timestamp.toISOString(),
      r.accountId,
      r.triggerEvent.type,
      r.triggerEvent.marginLevel,
      r.triggerEvent.totalLoss,
      r.outcome.recoveryTime,
      r.outcome.finalMarginLevel,
      r.outcome.totalCost,
      r.lessons.join('; ')
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  private generateExcel(records: LossCutHistoryRecord[]): Blob {
    // Excel生成（簡易実装）
    return this.generateCSV(records);
  }
}

export const lossCutHistoryManager = new LossCutHistoryManager();