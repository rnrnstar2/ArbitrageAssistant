import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE_NAME || "websocket-connections";

interface WebSocketMessage {
  type: "position_update" | "account_update" | "command" | "heartbeat" | "auth";
  payload: any;
  timestamp: number;
  clientId?: string;
}

interface ConnectionRecord {
  connectionId: string;
  clientId?: string;
  userId?: string;
  connectedAt: number;
  lastHeartbeat: number;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const { routeKey, connectionId } = event.requestContext;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  console.log(`Route: ${routeKey}, Connection: ${connectionId}`);

  try {
    switch (routeKey) {
      case "$connect":
        return await handleConnect(connectionId!);
      case "$disconnect":
        return await handleDisconnect(connectionId!);
      case "$default":
        if (!domainName || !stage) {
          console.error("Missing domainName or stage");
          return { statusCode: 400, body: "Missing required parameters" };
        }
        return await handleMessage(event, domainName, stage);
      default:
        return { statusCode: 200, body: "OK" };
    }
  } catch (error) {
    console.error("WebSocket handler error:", error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

async function handleConnect(connectionId: string): Promise<{ statusCode: number; body: string }> {
  const connectionRecord: ConnectionRecord = {
    connectionId,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: connectionRecord,
      })
    );

    console.log(`Connection ${connectionId} stored successfully`);
    return { statusCode: 200, body: "Connected" };
  } catch (error) {
    console.error("Error storing connection:", error);
    return { statusCode: 500, body: "Connection failed" };
  }
}

async function handleDisconnect(connectionId: string): Promise<{ statusCode: number; body: string }> {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
      })
    );

    console.log(`Connection ${connectionId} removed successfully`);
    return { statusCode: 200, body: "Disconnected" };
  } catch (error) {
    console.error("Error removing connection:", error);
    return { statusCode: 500, body: "Disconnect failed" };
  }
}

async function handleMessage(
  event: any,
  domainName: string,
  stage: string
): Promise<{ statusCode: number; body: string }> {
  const connectionId = event.requestContext.connectionId;
  const message: WebSocketMessage = JSON.parse(event.body || "{}");

  console.log(`Received message type: ${message.type} from ${connectionId}`);

  try {
    switch (message.type) {
      case "auth":
        return await handleAuth(connectionId, message);
      case "heartbeat":
        return await handleHeartbeat(connectionId);
      case "position_update":
      case "account_update":
        return await broadcastToAdmins(message, domainName, stage, connectionId);
      case "command":
        return await sendToClient(message, domainName, stage);
      default:
        console.log(`Unknown message type: ${message.type}`);
        return { statusCode: 400, body: "Unknown message type" };
    }
  } catch (error) {
    console.error("Error handling message:", error);
    return { statusCode: 500, body: "Message handling failed" };
  }
}

async function handleAuth(
  connectionId: string,
  message: WebSocketMessage
): Promise<{ statusCode: number; body: string }> {
  const { clientId, userId } = message.payload;

  try {
    await docClient.send(
      new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: {
          connectionId,
          clientId,
          userId,
          connectedAt: Date.now(),
          lastHeartbeat: Date.now(),
        },
      })
    );

    console.log(`Authentication successful for connection ${connectionId}, clientId: ${clientId}`);
    return { statusCode: 200, body: "Authenticated" };
  } catch (error) {
    console.error("Error updating connection with auth info:", error);
    return { statusCode: 500, body: "Authentication failed" };
  }
}

async function handleHeartbeat(connectionId: string): Promise<{ statusCode: number; body: string }> {
  try {
    // Update lastHeartbeat timestamp
    await docClient.send(
      new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: {
          connectionId,
          lastHeartbeat: Date.now(),
        },
        // Preserve existing attributes
        ConditionExpression: "attribute_exists(connectionId)",
      })
    );

    return { statusCode: 200, body: "Heartbeat updated" };
  } catch (error) {
    console.error("Error updating heartbeat:", error);
    return { statusCode: 500, body: "Heartbeat failed" };
  }
}

async function broadcastToAdmins(
  message: WebSocketMessage,
  domainName: string,
  stage: string,
  senderConnectionId: string
): Promise<{ statusCode: number; body: string }> {
  try {
    // Get all admin connections (for now, broadcast to all connections except sender)
    const connections = await getAllConnections();
    const adminConnections = connections.filter(
      (conn) => conn.connectionId !== senderConnectionId
    );

    const apiGatewayClient = new ApiGatewayManagementApiClient({
      endpoint: `https://${domainName}/${stage}`,
    });

    const sendPromises = adminConnections.map(async (connection) => {
      try {
        await apiGatewayClient.send(
          new PostToConnectionCommand({
            ConnectionId: connection.connectionId,
            Data: JSON.stringify(message),
          })
        );
      } catch (error: any) {
        // Remove stale connections
        if (error.statusCode === 410) {
          await docClient.send(
            new DeleteCommand({
              TableName: CONNECTIONS_TABLE,
              Key: { connectionId: connection.connectionId },
            })
          );
        }
        console.error(`Error sending to ${connection.connectionId}:`, error);
      }
    });

    await Promise.allSettled(sendPromises);
    return { statusCode: 200, body: "Message broadcasted" };
  } catch (error) {
    console.error("Error broadcasting to admins:", error);
    return { statusCode: 500, body: "Broadcast failed" };
  }
}

async function sendToClient(
  message: WebSocketMessage,
  domainName: string,
  stage: string
): Promise<{ statusCode: number; body: string }> {
  const targetClientId = message.payload.targetClientId;

  if (!targetClientId) {
    console.error("No targetClientId specified for command");
    return { statusCode: 400, body: "No targetClientId specified" };
  }

  try {
    const connections = await getAllConnections();
    const targetConnection = connections.find((conn) => conn.clientId === targetClientId);

    if (!targetConnection) {
      console.error(`Target client ${targetClientId} not found`);
      return { statusCode: 404, body: "Target client not found" };
    }

    const apiGatewayClient = new ApiGatewayManagementApiClient({
      endpoint: `https://${domainName}/${stage}`,
    });

    await apiGatewayClient.send(
      new PostToConnectionCommand({
        ConnectionId: targetConnection.connectionId,
        Data: JSON.stringify(message),
      })
    );

    return { statusCode: 200, body: "Message sent" };
  } catch (error: any) {
    if (error.statusCode === 410) {
      // Remove stale connection
      const connections = await getAllConnections();
      const staleConnection = connections.find((conn) => conn.clientId === targetClientId);
      if (staleConnection) {
        await docClient.send(
          new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: staleConnection.connectionId },
          })
        );
      }
    }
    console.error("Error sending to client:", error);
    return { statusCode: 500, body: "Send failed" };
  }
}

async function getAllConnections(): Promise<ConnectionRecord[]> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: CONNECTIONS_TABLE,
      })
    );

    return (result.Items as ConnectionRecord[]) || [];
  } catch (error) {
    console.error("Error getting connections:", error);
    return [];
  }
}