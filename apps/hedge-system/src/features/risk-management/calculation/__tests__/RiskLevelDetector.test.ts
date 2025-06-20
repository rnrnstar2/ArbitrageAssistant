import { describe, it, expect, beforeEach } from 'vitest';
import { RiskLevelDetector } from '../RiskLevelDetector';
import { MarginLevelCalculator } from '../MarginLevelCalculator';
import type { 
  RiskLevel, 
  RiskThresholds, 
  RiskDetectionConfig,
  RiskLevelResult 
} from '../RiskLevelDetector';
import type { MarginCalculation } from '../MarginLevelCalculator';

describe('RiskLevelDetector', () => {
  let detector: RiskLevelDetector;
  let mockCalculation: MarginCalculation;
  let customThresholds: RiskThresholds;

  beforeEach(() => {
    detector = new RiskLevelDetector();
    
    customThresholds = {
      critical: 20,
      danger: 50,
      warning: 100,
      safe: 150,
    };

    mockCalculation = {
      marginLevel: 200,
      freeMargin: 8000,
      effectiveEquity: 10000,
      bonusAdjustedMargin: 180,
      realBalance: 9500,
      totalProfit: 500,
      marginUsed: 2000,
      availableMargin: 8000,
      calculatedAt: new Date(),
      accountId: 'test-account-001',
      currency: 'USD',
      leverage: 100,
    };
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const config = detector.getConfig();
      
      expect(config.thresholds.critical).toBe(20);
      expect(config.thresholds.danger).toBe(50);
      expect(config.thresholds.warning).toBe(100);
      expect(config.thresholds.safe).toBe(150);
      expect(config.enablePrediction).toBe(true);
      expect(config.includeBonus).toBe(true);
    });

    it('should initialize with custom config', () => {
      const customConfig: Partial<RiskDetectionConfig> = {
        thresholds: { critical: 15, danger: 40, warning: 80, safe: 120 },
        enablePrediction: false,
        includeBonus: false,
      };

      const customDetector = new RiskLevelDetector(customConfig);
      const config = customDetector.getConfig();

      expect(config.thresholds.critical).toBe(15);
      expect(config.enablePrediction).toBe(false);
      expect(config.includeBonus).toBe(false);
    });
  });

  describe('detectRiskLevel', () => {
    it('should detect safe level for high margin', () => {
      const result = detector.detectRiskLevel(mockCalculation);

      expect(result.level).toBe('safe');
      expect(result.marginLevel).toBe(200);
      expect(result.severity).toBe('info');
      expect(result.message).toContain('安全');
    });

    it('should detect warning level for moderate margin', () => {
      const warningCalculation = { ...mockCalculation, marginLevel: 80 };
      const result = detector.detectRiskLevel(warningCalculation);

      expect(result.level).toBe('warning');
      expect(result.severity).toBe('warning');
      expect(result.message).toContain('警告');
    });

    it('should detect danger level for low margin', () => {
      const dangerCalculation = { ...mockCalculation, marginLevel: 40 };
      const result = detector.detectRiskLevel(dangerCalculation);

      expect(result.level).toBe('danger');
      expect(result.severity).toBe('danger');
      expect(result.message).toContain('危険');
    });

    it('should detect critical level for very low margin', () => {
      const criticalCalculation = { ...mockCalculation, marginLevel: 15 };
      const result = detector.detectRiskLevel(criticalCalculation);

      expect(result.level).toBe('critical');
      expect(result.severity).toBe('critical');
      expect(result.message).toContain('緊急');
    });

    it('should use bonus adjusted margin when includeBonus is false', () => {
      const config: Partial<RiskDetectionConfig> = { includeBonus: false };
      const detectorWithoutBonus = new RiskLevelDetector(config);
      
      const calculation = {
        ...mockCalculation,
        marginLevel: 200,        // high with bonus
        bonusAdjustedMargin: 40, // low without bonus
      };

      const result = detectorWithoutBonus.detectRiskLevel(calculation);

      expect(result.level).toBe('danger'); // based on bonusAdjustedMargin (40)
      expect(result.marginLevel).toBe(40);
    });

    it('should include prediction data for danger/critical levels', () => {
      const dangerCalculation = { 
        ...mockCalculation, 
        marginLevel: 40,
        totalProfit: -1000, // negative profit for prediction
      };
      
      const result = detector.detectRiskLevel(dangerCalculation, 'XM');

      expect(result.timeToLossCut).toBeDefined();
      expect(result.requiredRecoveryAmount).toBeDefined();
    });

    it('should handle broker-specific losscut levels', () => {
      const calculation = { ...mockCalculation, marginLevel: 15 };
      
      // XM has 20% losscut level
      const resultXM = detector.detectRiskLevel(calculation, 'XM');
      
      // Exness has 0% losscut level  
      const resultExness = detector.detectRiskLevel(calculation, 'Exness');

      expect(resultXM.requiredRecoveryAmount).toBeDefined();
      expect(resultExness.requiredRecoveryAmount).toBeDefined();
    });
  });

  describe('detectRiskChange', () => {
    it('should detect risk level change', () => {
      const previousCalculation = { ...mockCalculation, marginLevel: 200 }; // safe
      const currentCalculation = { 
        ...mockCalculation, 
        marginLevel: 80,  // warning
        calculatedAt: new Date(Date.now() + 60000), // 1 minute later
      };

      const change = detector.detectRiskChange(currentCalculation, previousCalculation);

      expect(change.levelChanged).toBe(true);
      expect(change.previousLevel).toBe('safe');
      expect(change.currentLevel).toBe('warning');
      expect(change.isDeteriorate).toBe(true);
      expect(change.isImproving).toBe(false);
      expect(change.marginChange).toBe(-120); // 80 - 200
    });

    it('should detect improving risk', () => {
      const previousCalculation = { ...mockCalculation, marginLevel: 30 }; // danger
      const currentCalculation = { 
        ...mockCalculation, 
        marginLevel: 120, // warning
        calculatedAt: new Date(Date.now() + 60000),
      };

      const change = detector.detectRiskChange(currentCalculation, previousCalculation);

      expect(change.isImproving).toBe(true);
      expect(change.isDeteriorate).toBe(false);
      expect(change.marginChange).toBe(90);
    });

    it('should calculate change rate correctly', () => {
      const previousCalculation = { 
        ...mockCalculation, 
        marginLevel: 200,
        calculatedAt: new Date(Date.now() - 120000), // 2 minutes ago
      };
      const currentCalculation = { 
        ...mockCalculation, 
        marginLevel: 160,
        calculatedAt: new Date(),
      };

      const change = detector.detectRiskChange(currentCalculation, previousCalculation);

      // Change rate = (160 - 200) / 2 minutes = -20% per minute
      expect(change.changeRate).toBeCloseTo(-20, 1);
    });
  });

  describe('detectMultipleAccountRisks', () => {
    it('should detect risks for multiple accounts', () => {
      const calculations = [
        {
          calculation: { ...mockCalculation, marginLevel: 200, accountId: 'account1' },
          brokerName: 'XM',
          accountId: 'account1',
        },
        {
          calculation: { ...mockCalculation, marginLevel: 30, accountId: 'account2' },
          brokerName: 'FXGT',
          accountId: 'account2',
        },
      ];

      const results = detector.detectMultipleAccountRisks(calculations);

      expect(results).toHaveLength(2);
      expect(results[0].level).toBe('safe');
      expect(results[1].level).toBe('danger');
    });
  });

  describe('requiresEmergencyAlert', () => {
    it('should require emergency alert for critical level', () => {
      const criticalResult: RiskLevelResult = {
        level: 'critical',
        marginLevel: 15,
        threshold: 20,
        message: 'Critical alert',
        severity: 'critical',
      };

      expect(detector.requiresEmergencyAlert(criticalResult)).toBe(true);
    });

    it('should require emergency alert for danger level with short time to losscut', () => {
      const dangerResult: RiskLevelResult = {
        level: 'danger',
        marginLevel: 40,
        threshold: 50,
        message: 'Danger alert',
        severity: 'danger',
        timeToLossCut: 3, // 3 minutes
      };

      expect(detector.requiresEmergencyAlert(dangerResult)).toBe(true);
    });

    it('should not require emergency alert for warning level', () => {
      const warningResult: RiskLevelResult = {
        level: 'warning',
        marginLevel: 80,
        threshold: 100,
        message: 'Warning alert',
        severity: 'warning',
      };

      expect(detector.requiresEmergencyAlert(warningResult)).toBe(false);
    });
  });

  describe('createMarginLevelAlert', () => {
    it('should create margin level alert correctly', () => {
      const riskResult: RiskLevelResult = {
        level: 'danger',
        marginLevel: 40,
        threshold: 50,
        message: 'Danger alert',
        severity: 'danger',
      };

      const alert = detector.createMarginLevelAlert(riskResult, 'test-account', 300);

      expect(alert.type).toBe('margin_level');
      expect(alert.threshold).toBe(50);
      expect(alert.severity).toBe('danger');
      expect(alert.cooldownPeriod).toBe(300);
      expect(alert.accountId).toBe('test-account');
      expect(alert.comparison).toBe('less_than');
      expect(alert.includeBonus).toBe(true);
    });
  });

  describe('createRiskAlertState', () => {
    it('should create risk alert state correctly', () => {
      const riskResult: RiskLevelResult = {
        level: 'critical',
        marginLevel: 15,
        threshold: 20,
        message: 'Critical alert',
        severity: 'critical',
        timeToLossCut: 5,
        requiredRecoveryAmount: 1000,
        affectedPositions: ['all'],
      };

      const alertState = detector.createRiskAlertState(riskResult, 'test-account', 'condition-123');

      expect(alertState.conditionId).toBe('condition-123');
      expect(alertState.accountId).toBe('test-account');
      expect(alertState.type).toBe('margin_level');
      expect(alertState.severity).toBe('critical');
      expect(alertState.value).toBe(15);
      expect(alertState.threshold).toBe(20);
      expect(alertState.isAcknowledged).toBe(false);
      expect(alertState.metadata?.timeToLossCut).toBe(5);
      expect(alertState.metadata?.requiredRecoveryAmount).toBe(1000);
    });
  });

  describe('configuration management', () => {
    it('should update broker losscut level', () => {
      detector.updateBrokerLossCutLevel('CustomBroker', 30);
      const config = detector.getConfig();

      expect(config.brokerLossCutLevels['CustomBroker']).toBe(30);
    });

    it('should update account thresholds', () => {
      const customThresholds: RiskThresholds = {
        critical: 15,
        danger: 40,
        warning: 80,
        safe: 120,
      };

      detector.updateAccountThresholds('special-account', customThresholds);
      const config = detector.getConfig();

      expect(config.customThresholds?.['special-account']).toEqual(customThresholds);
    });

    it('should use account-specific thresholds when available', () => {
      const accountThresholds: RiskThresholds = {
        critical: 15,
        danger: 40,
        warning: 80,
        safe: 120,
      };

      detector.updateAccountThresholds('special-account', accountThresholds);
      
      const calculation = { ...mockCalculation, marginLevel: 70 };
      const result = detector.detectRiskLevel(calculation, undefined, 'special-account');

      // With custom thresholds, 70% should be warning (< 80), not safe
      expect(result.level).toBe('warning');
    });

    it('should reset to defaults', () => {
      // Modify config
      detector.updateBrokerLossCutLevel('TestBroker', 99);
      detector.updateAccountThresholds('test', { critical: 1, danger: 2, warning: 3, safe: 4 });
      
      // Reset
      detector.resetToDefaults();
      const config = detector.getConfig();

      // After reset, custom modifications should be gone
      expect(config.brokerLossCutLevels['TestBroker']).toBeUndefined();
      expect(config.customThresholds).toEqual({});
      expect(config.thresholds.critical).toBe(20);
      expect(config.enablePrediction).toBe(true);
      expect(config.includeBonus).toBe(true);
    });

    it('should update config partially', () => {
      const newConfig: Partial<RiskDetectionConfig> = {
        enablePrediction: false,
        includeBonus: false,
      };

      detector.updateConfig(newConfig);
      const config = detector.getConfig();

      expect(config.enablePrediction).toBe(false);
      expect(config.includeBonus).toBe(false);
      // Other values should remain unchanged
      expect(config.thresholds.critical).toBe(20);
    });
  });

  describe('edge cases', () => {
    it('should handle zero margin used gracefully', () => {
      const zeroMarginCalculation = { ...mockCalculation, marginUsed: 0, marginLevel: 999999 };
      const result = detector.detectRiskLevel(zeroMarginCalculation);

      expect(result.level).toBe('safe');
      expect(result.affectedPositions).toEqual([]);
    });

    it('should handle negative profit in prediction', () => {
      const lossCalculation = { 
        ...mockCalculation, 
        marginLevel: 30,
        totalProfit: -2000,
        marginUsed: 8000,  // Increase marginUsed to make recovery amount > 0
        effectiveEquity: 2400,  // Set low equity to match 30% margin level
      };
      
      const result = detector.detectRiskLevel(lossCalculation, 'XM');

      expect(result.timeToLossCut).toBeDefined();
      expect(result.requiredRecoveryAmount).toBeGreaterThan(0);
    });

    it('should handle unknown broker gracefully', () => {
      const calculation = { ...mockCalculation, marginLevel: 15 };
      const result = detector.detectRiskLevel(calculation, 'UnknownBroker');

      // Should use default losscut level
      expect(result.requiredRecoveryAmount).toBeDefined();
    });
  });
});