/**
 * System Manager - MVP簡略版
 */
import { getCurrentUserId } from '@repo/shared-amplify/client';

export class SystemManager {
  private isRunning = false;
  
  async initialize() {
    console.log('✅ System Manager initialized');
    return true;
  }
  
  async start() {
    this.isRunning = true;
    console.log('✅ System Manager started');
    return true;
  }
  
  async stop() {
    this.isRunning = false;
    console.log('⏹️ System Manager stopped');
    return true;
  }
  
  getStatus() {
    return this.isRunning ? 'RUNNING' : 'STOPPED';
  }
  
  async getCurrentUserId() {
    return getCurrentUserId();
  }
}

export const systemManager = new SystemManager();