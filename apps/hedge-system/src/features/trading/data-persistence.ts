import { generateClient } from "aws-amplify/data";
import type { Schema } from "@repo/shared-backend/amplify/data/resource";
import { EntryCommandResult } from "./websocket-entry";

const client = generateClient<Schema>();

export interface CreatePositionInput {
  accountId: string;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  status: "open" | "pending_close" | "closed";
  openedAt: string;
  trailSettings?: Record<string, any>;
  closeSettings?: Record<string, any>;
  relatedPositionId?: string;
}

export interface UpdatePositionInput {
  id: string;
  currentPrice?: number;
  profit?: number;
  swapTotal?: number;
  status?: "open" | "pending_close" | "closed";
  closedAt?: string;
  trailSettings?: Record<string, any>;
  closeSettings?: Record<string, any>;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

/**
 * ポジション保存関数
 */
export const savePosition = async (
  positionData: CreatePositionInput,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ success: boolean; positionId?: string; error?: string }> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      console.log(`Saving position (attempt ${attempt + 1}):`, positionData);

      // バリデーション
      const validation = validatePositionData(positionData);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // GraphQL mutation実行
      const result = await client.mutations.createPosition({
        accountId: positionData.accountId,
        symbol: positionData.symbol,
        type: positionData.type,
        lots: positionData.lots,
        openPrice: positionData.openPrice,
        currentPrice: positionData.currentPrice,
        profit: positionData.profit,
        status: positionData.status,
        openedAt: positionData.openedAt,
        trailSettings: positionData.trailSettings,
        closeSettings: positionData.closeSettings,
        relatedPositionId: positionData.relatedPositionId,
      });

      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(", ")}`);
      }

      if (!result.data) {
        throw new Error("No data returned from createPosition mutation");
      }

      console.log("Position saved successfully:", result.data.id);
      return {
        success: true,
        positionId: result.data.id,
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Position save attempt ${attempt + 1} failed:`, lastError.message);

      // 最後の試行でない場合は待機してリトライ
      if (attempt < retryConfig.maxRetries) {
        const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || "Unknown error occurred during position save",
  };
};

/**
 * ポジション更新関数
 */
export const updatePosition = async (
  updateData: UpdatePositionInput,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ success: boolean; positionId?: string; error?: string }> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      console.log(`Updating position (attempt ${attempt + 1}):`, updateData);

      // バリデーション
      if (!updateData.id) {
        throw new Error("Position ID is required for update");
      }

      // GraphQL mutation実行
      const result = await client.mutations.updatePosition(updateData);

      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(", ")}`);
      }

      if (!result.data) {
        throw new Error("No data returned from updatePosition mutation");
      }

      console.log("Position updated successfully:", result.data.id);
      return {
        success: true,
        positionId: result.data.id,
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Position update attempt ${attempt + 1} failed:`, lastError.message);

      // 最後の試行でない場合は待機してリトライ
      if (attempt < retryConfig.maxRetries) {
        const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || "Unknown error occurred during position update",
  };
};

/**
 * エントリー成功時の自動保存処理
 */
export const handleEntrySuccess = async (
  entryResult: EntryCommandResult,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ success: boolean; positionId?: string; error?: string }> => {
  try {
    console.log("Handling entry success:", entryResult);

    // エントリー結果から必要な情報を取得
    if (!entryResult.success || !entryResult.positionId) {
      throw new Error("Invalid entry result: missing position information");
    }

    if (!entryResult.accountId || !entryResult.symbol || !entryResult.direction || !entryResult.lotSize) {
      throw new Error("Invalid entry result: missing required fields");
    }

    // ポジションデータを構築
    const positionData: CreatePositionInput = {
      accountId: entryResult.accountId,
      symbol: entryResult.symbol,
      type: entryResult.direction.toLowerCase() as "buy" | "sell",
      lots: entryResult.lotSize,
      openPrice: entryResult.executedPrice || 0,
      currentPrice: entryResult.executedPrice || 0,
      profit: 0,
      status: "open",
      openedAt: entryResult.executedTime || new Date().toISOString(),
    };

    // ポジション保存
    const result = await savePosition(positionData, retryConfig);
    
    if (result.success) {
      console.log("Entry success handled successfully, position saved:", result.positionId);
    } else {
      console.error("Failed to save position after entry success:", result.error);
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error handling entry success:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * データ整合性チェック
 */
export const validatePositionData = (data: CreatePositionInput): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 必須フィールドチェック
  if (!data.accountId) errors.push("Account ID is required");
  if (!data.symbol) errors.push("Symbol is required");
  if (!data.type || !["buy", "sell"].includes(data.type)) errors.push("Type must be 'buy' or 'sell'");
  if (!data.status || !["open", "pending_close", "closed"].includes(data.status)) {
    errors.push("Status must be 'open', 'pending_close', or 'closed'");
  }
  if (!data.openedAt) errors.push("Opened date is required");

  // 数値フィールドチェック
  if (typeof data.lots !== "number" || data.lots <= 0) {
    errors.push("Lots must be a positive number");
  }
  if (typeof data.openPrice !== "number" || data.openPrice <= 0) {
    errors.push("Open price must be a positive number");
  }
  if (typeof data.currentPrice !== "number" || data.currentPrice <= 0) {
    errors.push("Current price must be a positive number");
  }
  if (typeof data.profit !== "number") {
    errors.push("Profit must be a number");
  }

  // 日付フィールドチェック
  try {
    new Date(data.openedAt);
  } catch {
    errors.push("Invalid opened date format");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * エラー時のロールバック処理（必要に応じて）
 */
export const rollbackPosition = async (positionId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log("Rolling back position:", positionId);

    // ポジション削除（実際の実装では論理削除やステータス変更を行う場合もある）
    const result = await client.models.Position?.delete({ id: positionId });

    if (result?.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(", ")}`);
    }

    console.log("Position rollback successful:", positionId);
    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Position rollback failed:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};