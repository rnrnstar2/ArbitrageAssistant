import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/closePosition";

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

interface ClosePositionEvent {
  positionId: string;
  closePrice: number;
  closeType: "market" | "limit";
  trailSettings?: Record<string, any>;
  linkedAction?: Record<string, any>;
}

export const handler = async (event: ClosePositionEvent) => {
  try {
    console.log("Closing position:", JSON.stringify(event));

    // バリデーション
    if (!event.positionId || !event.closePrice || !event.closeType) {
      throw new Error("Required fields missing");
    }

    if (!["market", "limit"].includes(event.closeType)) {
      throw new Error("Close type must be 'market' or 'limit'");
    }

    if (event.closePrice <= 0) {
      throw new Error("Close price must be greater than 0");
    }

    // ポジション存在確認
    const position = await client.models.Position.get({ id: event.positionId });
    if (!position.data) {
      throw new Error("Position not found");
    }

    if (position.data.status !== "open") {
      throw new Error(`Position is not open (current status: ${position.data.status})`);
    }

    // 損益計算
    const priceDiff = position.data.type === 'buy' 
      ? event.closePrice - position.data.openPrice
      : position.data.openPrice - event.closePrice;
    
    const profit = priceDiff * position.data.lots * 100000; // 簡易計算

    // 保有期間計算
    const openTime = new Date(position.data.openedAt);
    const now = new Date();
    const holdingDays = Math.ceil((now.getTime() - openTime.getTime()) / (1000 * 60 * 60 * 24));

    // スワップコスト計算（仮）
    const swapCost = holdingDays * position.data.lots * 0.5;

    // 決済レコード作成
    const closeRecord = await client.models.CloseRecord.create({
      positionId: event.positionId,
      accountId: position.data.accountId,
      symbol: position.data.symbol,
      type: position.data.type,
      lots: position.data.lots,
      openPrice: position.data.openPrice,
      closePrice: event.closePrice,
      profit: profit,
      swapCost: swapCost,
      holdingDays: holdingDays,
      closeType: event.closeType,
      trailSettings: event.trailSettings ? JSON.stringify(event.trailSettings) : undefined,
      linkedAction: event.linkedAction ? JSON.stringify(event.linkedAction) : undefined,
      status: "pending",
    });

    if (!closeRecord.data) {
      throw new Error("Failed to create close record");
    }

    // ポジションステータス更新
    await client.models.Position.update({
      id: event.positionId,
      status: "pending_close",
      closeSettings: JSON.stringify({
        targetPrice: event.closePrice,
        trailSettings: event.trailSettings,
        linkedCloseAction: event.linkedAction,
      }),
    });

    // TODO: WebSocket経由でEAに決済コマンド送信
    // この部分は後でWebSocket基盤が完成してから実装
    console.log("Close command would be sent to EA:", {
      positionId: event.positionId,
      closePrice: event.closePrice,
      closeType: event.closeType,
    });

    // 関連ポジションへの連動アクション処理
    if (event.linkedAction && event.linkedAction.relatedPositionId) {
      await handleLinkedAction(event.linkedAction);
    }

    console.log("Close record created successfully:", closeRecord.data.id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        id: closeRecord.data.id,
        positionId: event.positionId,
        status: "pending",
        executedPrice: event.closePrice,
        profit: profit,
      }),
    };
  } catch (error) {
    console.error("Error closing position:", error);
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

async function handleLinkedAction(linkedAction: Record<string, any>) {
  try {
    const { relatedPositionId, action, settings } = linkedAction;
    
    if (!relatedPositionId || !action) {
      return;
    }

    switch (action) {
      case 'close':
        // 関連ポジションの決済
        const relatedPosition = await client.models.Position.get({ id: relatedPositionId });
        if (relatedPosition.data && relatedPosition.data.status === 'open') {
          // 決済処理（再帰的に呼び出し）
          console.log("Closing related position:", relatedPositionId);
          // TODO: 実際の決済処理実装
        }
        break;
        
      case 'trail':
        // 関連ポジションのトレール開始
        await client.models.Position.update({
          id: relatedPositionId,
          trailSettings: JSON.stringify(settings),
        });
        console.log("Trail started for related position:", relatedPositionId);
        break;
        
      default:
        console.log("Unknown linked action:", action);
    }
  } catch (error) {
    console.error("Error handling linked action:", error);
    // 連動アクションのエラーは決済処理の失敗とはしない
  }
}