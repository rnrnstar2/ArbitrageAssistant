import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/updatePositionRecord";

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

interface UpdatePositionEvent {
  id: string;
  currentPrice?: number;
  profit?: number;
  swapTotal?: number;
  status?: "open" | "pending_close" | "closed";
  closedAt?: string;
  trailSettings?: Record<string, any>;
  closeSettings?: Record<string, any>;
}

export const handler = async (event: UpdatePositionEvent) => {
  try {
    console.log("Updating position record:", JSON.stringify(event));

    // バリデーション
    if (!event.id) {
      throw new Error("Position ID is required");
    }

    if (event.status && !["open", "pending_close", "closed"].includes(event.status)) {
      throw new Error("Status must be 'open', 'pending_close', or 'closed'");
    }

    // ポジション存在確認
    const existingPosition = await client.models.Position.get({ id: event.id });
    if (!existingPosition.data) {
      throw new Error("Position not found");
    }

    // 更新データの準備
    const updateData: any = {};
    
    if (event.currentPrice !== undefined) {
      updateData.currentPrice = event.currentPrice;
    }
    
    if (event.profit !== undefined) {
      updateData.profit = event.profit;
    }
    
    if (event.swapTotal !== undefined) {
      updateData.swapTotal = event.swapTotal;
    }
    
    if (event.status !== undefined) {
      updateData.status = event.status;
    }
    
    if (event.closedAt !== undefined) {
      updateData.closedAt = event.closedAt;
    }
    
    if (event.trailSettings !== undefined) {
      updateData.trailSettings = JSON.stringify(event.trailSettings);
    }
    
    if (event.closeSettings !== undefined) {
      updateData.closeSettings = JSON.stringify(event.closeSettings);
    }

    // ポジションレコード更新
    const updatedPosition = await client.models.Position.update({
      id: event.id,
      ...updateData,
    });

    if (!updatedPosition.data) {
      throw new Error("Failed to update position record");
    }

    console.log("Position record updated successfully:", updatedPosition.data.id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        positionId: updatedPosition.data.id,
        position: updatedPosition.data,
      }),
    };
  } catch (error) {
    console.error("Error updating position record:", error);
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};