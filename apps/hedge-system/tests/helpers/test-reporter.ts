/**
 * テストレポート生成とエクスポート機能
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export interface TestReport {
  id: string
  title: string
  generatedAt: Date
  summary: TestSummary
  suites: TestSuiteReport[]
  metrics: TestMetrics
  recommendations: string[]
}

export interface TestSummary {
  totalTests: number
  passedTests: number
  failedTests: number
  errorTests: number
  skippedTests: number
  successRate: number
  duration: number
}

export interface TestSuiteReport {
  name: string
  description: string
  status: 'passed' | 'failed' | 'error'
  duration: number
  tests: TestCaseReport[]
  metrics?: any
}

export interface TestCaseReport {
  name: string
  status: 'passed' | 'failed' | 'skipped' | 'error'
  duration: number
  assertions: AssertionReport[]
  errors: ErrorReport[]
}

export interface AssertionReport {
  description: string
  passed: boolean
  actual: any
  expected: any
}

export interface ErrorReport {
  message: string
  stack?: string
  timestamp: Date
}

export interface TestMetrics {
  performance: {
    averageResponseTime?: number
    maxResponseTime?: number
    p95ResponseTime?: number
    p99ResponseTime?: number
    throughput?: number
    errorRate?: number
  }
  quality: {
    connectionStability?: number
    messageDeliveryRate?: number
    dataSyncAccuracy?: number
  }
  system: {
    memoryUsage?: number
    cpuUsage?: number
    networkLatency?: number
  }
}

export interface TestResults {
  suiteName: string
  totalTests: number
  passedTests: number
  failedTests: number
  errorTests: number
  skippedTests: number
  duration: number
  results: any[]
  timestamp: Date
}

export class TestReporter {
  private outputDir: string

  constructor(outputDir: string = './test-reports') {
    this.outputDir = outputDir
  }

  /**
   * テストレポート生成
   */
  generateReport(results: TestResults[]): TestReport {
    const summary = this.calculateSummary(results)
    const suites = results.map(r => this.generateSuiteReport(r))
    const metrics = this.aggregateMetrics(results)
    const recommendations = this.generateRecommendations(results)
    
    return {
      id: this.generateReportId(),
      title: 'EA-WebSocket Integration Test Report',
      generatedAt: new Date(),
      summary,
      suites,
      metrics,
      recommendations
    }
  }

  /**
   * レポートエクスポート
   */
  async exportReport(report: TestReport, format: 'html' | 'json' | 'junit' = 'html'): Promise<string> {
    await this.ensureOutputDir()
    
    const filename = `test-report-${report.id}.${format === 'junit' ? 'xml' : format}`
    const filepath = join(this.outputDir, filename)
    
    let content: string
    
    switch (format) {
      case 'html':
        content = this.generateHTMLReport(report)
        break
      case 'json':
        content = JSON.stringify(report, null, 2)
        break
      case 'junit':
        content = this.generateJUnitXML(report)
        break
      default:
        throw new Error(`Unsupported format: ${format}`)
    }
    
    await writeFile(filepath, content, 'utf-8')
    console.log(`Test report exported to: ${filepath}`)
    
    return filepath
  }

  /**
   * レポート公開
   */
  async publishReport(report: TestReport): Promise<void> {
    // HTML形式でレポートを生成・保存
    const htmlPath = await this.exportReport(report, 'html')
    
    // JSON形式でも保存（API等での利用のため）
    const jsonPath = await this.exportReport(report, 'json')
    
    // JUnit XML形式でも保存（CI/CD統合のため）
    const junitPath = await this.exportReport(report, 'junit')
    
    console.log('Test report published:')
    console.log(`- HTML: ${htmlPath}`)
    console.log(`- JSON: ${jsonPath}`)
    console.log(`- JUnit: ${junitPath}`)
    
    // サマリーをコンソールに出力
    this.printSummary(report)
  }

  private calculateSummary(results: TestResults[]): TestSummary {
    const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0)
    const passedTests = results.reduce((sum, r) => sum + r.passedTests, 0)
    const failedTests = results.reduce((sum, r) => sum + r.failedTests, 0)
    const errorTests = results.reduce((sum, r) => sum + r.errorTests, 0)
    const skippedTests = results.reduce((sum, r) => sum + r.skippedTests, 0)
    const duration = results.reduce((sum, r) => sum + r.duration, 0)
    
    return {
      totalTests,
      passedTests,
      failedTests,
      errorTests,
      skippedTests,
      successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      duration
    }
  }

  private generateSuiteReport(result: TestResults): TestSuiteReport {
    const status: 'passed' | 'failed' | 'error' = 
      result.errorTests > 0 ? 'error' :
      result.failedTests > 0 ? 'failed' : 'passed'
    
    return {
      name: result.suiteName,
      description: `Test suite: ${result.suiteName}`,
      status,
      duration: result.duration,
      tests: result.results.map(r => this.generateTestCaseReport(r))
    }
  }

  private generateTestCaseReport(result: any): TestCaseReport {
    return {
      name: result.testName || 'Unknown Test',
      status: result.status || 'error',
      duration: result.duration || 0,
      assertions: result.assertions || [],
      errors: (result.errors || []).map((error: any) => ({
        message: error.message || 'Unknown error',
        stack: error.stack,
        timestamp: new Date()
      }))
    }
  }

  private aggregateMetrics(results: TestResults[]): TestMetrics {
    // メトリクスの集計ロジック
    const allResults = results.flatMap(r => r.results)
    
    // パフォーマンスメトリクス
    const responseTimes = allResults
      .filter(r => r.metrics?.responseTime)
      .map(r => r.metrics.responseTime)
    
    const throughputs = allResults
      .filter(r => r.metrics?.throughput)
      .map(r => r.metrics.throughput)
    
    return {
      performance: {
        averageResponseTime: responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : undefined,
        maxResponseTime: responseTimes.length > 0 
          ? Math.max(...responseTimes) 
          : undefined,
        p95ResponseTime: responseTimes.length > 0 
          ? this.calculatePercentile(responseTimes, 95) 
          : undefined,
        p99ResponseTime: responseTimes.length > 0 
          ? this.calculatePercentile(responseTimes, 99) 
          : undefined,
        throughput: throughputs.length > 0 
          ? throughputs.reduce((sum, tp) => sum + tp, 0) / throughputs.length 
          : undefined,
        errorRate: this.calculateErrorRate(results)
      },
      quality: {
        connectionStability: this.calculateConnectionStability(results),
        messageDeliveryRate: this.calculateMessageDeliveryRate(results),
        dataSyncAccuracy: this.calculateDataSyncAccuracy(results)
      },
      system: {
        // システムメトリクスは将来的に実装
      }
    }
  }

  private generateRecommendations(results: TestResults[]): string[] {
    const recommendations: string[] = []
    const summary = this.calculateSummary(results)
    
    // 成功率が低い場合
    if (summary.successRate < 95) {
      recommendations.push(`成功率が${summary.successRate.toFixed(1)}%と低いです。失敗したテストケースを確認し、根本原因を調査してください。`)
    }
    
    // エラーが多い場合
    if (summary.errorTests > 0) {
      recommendations.push(`${summary.errorTests}件のエラーが発生しています。システムの安定性を向上させる必要があります。`)
    }
    
    // パフォーマンスの問題
    const avgResponseTime = this.getAverageResponseTime(results)
    if (avgResponseTime && avgResponseTime > 200) {
      recommendations.push(`平均レスポンス時間が${avgResponseTime.toFixed(1)}msと目標値(100ms)を超えています。パフォーマンス改善を検討してください。`)
    }
    
    // 成功率が高い場合の推奨事項
    if (summary.successRate >= 99) {
      recommendations.push('優秀なテスト結果です。システムは安定して動作しています。')
    }
    
    return recommendations
  }

  private generateHTMLReport(report: TestReport): string {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5;
            line-height: 1.6;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #333; 
            border-bottom: 3px solid #4CAF50; 
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        .summary { 
            background: #f8f9fa; 
            padding: 25px; 
            margin-bottom: 30px; 
            border-radius: 8px;
            border-left: 5px solid #4CAF50;
        }
        .metrics { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            margin: 30px 0; 
        }
        .metric-card { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            border: 1px solid #ddd;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .suite { 
            margin: 30px 0; 
            border: 1px solid #ddd; 
            border-radius: 8px;
            overflow: hidden;
        }
        .suite-header { 
            background: #e9ecef; 
            padding: 15px; 
            font-weight: bold;
            border-bottom: 1px solid #ddd;
        }
        .suite-content { 
            padding: 20px; 
        }
        .test-case { 
            margin: 15px 0; 
            padding: 15px; 
            border-radius: 5px;
            border-left: 4px solid transparent;
        }
        .passed { 
            color: #155724; 
            background-color: #d4edda; 
            border-left-color: #28a745;
        }
        .failed { 
            color: #721c24; 
            background-color: #f8d7da; 
            border-left-color: #dc3545;
        }
        .error { 
            color: #856404; 
            background-color: #fff3cd; 
            border-left-color: #ffc107;
        }
        .skipped { 
            color: #6c757d; 
            background-color: #e2e3e5; 
            border-left-color: #6c757d;
        }
        .recommendations { 
            background: #e7f3ff; 
            padding: 25px; 
            border-radius: 8px;
            border-left: 5px solid #007bff;
            margin-top: 30px;
        }
        .metric-value { 
            font-size: 24px; 
            font-weight: bold; 
            color: #4CAF50; 
        }
        .metric-label { 
            font-size: 14px; 
            color: #666; 
            margin-top: 5px;
        }
        .progress-bar {
            background: #e9ecef;
            border-radius: 10px;
            height: 10px;
            margin: 10px 0;
            overflow: hidden;
        }
        .progress-fill {
            background: #4CAF50;
            height: 100%;
            transition: width 0.3s ease;
        }
        .error-details {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            font-family: monospace;
            font-size: 12px;
            border-left: 3px solid #dc3545;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${report.title}</h1>
        <p><strong>生成日時:</strong> ${report.generatedAt.toLocaleString('ja-JP')}</p>
        <p><strong>レポートID:</strong> ${report.id}</p>
        
        <div class="summary">
            <h2>テスト実行サマリー</h2>
            <div class="metrics">
                <div class="metric-card">
                    <div class="metric-value">${report.summary.totalTests}</div>
                    <div class="metric-label">総テスト数</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value passed">${report.summary.passedTests}</div>
                    <div class="metric-label">成功</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value failed">${report.summary.failedTests}</div>
                    <div class="metric-label">失敗</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value error">${report.summary.errorTests}</div>
                    <div class="metric-label">エラー</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.summary.successRate.toFixed(1)}%</div>
                    <div class="metric-label">成功率</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${report.summary.successRate}%"></div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${(report.summary.duration / 1000).toFixed(1)}s</div>
                    <div class="metric-label">実行時間</div>
                </div>
            </div>
        </div>
        
        ${this.generatePerformanceMetricsHTML(report.metrics)}
        
        <h2>テストスイート詳細</h2>
        ${report.suites.map(suite => this.generateSuiteHTML(suite)).join('')}
        
        <div class="recommendations">
            <h2>推奨事項</h2>
            <ul>
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>
</body>
</html>
    `
  }

  private generatePerformanceMetricsHTML(metrics: TestMetrics): string {
    if (!metrics.performance) return ''
    
    return `
        <div class="summary">
            <h2>パフォーマンスメトリクス</h2>
            <div class="metrics">
                ${metrics.performance.averageResponseTime ? `
                <div class="metric-card">
                    <div class="metric-value">${metrics.performance.averageResponseTime.toFixed(1)}ms</div>
                    <div class="metric-label">平均レスポンス時間</div>
                </div>
                ` : ''}
                ${metrics.performance.p95ResponseTime ? `
                <div class="metric-card">
                    <div class="metric-value">${metrics.performance.p95ResponseTime.toFixed(1)}ms</div>
                    <div class="metric-label">P95レスポンス時間</div>
                </div>
                ` : ''}
                ${metrics.performance.throughput ? `
                <div class="metric-card">
                    <div class="metric-value">${metrics.performance.throughput.toFixed(1)}</div>
                    <div class="metric-label">スループット (req/sec)</div>
                </div>
                ` : ''}
                ${metrics.performance.errorRate !== undefined ? `
                <div class="metric-card">
                    <div class="metric-value">${metrics.performance.errorRate.toFixed(2)}%</div>
                    <div class="metric-label">エラー率</div>
                </div>
                ` : ''}
            </div>
        </div>
    `
  }

  private generateSuiteHTML(suite: TestSuiteReport): string {
    return `
        <div class="suite">
            <div class="suite-header ${suite.status}">
                <strong>${suite.name}</strong> 
                <span style="float: right;">${(suite.duration / 1000).toFixed(1)}s</span>
            </div>
            <div class="suite-content">
                <p>${suite.description}</p>
                ${suite.tests.map(test => this.generateTestCaseHTML(test)).join('')}
            </div>
        </div>
    `
  }

  private generateTestCaseHTML(test: TestCaseReport): string {
    return `
        <div class="test-case ${test.status}">
            <strong>${test.name}</strong> 
            <span style="float: right;">${test.duration.toFixed(1)}ms</span>
            ${test.errors.length > 0 ? `
                <div class="error-details">
                    ${test.errors.map(error => `
                        <div><strong>Error:</strong> ${error.message}</div>
                        ${error.stack ? `<pre>${error.stack}</pre>` : ''}
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `
  }

  private generateJUnitXML(report: TestReport): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="${report.title}" tests="${report.summary.totalTests}" failures="${report.summary.failedTests}" errors="${report.summary.errorTests}" time="${(report.summary.duration / 1000).toFixed(3)}">
${report.suites.map(suite => `
  <testsuite name="${suite.name}" tests="${suite.tests.length}" failures="${suite.tests.filter(t => t.status === 'failed').length}" errors="${suite.tests.filter(t => t.status === 'error').length}" time="${(suite.duration / 1000).toFixed(3)}">
${suite.tests.map(test => `
    <testcase name="${test.name}" time="${(test.duration / 1000).toFixed(3)}">
${test.status === 'failed' ? `
      <failure message="${test.errors[0]?.message || 'Test failed'}">${test.errors[0]?.stack || ''}</failure>
` : ''}
${test.status === 'error' ? `
      <error message="${test.errors[0]?.message || 'Test error'}">${test.errors[0]?.stack || ''}</error>
` : ''}
${test.status === 'skipped' ? `
      <skipped />
` : ''}
    </testcase>
`).join('')}
  </testsuite>
`).join('')}
</testsuites>`
  }

  private generateReportId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await mkdir(this.outputDir, { recursive: true })
    } catch (error) {
      // Directory already exists, ignore
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b)
    const index = Math.ceil((percentile * sorted.length) / 100) - 1
    return sorted[Math.max(0, index)]
  }

  private calculateErrorRate(results: TestResults[]): number {
    const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.failedTests + r.errorTests, 0)
    return totalTests > 0 ? (totalErrors / totalTests) * 100 : 0
  }

  private calculateConnectionStability(results: TestResults[]): number {
    // 接続安定性の計算ロジック（将来実装）
    return 95.0 // プレースホルダー
  }

  private calculateMessageDeliveryRate(results: TestResults[]): number {
    // メッセージ配信率の計算ロジック（将来実装）
    return 99.5 // プレースホルダー
  }

  private calculateDataSyncAccuracy(results: TestResults[]): number {
    // データ同期精度の計算ロジック（将来実装）
    return 100.0 // プレースホルダー
  }

  private getAverageResponseTime(results: TestResults[]): number | undefined {
    const allResults = results.flatMap(r => r.results)
    const responseTimes = allResults
      .filter(r => r.metrics?.responseTime)
      .map(r => r.metrics.responseTime)
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : undefined
  }

  private printSummary(report: TestReport): void {
    console.log('\n📊 テスト実行サマリー')
    console.log('='.repeat(50))
    console.log(`✅ 成功: ${report.summary.passedTests}`)
    console.log(`❌ 失敗: ${report.summary.failedTests}`)
    console.log(`🚫 エラー: ${report.summary.errorTests}`)
    console.log(`⏭️  スキップ: ${report.summary.skippedTests}`)
    console.log(`📈 成功率: ${report.summary.successRate.toFixed(1)}%`)
    console.log(`⏱️  実行時間: ${(report.summary.duration / 1000).toFixed(1)}秒`)
    
    if (report.metrics.performance?.averageResponseTime) {
      console.log(`⚡ 平均レスポンス時間: ${report.metrics.performance.averageResponseTime.toFixed(1)}ms`)
    }
    
    console.log('='.repeat(50))
  }
}