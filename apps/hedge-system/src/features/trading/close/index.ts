// Types
export * from './types'

// Core logic
export { LinkedPositionDetector } from './linked-position-detector'
export { LinkedCloseExecutor } from './linked-close-executor'
export { PositionConsistencyChecker } from './position-consistency-checker'

// Components
export { LinkedPositionCloseSettings } from './LinkedPositionCloseSettings'

// Re-exports for convenience
export type { 
  Position,
  LinkedPosition,
  LinkedPositionGroup,
  LinkedCloseRequest,
  LinkedCloseResult,
  LinkedCloseAction,
  LinkedCloseSettings,
  PositionConsistencyCheck,
  ConsistencyIssue,
  RelationType
} from './types'