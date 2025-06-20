import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/create-entry";

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

interface CreateEntryEvent {
  accountId: string;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  price?: number;
  trailSettings?: Record<string, any>;
  hedgeSettings?: Record<string, any>;
}

export const handler = async (event: CreateEntryEvent) => {
  try {
    console.log("Creating entry:", JSON.stringify(event));

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

    // アカウント存在確認
    const account = await client.models.Account.get({ id: event.accountId });
    if (!account.data) {
      throw new Error("Account not found");
    }

    // エントリーレコード作成
    const entry = await client.models.Entry.create({
      accountId: event.accountId,
      symbol: event.symbol,
      type: event.type,
      lots: event.lots,
      price: event.price,
      trailSettings: event.trailSettings ? JSON.stringify(event.trailSettings) : undefined,
      hedgeSettings: event.hedgeSettings ? JSON.stringify(event.hedgeSettings) : undefined,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    if (!entry.data) {
      throw new Error("Failed to create entry record");
    }

    // TODO: WebSocket経由でEAにコマンド送信
    // この部分は後でWebSocket基盤が完成してから実装

    console.log("Entry created successfully:", entry.data.id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        entryId: entry.data.id,
        status: "pending",
      }),
    };
  } catch (error) {
    console.error("Error creating entry:", error);
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};