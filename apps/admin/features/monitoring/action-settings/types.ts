// Position types (既存のtypesと整合性を保つ)
export interface Position {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  marginLevel?: number;
  accountId: string;
  openTime: Date;
}

// Trigger condition types
export interface TriggerCondition {
  type: 'margin_level' | 'loss_amount' | 'profit_target' | 'time_based';
  threshold: number;
  condition: 'above' | 'below' | 'equals';
  timeframe?: 'minutes' | 'hours' | 'days'; // time_basedの場合
}

// Action step types
export interface ActionStep {
  type: 'close_position' | 'open_hedge' | 'rebalance' | 'notify' | 'trail_stop';
  parameters: Record<string, any>;
  priority: number;
  targetAccountId?: string;
  rollbackAction?: ActionStep;
}

// Action settings for a position
export interface ActionSettings {
  positionId: string;
  trigger: TriggerCondition;
  actions: ActionStep[];
  isActive: boolean;
  executionMode: 'sequential' | 'parallel';
  createdAt?: Date;
  updatedAt?: Date;
  lastTriggered?: Date;
  triggerCount?: number;
}

// Preset template
export interface ActionPreset {
  id: string;
  name: string;
  description: string;
  trigger: TriggerCondition;
  actions: ActionStep[];
  executionMode: 'sequential' | 'parallel';
  category: 'risk_management' | 'profit_taking' | 'rebalancing' | 'custom';
  createdAt: Date;
  isBuiltIn: boolean;
}

// Form data types
export interface ActionSettingsFormData {
  positionId: string;
  trigger: {
    type: 'margin_level' | 'loss_amount' | 'profit_target' | 'time_based';
    threshold: number;
    condition: 'above' | 'below' | 'equals';
    timeframe?: 'minutes' | 'hours' | 'days';
  };
  actions: {
    type: 'close_position' | 'open_hedge' | 'rebalance' | 'notify' | 'trail_stop';
    parameters: Record<string, any>;
    priority: number;
    targetAccountId?: string;
  }[];
  isActive: boolean;
  executionMode: 'sequential' | 'parallel';
}

// Action execution result
export interface ActionExecutionResult {
  actionId: string;
  positionId: string;
  status: 'success' | 'failure' | 'partial' | 'pending';
  result?: any;
  error?: string;
  executedAt: Date;
  executionTime: number; // milliseconds
}

// Action execution request
export interface ActionExecutionRequest {
  positionId: string;
  settings: ActionSettings;
  context: {
    currentMarginLevel?: number;
    currentProfit?: number;
    triggeredBy: 'manual' | 'auto' | 'emergency';
    timestamp: Date;
  };
}

// Preset application request
export interface PresetApplicationRequest {
  positionIds: string[];
  preset: ActionPreset;
  overrides?: Partial<ActionSettings>;
}

// Action history
export interface ActionHistory {
  id: string;
  positionId: string;
  actionType: string;
  triggerCondition: TriggerCondition;
  executionResults: ActionExecutionResult[];
  totalExecutionTime: number;
  success: boolean;
  createdAt: Date;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Risk analysis result
export interface RiskAnalysisResult {
  positionId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  marginLevel: number;
  timeToLosscut?: number; // minutes
  recommendations: string[];
  actionSuggestions: ActionStep[];
}

// Bulk operation result
export interface BulkOperationResult {
  total: number;
  success: number;
  failed: number;
  errors: { positionId: string; error: string }[];
}

// Built-in presets
export const BUILT_IN_PRESETS: ActionPreset[] = [
  {
    id: 'emergency-losscut',
    name: '緊急ロスカット対応',
    description: '証拠金維持率が危険レベルに達した時の緊急対応',
    trigger: {
      type: 'margin_level',
      threshold: 120,
      condition: 'below'
    },
    actions: [
      {
        type: 'notify',
        parameters: { message: '緊急ロスカット警告', priority: 'high' },
        priority: 1
      },
      {
        type: 'close_position',
        parameters: { closeType: 'market', partial: false },
        priority: 2
      }
    ],
    executionMode: 'sequential',
    category: 'risk_management',
    createdAt: new Date('2024-01-01'),
    isBuiltIn: true
  },
  {
    id: 'profit-secure',
    name: '利益確保',
    description: '目標利益に達した時の利益確定',
    trigger: {
      type: 'profit_target',
      threshold: 100,
      condition: 'above'
    },
    actions: [
      {
        type: 'trail_stop',
        parameters: { trailPips: 20, startPips: 30 },
        priority: 1
      }
    ],
    executionMode: 'sequential',
    category: 'profit_taking',
    createdAt: new Date('2024-01-01'),
    isBuiltIn: true
  },
  {
    id: 'loss-limit',
    name: '損失制限',
    description: '許容損失額に達した時の損切り',
    trigger: {
      type: 'loss_amount',
      threshold: -50,
      condition: 'below'
    },
    actions: [
      {
        type: 'close_position',
        parameters: { closeType: 'market' },
        priority: 1
      },
      {
        type: 'notify',
        parameters: { message: '損切り実行' },
        priority: 2
      }
    ],
    executionMode: 'sequential',
    category: 'risk_management',
    createdAt: new Date('2024-01-01'),
    isBuiltIn: true
  }
];

// Action type configurations
export const ACTION_TYPE_CONFIGS = {
  close_position: {
    label: 'ポジション決済',
    description: 'ポジションを決済します',
    requiredParams: ['closeType'],
    optionalParams: ['targetPrice', 'partial', 'lots']
  },
  open_hedge: {
    label: 'ヘッジオープン',
    description: '反対ポジションを開きます',
    requiredParams: ['lots'],
    optionalParams: ['targetPrice', 'slippage']
  },
  rebalance: {
    label: 'リバランス',
    description: 'ポートフォリオをリバランスします',
    requiredParams: ['targetAccountId'],
    optionalParams: ['amount', 'percentage']
  },
  notify: {
    label: '通知',
    description: '通知を送信します',
    requiredParams: ['message'],
    optionalParams: ['priority', 'channels']
  },
  trail_stop: {
    label: 'トレールストップ',
    description: 'トレールストップを設定します',
    requiredParams: ['trailPips'],
    optionalParams: ['startPips', 'maxPips']
  }
};

// Trigger type configurations
export const TRIGGER_TYPE_CONFIGS = {
  margin_level: {
    label: '証拠金維持率',
    description: '証拠金維持率をトリガーとします',
    unit: '%',
    min: 100,
    max: 1000
  },
  loss_amount: {
    label: '損失額',
    description: '損失額をトリガーとします',
    unit: '$',
    min: -10000,
    max: 0
  },
  profit_target: {
    label: '利益目標',
    description: '利益額をトリガーとします',
    unit: '$',
    min: 0,
    max: 10000
  },
  time_based: {
    label: '時間ベース',
    description: '時間経過をトリガーとします',
    unit: '時間',
    min: 1,
    max: 168
  }
};