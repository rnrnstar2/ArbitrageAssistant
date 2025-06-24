/**
 * React Hooks Index - MVP システム設計書準拠のリアルタイムフック
 * 
 * 注意：これらのフックはReact環境でのみ使用可能
 * Tauri環境では直接サービスクラスを使用
 */

// 📍 Position用フック
export { usePositions } from './usePositions';
export { usePosition } from './usePosition';
export { usePositionActions } from './usePositionActions';
export { useTrailPositions } from './useTrailPositions';

// ⚡ Action用フック  
export { useActions } from './useActions';
export { useAction } from './useAction';
export { useExecutingActions } from './useExecutingActions';

// 🏦 Account用フック
export { useAccounts } from './useAccounts';
export { useAccount } from './useAccount';
export { useCreditUtilization } from './useCreditUtilization';

// 👥 User用フック
export { useCurrentUser } from './useCurrentUser';
export { useUserStatus } from './useUserStatus';

// 📡 リアルタイム購読フック
export { useRealtimePositions } from './useRealtimePositions';
export { useRealtimeActions } from './useRealtimeActions';
export { useSystemCoordination } from './useSystemCoordination';

// 🎯 統合フック
export { useDashboardData } from './useDashboardData';
export { useHedgeAnalysis } from './useHedgeAnalysis';