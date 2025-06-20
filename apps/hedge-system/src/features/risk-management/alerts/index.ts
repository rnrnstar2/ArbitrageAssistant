export { RiskAlertManager } from './RiskAlertManager';
export { AlertDispatcher } from './AlertDispatcher';
export { RiskAlertSystem } from './RiskAlertSystem';
export * from './types';

// デフォルトエクスポート用のファクトリー関数
export function createRiskAlertSystem() {
  return new RiskAlertSystem();
}