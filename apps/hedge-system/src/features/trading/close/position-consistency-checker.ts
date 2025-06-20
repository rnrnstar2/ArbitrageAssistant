import { 
  Position, 
  PositionConsistencyCheck, 
  ConsistencyIssue, 
  LinkedPositionGroup,
  RelationType 
} from './types'
import { LinkedPositionDetector } from './linked-position-detector'

export class PositionConsistencyChecker {
  // 許容価格差率（％）
  private static readonly PRICE_DIVERGENCE_THRESHOLD = 0.1
  // 許容ロット差（絶対値）
  private static readonly LOT_MISMATCH_THRESHOLD = 0.01
  // 長期保有の判定時間（時間）
  private static readonly LONG_HOLDING_THRESHOLD_HOURS = 24

  /**
   * ポジション群の整合性チェック
   */
  static checkPositionConsistency(positions: Position[]): PositionConsistencyCheck {
    const issues: ConsistencyIssue[] = []
    let totalExposure = 0
    let riskLevel: 'low' | 'medium' | 'high' = 'low'

    // ポジションをグループ化
    const groups = LinkedPositionDetector.createLinkedPositionGroups(positions)

    // 各グループの整合性をチェック
    for (const group of groups) {
      const groupIssues = this.checkGroupConsistency(group)
      issues.push(...groupIssues)
      totalExposure += group.totalExposure
    }

    // 単独ポジションのチェック
    const groupedPositionIds = new Set(
      groups.flatMap(g => [g.primaryPosition.id, ...g.linkedPositions.map(lp => lp.position.id)])
    )
    
    const soloPositions = positions.filter(p => !groupedPositionIds.has(p.id))
    for (const position of soloPositions) {
      const soloIssues = this.checkSoloPositionIssues(position)
      issues.push(...soloIssues)
      totalExposure += position.lots
    }

    // 全体的なリスクレベルを判定
    riskLevel = this.calculateOverallRiskLevel(positions, issues, totalExposure)

    return {
      isConsistent: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      totalExposure,
      riskLevel
    }
  }

  /**
   * グループ整合性チェック
   */
  private static checkGroupConsistency(group: LinkedPositionGroup): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = []

    // 両建てポジションの整合性チェック
    const hedgePositions = group.linkedPositions.filter(lp => lp.relationType === RelationType.HEDGE)
    
    for (const hedgePos of hedgePositions) {
      issues.push(...this.checkHedgeConsistency(group.primaryPosition, hedgePos.position))
    }

    // 同一ペアポジションのリスクチェック
    const samePairPositions = group.linkedPositions.filter(lp => lp.relationType === RelationType.SAME_PAIR)
    
    if (samePairPositions.length > 0) {
      issues.push(...this.checkSamePairRisk(group.primaryPosition, samePairPositions.map(sp => sp.position)))
    }

    // 相関ポジションの集中リスクチェック
    const correlationPositions = group.linkedPositions.filter(lp => lp.relationType === RelationType.CORRELATION)
    
    if (correlationPositions.length > 2) {
      issues.push({
        type: 'account_mismatch',
        severity: 'warning',
        description: '高い相関性を持つポジションが多数存在します',
        affectedPositions: [group.primaryPosition.id, ...correlationPositions.map(cp => cp.position.id)],
        recommendation: 'ポジションを分散することを検討してください'
      })
    }

    return issues
  }

  /**
   * 両建てポジションの整合性チェック
   */
  private static checkHedgeConsistency(pos1: Position, pos2: Position): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = []

    // ロット数の一致チェック
    const lotDifference = Math.abs(pos1.lots - pos2.lots)
    if (lotDifference > this.LOT_MISMATCH_THRESHOLD) {
      issues.push({
        type: 'lot_mismatch',
        severity: 'warning',
        description: `両建てポジションのロット数に差があります (差: ${lotDifference.toFixed(2)})`,
        affectedPositions: [pos1.id, pos2.id],
        recommendation: 'ロット数を調整してヘッジを最適化してください'
      })
    }

    // 価格乖離チェック
    const avgPrice = (pos1.openPrice + pos2.openPrice) / 2
    const priceDivergence = Math.abs(pos1.openPrice - pos2.openPrice) / avgPrice * 100
    
    if (priceDivergence > this.PRICE_DIVERGENCE_THRESHOLD) {
      issues.push({
        type: 'price_divergence',
        severity: 'warning',
        description: `両建てポジションの開始価格に大きな差があります (${priceDivergence.toFixed(2)}%)`,
        affectedPositions: [pos1.id, pos2.id],
        recommendation: '価格差によるリスクを確認してください'
      })
    }

    // アカウント整合性チェック
    if (pos1.accountId === pos2.accountId) {
      issues.push({
        type: 'account_mismatch',
        severity: 'error',
        description: '同一口座内で両建てが行われています',
        affectedPositions: [pos1.id, pos2.id],
        recommendation: '両建てポジションは別々の口座に配置することを強く推奨します'
      })
    }

    // 開設時間の差チェック
    const timeDiff = Math.abs(new Date(pos1.openedAt).getTime() - new Date(pos2.openedAt).getTime())
    const hoursDiff = timeDiff / (1000 * 60 * 60)
    
    if (hoursDiff > 1) {
      issues.push({
        type: 'timing_issue',
        severity: 'warning',
        description: `両建てポジションの開設時間に${hoursDiff.toFixed(1)}時間の差があります`,
        affectedPositions: [pos1.id, pos2.id],
        recommendation: '時間差によるリスクを考慮してください'
      })
    }

    return issues
  }

  /**
   * 同一ペアポジションのリスクチェック
   */
  private static checkSamePairRisk(primaryPos: Position, samePairPositions: Position[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = []

    // 総ロット数の集中リスクチェック
    const totalLots = primaryPos.lots + samePairPositions.reduce((sum, pos) => sum + pos.lots, 0)
    
    if (totalLots > 5.0) { // 5ロット以上で警告
      issues.push({
        type: 'lot_mismatch',
        severity: 'warning',
        description: `${primaryPos.symbol}の同方向ポジションが集中しています (総ロット: ${totalLots})`,
        affectedPositions: [primaryPos.id, ...samePairPositions.map(p => p.id)],
        recommendation: 'リスクを分散するため、一部ポジションの決済を検討してください'
      })
    }

    return issues
  }

  /**
   * 単独ポジションのチェック
   */
  private static checkSoloPositionIssues(position: Position): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = []

    // 長期保有チェック
    const holdingHours = (Date.now() - new Date(position.openedAt).getTime()) / (1000 * 60 * 60)
    
    if (holdingHours > this.LONG_HOLDING_THRESHOLD_HOURS) {
      issues.push({
        type: 'timing_issue',
        severity: 'warning',
        description: `${position.symbol}が${holdingHours.toFixed(1)}時間保有されています`,
        affectedPositions: [position.id],
        recommendation: 'スワップコストを確認し、必要に応じて整理を検討してください'
      })
    }

    // 大きなロット数の警告
    if (position.lots > 2.0) {
      issues.push({
        type: 'lot_mismatch',
        severity: 'warning',
        description: `${position.symbol}の大きなポジション (${position.lots} lots)`,
        affectedPositions: [position.id],
        recommendation: 'リスク管理のため、ポジションサイズを確認してください'
      })
    }

    return issues
  }

  /**
   * 全体的なリスクレベルの計算
   */
  private static calculateOverallRiskLevel(
    positions: Position[], 
    issues: ConsistencyIssue[], 
    totalExposure: number
  ): 'low' | 'medium' | 'high' {
    let riskScore = 0

    // エラーの重み付け
    const errorCount = issues.filter(i => i.severity === 'error').length
    const warningCount = issues.filter(i => i.severity === 'warning').length
    
    riskScore += errorCount * 10
    riskScore += warningCount * 3

    // 総エクスポージャーによるリスク
    if (totalExposure > 20) riskScore += 15
    else if (totalExposure > 10) riskScore += 8
    else if (totalExposure > 5) riskScore += 3

    // ポジション数によるリスク
    if (positions.length > 20) riskScore += 10
    else if (positions.length > 10) riskScore += 5

    // リスクレベルを判定
    if (riskScore >= 20) return 'high'
    if (riskScore >= 10) return 'medium'
    return 'low'
  }

  /**
   * 特定ポジションの整合性チェック
   */
  static checkSpecificPositionConsistency(
    position: Position, 
    allPositions: Position[]
  ): PositionConsistencyCheck {
    const linkedPositions = LinkedPositionDetector.findLinkedPositions(position, allPositions)
    
    if (linkedPositions.length === 0) {
      return {
        isConsistent: true,
        issues: this.checkSoloPositionIssues(position),
        totalExposure: position.lots,
        riskLevel: 'low'
      }
    }

    const group: LinkedPositionGroup = {
      primaryPosition: position,
      linkedPositions,
      totalExposure: 0,
      netProfit: 0
    }

    const issues = this.checkGroupConsistency(group)
    const totalExposure = position.lots + linkedPositions.reduce((sum, lp) => sum + lp.position.lots, 0)

    return {
      isConsistent: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      totalExposure,
      riskLevel: this.calculateOverallRiskLevel([position, ...linkedPositions.map(lp => lp.position)], issues, totalExposure)
    }
  }

  /**
   * 決済前の整合性チェック
   */
  static checkPreCloseConsistency(
    positionsToClose: Position[], 
    allPositions: Position[]
  ): PositionConsistencyCheck {
    const issues: ConsistencyIssue[] = []

    for (const position of positionsToClose) {
      const linkedPositions = LinkedPositionDetector.findLinkedPositions(position, allPositions)
      
      // 両建ての相手が決済対象に含まれているかチェック
      const hedgePartners = linkedPositions.filter(lp => lp.relationType === RelationType.HEDGE)
      
      for (const hedge of hedgePartners) {
        const partnerIncluded = positionsToClose.some(p => p.id === hedge.position.id)
        
        if (!partnerIncluded) {
          issues.push({
            type: 'account_mismatch',
            severity: 'warning',
            description: `両建ての相手ポジション ${hedge.position.symbol} が決済対象に含まれていません`,
            affectedPositions: [position.id, hedge.position.id],
            recommendation: '両建て相手も同時に決済することを検討してください'
          })
        }
      }
    }

    const totalExposure = positionsToClose.reduce((sum, pos) => sum + pos.lots, 0)

    return {
      isConsistent: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      totalExposure,
      riskLevel: totalExposure > 10 ? 'high' : totalExposure > 5 ? 'medium' : 'low'
    }
  }
}