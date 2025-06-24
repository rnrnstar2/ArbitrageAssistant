/**
 * WebSocket Handler - MVP簡略版
 */
export class WebSocketHandler {
  private connected = false;
  
  async connect() {
    this.connected = true;
    console.log('✅ WebSocket connected');
  }
  
  async disconnect() {
    this.connected = false;
    console.log('🔌 WebSocket disconnected');
  }
  
  isConnected() {
    return this.connected;
  }
}

export const webSocketHandler = new WebSocketHandler();