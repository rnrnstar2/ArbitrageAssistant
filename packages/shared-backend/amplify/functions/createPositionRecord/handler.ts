import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/createPositionRecord";

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

interface CreatePositionEvent {
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

export const handler = async (event: CreatePositionEvent) => {
  try {
    console.log("Creating position record:", JSON.stringify(event));

    // バリデーション
    if (!event.accountId || !event.symbol || !event.type || !event.lots) {
      throw new Error("Required fields missing");
    }

    if (event.lots <= 0) {
      throw new Error("Lots must be greater than 0");
    }

    if (!["buy", "sell"].includes(event.type)) {
      throw new Error("Type must be 'buy' or 'sell'");
    }

    if (!["open", "pending_close", "closed"].includes(event.status)) {
      throw new Error("Status must be 'open', 'pending_close', or 'closed'");
    }

    // アカウント存在確認
    const account = await client.models.Account.get({ id: event.accountId });
    if (!account.data) {
      throw new Error("Account not found");
    }

    // ポジションレコード作成
    const position = await client.models.Position.create({
      accountId: event.accountId,
      symbol: event.symbol,
      type: event.type,
      lots: event.lots,
      openPrice: event.openPrice,
      currentPrice: event.currentPrice,
      profit: event.profit,
      status: event.status,
      openedAt: event.openedAt,
      trailSettings: event.trailSettings ? JSON.stringify(event.trailSettings) : undefined,
      closeSettings: event.closeSettings ? JSON.stringify(event.closeSettings) : undefined,
      relatedPositionId: event.relatedPositionId,
    });

    if (!position.data) {
      throw new Error("Failed to create position record");
    }

    console.log("Position record created successfully:", position.data.id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        positionId: position.data.id,
        position: position.data,
      }),
    };
  } catch (error) {
    console.error("Error creating position record:", error);
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};