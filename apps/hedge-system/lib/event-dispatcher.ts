import { SyncEvent } from './sync-manager.js';

export type EventHandler = (event: SyncEvent) => Promise<void> | void;

export class EventDispatcher {
  private handlers: Map<string, EventHandler[]> = new Map();
  
  subscribe(eventKey: string, handler: EventHandler): () => void {
    const handlers = this.handlers.get(eventKey) || [];
    handlers.push(handler);
    this.handlers.set(eventKey, handlers);
    
    // Unsubscribe function
    return () => {
      const currentHandlers = this.handlers.get(eventKey) || [];
      const index = currentHandlers.indexOf(handler);
      if (index > -1) {
        currentHandlers.splice(index, 1);
        this.handlers.set(eventKey, currentHandlers);
      }
    };
  }
  
  dispatch(event: SyncEvent): void {
    const eventKey = `${event.entity}:${event.type}`;
    const handlers = this.handlers.get(eventKey) || [];
    
    handlers.forEach(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${eventKey}:`, error);
      }
    });
    
    // 全てのイベントハンドラーにも通知
    const allHandlers = this.handlers.get('*') || [];
    allHandlers.forEach(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error in global event handler:', error);
      }
    });
  }
  
  // 便利なメソッド：特定のエンティティタイプのイベントを購読
  subscribeToEntity(entity: SyncEvent['entity'], handler: EventHandler): () => void {
    const eventKeys = ['CREATE', 'UPDATE', 'DELETE'].map(type => `${entity}:${type}`);
    const unsubscribeFunctions: (() => void)[] = [];
    
    eventKeys.forEach(eventKey => {
      const unsubscribe = this.subscribe(eventKey, handler);
      unsubscribeFunctions.push(unsubscribe);
    });
    
    // 全てのサブスクリプションを解除する関数を返す
    return () => {
      unsubscribeFunctions.forEach(fn => fn());
    };
  }
  
  // 便利なメソッド：特定のオペレーションタイプのイベントを購読
  subscribeToOperationType(type: SyncEvent['type'], handler: EventHandler): () => void {
    const eventKeys = ['position', 'strategy', 'action'].map(entity => `${entity}:${type}`);
    const unsubscribeFunctions: (() => void)[] = [];
    
    eventKeys.forEach(eventKey => {
      const unsubscribe = this.subscribe(eventKey, handler);
      unsubscribeFunctions.push(unsubscribe);
    });
    
    return () => {
      unsubscribeFunctions.forEach(fn => fn());
    };
  }
  
  // 便利なメソッド：グローバルイベントハンドラーを購読
  subscribeToAll(handler: EventHandler): () => void {
    return this.subscribe('*', handler);
  }
  
  // デバッグ用：現在のハンドラー数を取得
  getHandlerCount(): number {
    let count = 0;
    this.handlers.forEach(handlers => {
      count += handlers.length;
    });
    return count;
  }
  
  // デバッグ用：登録されているイベントキーのリストを取得
  getRegisteredEventKeys(): string[] {
    return Array.from(this.handlers.keys());
  }
  
  // 全てのハンドラーをクリア
  clear(): void {
    this.handlers.clear();
  }
  
  // 特定のイベントキーのハンドラーをクリア
  clearEventKey(eventKey: string): void {
    this.handlers.delete(eventKey);
  }
}