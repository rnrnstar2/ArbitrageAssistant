import { generateClient } from "aws-amplify/data";
import type { Schema } from "@repo/shared-backend/amplify/data/resource";

const client = generateClient<Schema>();

export interface EntryFormData {
  accountId: string;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  price?: number;
  trailSettings?: {
    enabled: boolean;
    startPips: number;
    trailPips: number;
  };
  hedgeSettings?: {
    enabled: boolean;
    targetAccountId: string;
    delaySeconds: number;
  };
}

export interface EntryResult {
  success: boolean;
  entryId?: string;
  error?: string;
}

export interface PreEntryCheckResult {
  canTrade: boolean;
  requiredMargin: number;
  availableMargin: number;
  warnings: string[];
}

export class TradingService {
  /**
   * エントリー実行
   */
  static async executeEntry(entryData: EntryFormData): Promise<EntryResult> {
    try {
      // 1. バリデーション
      const validation = this.validateEntryData(entryData);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // 2. エントリー前チェック
      const preCheck = await this.preEntryCheck(entryData.accountId);
      if (!preCheck.canTrade) {
        return {
          success: false,
          error: `取引できません: ${preCheck.warnings.join(", ")}`,
        };
      }

      // 3. GraphQL mutation実行
      const result = await client.mutations.createEntry({
        accountId: entryData.accountId,
        symbol: entryData.symbol,
        type: entryData.type,
        lots: entryData.lots,
        price: entryData.price,
        trailSettings: entryData.trailSettings,
        hedgeSettings: entryData.hedgeSettings,
      });

      console.log("Entry mutation result:", result);

      if (result.data && typeof result.data === 'object' && 'entryId' in result.data) {
        return {
          success: true,
          entryId: String(result.data.entryId),
        };
      }

      return {
        success: true,
        entryId: "unknown",
      };
    } catch (error) {
      console.error("Entry execution error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "不明なエラーが発生しました",
      };
    }
  }

  /**
   * エントリー前チェック
   */
  static async preEntryCheck(accountId: string): Promise<PreEntryCheckResult> {
    try {
      // アカウント情報取得
      const account = await client.models.Account.get({ id: accountId });
      
      if (!account.data) {
        return {
          canTrade: false,
          requiredMargin: 0,
          availableMargin: 0,
          warnings: ["アカウントが見つかりません"],
        };
      }

      const warnings: string[] = [];
      
      // 残高チェック
      if (account.data.balance <= 0) {
        warnings.push("残高が不足しています");
      }

      // 証拠金維持率チェック
      if (account.data.marginLevel && account.data.marginLevel < 200) {
        warnings.push("証拠金維持率が低すぎます");
      }

      // 簡易的な必要証拠金計算（実際はシンボル毎の計算が必要）
      const requiredMargin = account.data.balance * 0.01; // 仮の計算
      const availableMargin = account.data.balance * 0.8;

      return {
        canTrade: warnings.length === 0,
        requiredMargin,
        availableMargin,
        warnings,
      };
    } catch (error) {
      console.error("Pre-entry check error:", error);
      return {
        canTrade: false,
        requiredMargin: 0,
        availableMargin: 0,
        warnings: ["事前チェックでエラーが発生しました"],
      };
    }
  }

  /**
   * エントリーデータのバリデーション
   */
  private static validateEntryData(data: EntryFormData): { isValid: boolean; error?: string } {
    if (!data.accountId) {
      return { isValid: false, error: "アカウントIDが必要です" };
    }

    if (!data.symbol) {
      return { isValid: false, error: "通貨ペアが必要です" };
    }

    if (!["buy", "sell"].includes(data.type)) {
      return { isValid: false, error: "売買方向が不正です" };
    }

    if (data.lots <= 0 || data.lots > 100) {
      return { isValid: false, error: "ロット数が不正です (0.01-100)" };
    }

    if (data.price && data.price <= 0) {
      return { isValid: false, error: "価格が不正です" };
    }

    // トレール設定のバリデーション
    if (data.trailSettings?.enabled) {
      if (!data.trailSettings.startPips || data.trailSettings.startPips <= 0) {
        return { isValid: false, error: "トレール開始PIPSが不正です" };
      }
      if (!data.trailSettings.trailPips || data.trailSettings.trailPips <= 0) {
        return { isValid: false, error: "トレールPIPSが不正です" };
      }
    }

    // 両建て設定のバリデーション
    if (data.hedgeSettings?.enabled) {
      if (!data.hedgeSettings.targetAccountId) {
        return { isValid: false, error: "両建て対象アカウントが必要です" };
      }
      if (data.hedgeSettings.targetAccountId === data.accountId) {
        return { isValid: false, error: "両建て対象アカウントは異なるアカウントを選択してください" };
      }
    }

    return { isValid: true };
  }

  /**
   * エントリー履歴取得
   */
  static async getEntryHistory(accountId?: string, limit = 50) {
    try {
      if (accountId) {
        const account = await client.models.Account.get({ id: accountId });
        if (!account.data) {
          throw new Error("アカウントが見つかりません");
        }
        // TODO: account.entriesでリレーション取得
        return [];
      } else {
        // 全てのエントリー履歴を取得
        const entries = await client.models.Entry.list({
          limit,
        });
        return entries.data || [];
      }
    } catch (error) {
      console.error("Error fetching entry history:", error);
      throw error;
    }
  }
}