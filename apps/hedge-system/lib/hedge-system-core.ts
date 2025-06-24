/**
 * Hedge System Core - MVP簡略版  
 */
export class HedgeSystemCore {
  private isRunning = false;
  
  async start() {
    this.isRunning = true;
    console.log('✅ Hedge System Core started');
  }
  
  async stop() {
    this.isRunning = false;
    console.log('⏹️ Hedge System Core stopped');
  }
  
  getStatus() {
    return this.isRunning ? 'RUNNING' : 'STOPPED';
  }
}

export const hedgeSystemCore = new HedgeSystemCore();