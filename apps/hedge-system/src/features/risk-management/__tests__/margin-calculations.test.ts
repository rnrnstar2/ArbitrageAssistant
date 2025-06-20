/**
 * Margin Calculations Test
 * 証拠金計算ユーティリティのテスト
 */

import { describe, it, expect } from 'vitest'
import {
  calculateRiskLevel,
  calculateMarginLevel,
  calculateFreeMargin,
  calculateRequiredRecovery,
  validateMarginData,
  getMarginCallThreshold
} from '../utils/margin-calculations'
import type { AccountMarginInfo } from '../types/risk-types'

describe('margin-calculations', () => {
  describe('calculateRiskLevel', () => {
    it('should return safe for margin level >= 200%', () => {
      expect(calculateRiskLevel(250)).toBe('safe')
      expect(calculateRiskLevel(200)).toBe('safe')
    })

    it('should return warning for margin level >= 150%', () => {
      expect(calculateRiskLevel(180)).toBe('warning')
      expect(calculateRiskLevel(150)).toBe('warning')
    })

    it('should return danger for margin level >= 100%', () => {
      expect(calculateRiskLevel(120)).toBe('danger')
      expect(calculateRiskLevel(100)).toBe('danger')
    })

    it('should return critical for margin level < 100%', () => {
      expect(calculateRiskLevel(80)).toBe('critical')
      expect(calculateRiskLevel(50)).toBe('critical')
    })
  })

  describe('calculateMarginLevel', () => {
    it('should calculate margin level correctly', () => {
      expect(calculateMarginLevel(1000, 500)).toBe(200) // 200%
      expect(calculateMarginLevel(750, 500)).toBe(150)  // 150%
    })

    it('should return Infinity when used margin is 0', () => {
      expect(calculateMarginLevel(1000, 0)).toBe(Infinity)
    })
  })

  describe('calculateFreeMargin', () => {
    it('should calculate free margin correctly', () => {
      expect(calculateFreeMargin(1000, 300)).toBe(700)
      expect(calculateFreeMargin(500, 200)).toBe(300)
    })

    it('should return 0 when equity is less than used margin', () => {
      expect(calculateFreeMargin(300, 500)).toBe(0)
    })
  })

  describe('calculateRequiredRecovery', () => {
    it('should calculate required recovery amount', () => {
      // 現在: equity 500, used margin 400 (125%)
      // 목표: 150% -> required equity = 400 * 1.5 = 600
      // 필요한 회복: 600 - 500 = 100
      expect(calculateRequiredRecovery(500, 400, 150)).toBe(100)
    })

    it('should return 0 when no recovery is needed', () => {
      expect(calculateRequiredRecovery(1000, 400, 150)).toBe(0)
    })
  })

  describe('validateMarginData', () => {
    const validData: AccountMarginInfo = {
      accountId: 'test-account',
      balance: 1000,
      equity: 950,
      freeMargin: 600,
      usedMargin: 350,
      marginLevel: 271.43,
      bonusAmount: 100,
      lastUpdate: new Date()
    }

    it('should return true for valid data', () => {
      expect(validateMarginData(validData)).toBe(true)
    })

    it('should return false for missing accountId', () => {
      const invalidData = { ...validData, accountId: '' }
      expect(validateMarginData(invalidData)).toBe(false)
    })

    it('should return false for negative equity', () => {
      const invalidData = { ...validData, equity: -100 }
      expect(validateMarginData(invalidData)).toBe(false)
    })

    it('should return false for negative margin level', () => {
      const invalidData = { ...validData, marginLevel: -50 }
      expect(validateMarginData(invalidData)).toBe(false)
    })
  })

  describe('getMarginCallThreshold', () => {
    it('should return specific thresholds for known brokers', () => {
      expect(getMarginCallThreshold('XM')).toEqual({
        marginCall: 50,
        losscut: 20
      })

      expect(getMarginCallThreshold('AXIORY')).toEqual({
        marginCall: 100,
        losscut: 20
      })
    })

    it('should return default thresholds for unknown brokers', () => {
      expect(getMarginCallThreshold('UNKNOWN_BROKER')).toEqual({
        marginCall: 100,
        losscut: 50
      })
    })
  })
})