import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/batchClosePositions";

Amplify.configure(
  {
    API: {
      GraphQL: {
        endpoint: env.GRAPHQL_ENDPOINT,
        region: env.AWS_REGION,
        defaultAuthMode: "iam",
      },
    },
  },
  {
    ssr: true,
  }
);

const client = generateClient<Schema>({
  authMode: "iam",
});

interface BatchCloseEvent {
  positionIds: string[];
  closeType: "market" | "limit";
  trailSettings?: Record<string, any>;
  priority: "normal" | "high";
}

interface CloseResult {
  id: string;
  positionId: string;
  status: "pending" | "executed" | "failed";
  executedPrice?: number;
  profit?: number;
  error?: string;
}

export const handler = async (event: BatchCloseEvent) => {
  try {
    console.log("Batch closing positions:", JSON.stringify(event));

    // バリデーション
    if (!event.positionIds || !Array.isArray(event.positionIds) || event.positionIds.length === 0) {
      throw new Error("Position IDs array is required");
    }

    if (!["market", "limit"].includes(event.closeType)) {
      throw new Error("Close type must be 'market' or 'limit'");
    }

    if (!["normal", "high"].includes(event.priority)) {
      throw new Error("Priority must be 'normal' or 'high'");
    }

    const results: CloseResult[] = [];
    let successful = 0;
    let failed = 0;

    // 優先度によって処理順序を決定
    const sortedPositionIds = event.priority === 'high' 
      ? event.positionIds 
      : event.positionIds.sort();

    // 各ポジションを順次処理
    for (const positionId of sortedPositionIds) {
      try {
        // ポジション取得
        const position = await client.models.Position.get({ id: positionId });
        if (!position.data) {
          failed++;
          results.push({
            id: '',
            positionId,
            status: 'failed',
            error: 'Position not found',
          });
          continue;
        }

        if (position.data.status !== "open") {
          failed++;
          results.push({
            id: '',
            positionId,
            status: 'failed',
            error: `Position is not open (current status: ${position.data.status})`,
          });
          continue;
        }

        // 現在価格を決済価格として使用（成行の場合）
        const closePrice = position.data.currentPrice;

        // 損益計算
        const priceDiff = position.data.type === 'buy' 
          ? closePrice - position.data.openPrice
          : position.data.openPrice - closePrice;
        
        const profit = priceDiff * position.data.lots * 100000; // 簡易計算

        // 保有期間計算
        const openTime = new Date(position.data.openedAt);
        const now = new Date();
        const holdingDays = Math.ceil((now.getTime() - openTime.getTime()) / (1000 * 60 * 60 * 24));

        // スワップコスト計算（仮）
        const swapCost = holdingDays * position.data.lots * 0.5;

        // 決済レコード作成
        const closeRecord = await client.models.CloseRecord.create({
          positionId: positionId,
          accountId: position.data.accountId,
          symbol: position.data.symbol,
          type: position.data.type,
          lots: position.data.lots,
          openPrice: position.data.openPrice,
          closePrice: closePrice,
          profit: profit,
          swapCost: swapCost,
          holdingDays: holdingDays,
          closeType: event.closeType,
          trailSettings: event.trailSettings ? JSON.stringify(event.trailSettings) : undefined,
          status: "pending",
        });

        if (!closeRecord.data) {
          failed++;
          results.push({
            id: '',
            positionId,
            status: 'failed',
            error: 'Failed to create close record',
          });
          continue;
        }

        // ポジションステータス更新
        await client.models.Position.update({
          id: positionId,
          status: "pending_close",
          closeSettings: JSON.stringify({
            targetPrice: closePrice,
            trailSettings: event.trailSettings,
          }),
        });

        successful++;
        results.push({
          id: closeRecord.data.id,
          positionId,
          status: 'pending',
          executedPrice: closePrice,
          profit: profit,
        });

        // TODO: WebSocket経由でEAに決済コマンド送信
        console.log("Close command would be sent to EA:", {
          positionId,
          closePrice,
          closeType: event.closeType,
        });

        // 各決済間に短い間隔を設ける（システム負荷軽減）
        if (sortedPositionIds.indexOf(positionId) < sortedPositionIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`Error closing position ${positionId}:`, error);
        failed++;
        results.push({
          id: '',
          positionId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`Batch close completed: ${successful} successful, ${failed} failed`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        totalRequested: event.positionIds.length,
        successful,
        failed,
        results,
      }),
    };
  } catch (error) {
    console.error("Error in batch close:", error);
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};