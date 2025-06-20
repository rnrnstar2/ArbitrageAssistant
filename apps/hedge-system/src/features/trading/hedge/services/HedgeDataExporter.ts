import { HedgePosition } from '../types'
import { 
  AnalyticsData, 
  HedgeStatistics, 
  HedgePerformance, 
  TimeSeriesDataPoint 
} from '../components/HedgeAnalytics'
import { 
  AdvancedHedgeStatistics, 
  HedgePerformanceMetrics, 
  SymbolAnalysis,
  TimeSeriesAnalytics 
} from './HedgeAnalyticsService'

export type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf'

export interface ExportOptions {
  format: ExportFormat
  includeCharts?: boolean
  includeRawData?: boolean
  dateRange?: {
    start: Date
    end: Date
  }
  filename?: string
}

export interface ExportableData {
  metadata: {
    exportDate: Date
    timeRange: string
    totalRecords: number
    version: string
  }
  statistics: AdvancedHedgeStatistics
  performance: HedgePerformanceMetrics
  symbolAnalysis: SymbolAnalysis[]
  timeSeriesData: TimeSeriesAnalytics[]
  hedgePositions?: HedgePosition[]
}

export class HedgeDataExporter {
  private data: ExportableData

  constructor(data: ExportableData) {
    this.data = data
  }

  /**
   * データを指定された形式でエクスポート
   */
  async export(options: ExportOptions): Promise<void> {
    const filename = options.filename || this.generateFilename(options.format)

    switch (options.format) {
      case 'csv':
        await this.exportToCsv(filename, options)
        break
      case 'json':
        await this.exportToJson(filename, options)
        break
      case 'excel':
        await this.exportToExcel(filename, options)
        break
      case 'pdf':
        await this.exportToPdf(filename, options)
        break
      default:
        throw new Error(`Unsupported export format: ${options.format}`)
    }
  }

  /**
   * CSV形式でエクスポート
   */
  private async exportToCsv(filename: string, options: ExportOptions): Promise<void> {
    const csvContent = this.generateCsvContent(options)
    await this.downloadFile(csvContent, filename, 'text/csv')
  }

  /**
   * JSON形式でエクスポート
   */
  private async exportToJson(filename: string, options: ExportOptions): Promise<void> {
    const exportData = this.prepareExportData(options)
    const jsonContent = JSON.stringify(exportData, null, 2)
    await this.downloadFile(jsonContent, filename, 'application/json')
  }

  /**
   * Excel形式でエクスポート（CSV形式として実装）
   */
  private async exportToExcel(filename: string, options: ExportOptions): Promise<void> {
    // 実際のExcel実装にはライブラリ（如 SheetJS）が必要
    // ここでは簡易的にCSV形式で実装
    const csvContent = this.generateCsvContent(options)
    const excelFilename = filename.replace('.excel', '.csv')
    await this.downloadFile(csvContent, excelFilename, 'text/csv')
  }

  /**
   * PDF形式でエクスポート
   */
  private async exportToPdf(filename: string, options: ExportOptions): Promise<void> {
    // 実際のPDF実装にはライブラリ（如 jsPDF）が必要
    // ここでは簡易的にHTML形式で実装
    const htmlContent = this.generateHtmlReport(options)
    await this.downloadFile(htmlContent, filename.replace('.pdf', '.html'), 'text/html')
  }

  /**
   * CSV コンテンツの生成
   */
  private generateCsvContent(options: ExportOptions): string {
    const lines: string[] = []

    // ヘッダー情報
    lines.push('# Hedge Analytics Export Report')
    lines.push(`# Export Date: ${this.data.metadata.exportDate.toISOString()}`)
    lines.push(`# Time Range: ${this.data.metadata.timeRange}`)
    lines.push(`# Total Records: ${this.data.metadata.totalRecords}`)
    lines.push('')

    // 基本統計
    lines.push('## Basic Statistics')
    lines.push('Metric,Value')
    lines.push(`Total Hedges,${this.data.statistics.totalHedges}`)
    lines.push(`Active Hedges,${this.data.statistics.activeHedges}`)
    lines.push(`Perfect Hedges,${this.data.statistics.perfectHedges}`)
    lines.push(`Partial Hedges,${this.data.statistics.partialHedges}`)
    lines.push(`Cross Account Hedges,${this.data.statistics.crossAccountHedges}`)
    lines.push(`Total Profit,${this.data.statistics.totalProfit}`)
    lines.push(`Win Rate,%,${this.data.statistics.winRate.toFixed(2)}`)
    lines.push(`Average Balance,${this.data.statistics.averageBalance.toFixed(4)}`)
    lines.push('')

    // パフォーマンス
    lines.push('## Performance Metrics')
    lines.push('Metric,Value')
    lines.push(`Total Return,${this.data.performance.totalReturn}`)
    lines.push(`Average Return,${this.data.performance.averageReturn}`)
    lines.push(`Best Return,${this.data.performance.bestReturn}`)
    lines.push(`Worst Return,${this.data.performance.worstReturn}`)
    lines.push(`Volatility,${this.data.performance.volatility.toFixed(4)}`)
    lines.push(`Sharpe Ratio,${this.data.performance.sharpeRatio.toFixed(4)}`)
    lines.push(`Max Drawdown,${this.data.performance.maxDrawdown.toFixed(2)}%`)
    lines.push(`Profit Factor,${this.data.performance.profitFactor.toFixed(2)}`)
    lines.push('')

    // 通貨ペア別分析
    lines.push('## Symbol Analysis')
    lines.push('Symbol,Positions,Total Lots,Net Lots,Total Profit,Win Rate %,Risk Level,Balance Ratio')
    this.data.symbolAnalysis.forEach(symbol => {
      lines.push([
        symbol.symbol,
        symbol.totalPositions,
        symbol.totalLots.toFixed(2),
        symbol.netLots.toFixed(2),
        symbol.totalProfit.toFixed(2),
        symbol.winRate.toFixed(2),
        symbol.riskLevel,
        symbol.balanceRatio.toFixed(2)
      ].join(','))
    })
    lines.push('')

    // 時系列データ
    if (options.includeRawData) {
      lines.push('## Time Series Data')
      lines.push('Timestamp,Total Profit,Cumulative Profit,Drawdown %,Hedge Count,Risk Score')
      this.data.timeSeriesData.forEach(point => {
        lines.push([
          point.timestamp.toISOString(),
          point.totalProfit.toFixed(2),
          point.cumulativeProfit.toFixed(2),
          point.drawdown.toFixed(2),
          point.hedgeCount,
          point.riskScore.toFixed(2)
        ].join(','))
      })
      lines.push('')
    }

    // 詳細ポジションデータ
    if (options.includeRawData && this.data.hedgePositions) {
      lines.push('## Hedge Positions Detail')
      lines.push('ID,Symbol,Type,Accounts,Buy Lots,Sell Lots,Total Profit,Is Balanced,Created At')
      this.data.hedgePositions.forEach(hedge => {
        lines.push([
          hedge.id,
          hedge.symbol,
          hedge.hedgeType,
          hedge.accounts.join(';'),
          hedge.totalLots.buy.toFixed(2),
          hedge.totalLots.sell.toFixed(2),
          hedge.totalProfit.toFixed(2),
          hedge.isBalanced ? 'YES' : 'NO',
          hedge.createdAt.toISOString()
        ].join(','))
      })
    }

    return lines.join('\n')
  }

  /**
   * HTML レポートの生成
   */
  private generateHtmlReport(options: ExportOptions): string {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hedge Analytics Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #2563eb; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .metric-card { background: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .positive { color: #059669; }
        .negative { color: #dc2626; }
        .neutral { color: #6b7280; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    </style>
</head>
<body>
    <h1>両建て分析レポート</h1>
    
    <div class="metric-card">
        <h3>エクスポート情報</h3>
        <p><strong>エクスポート日時:</strong> ${this.data.metadata.exportDate.toLocaleString()}</p>
        <p><strong>対象期間:</strong> ${this.data.metadata.timeRange}</p>
        <p><strong>総レコード数:</strong> ${this.data.metadata.totalRecords}</p>
    </div>

    <h2>基本統計</h2>
    <div class="summary-grid">
        <div class="metric-card">
            <h4>総両建て数</h4>
            <div style="font-size: 2em; font-weight: bold;">${this.data.statistics.totalHedges}</div>
        </div>
        <div class="metric-card">
            <h4>アクティブ両建て</h4>
            <div style="font-size: 2em; font-weight: bold;" class="positive">${this.data.statistics.activeHedges}</div>
        </div>
        <div class="metric-card">
            <h4>総損益</h4>
            <div style="font-size: 2em; font-weight: bold;" class="${this.data.statistics.totalProfit >= 0 ? 'positive' : 'negative'}">
                $${this.data.statistics.totalProfit.toFixed(2)}
            </div>
        </div>
        <div class="metric-card">
            <h4>勝率</h4>
            <div style="font-size: 2em; font-weight: bold;" class="positive">${this.data.statistics.winRate.toFixed(1)}%</div>
        </div>
    </div>

    <h2>パフォーマンス指標</h2>
    <table>
        <tr><th>指標</th><th>値</th></tr>
        <tr><td>総リターン</td><td class="${this.data.performance.totalReturn >= 0 ? 'positive' : 'negative'}">$${this.data.performance.totalReturn.toFixed(2)}</td></tr>
        <tr><td>平均リターン</td><td>$${this.data.performance.averageReturn.toFixed(2)}</td></tr>
        <tr><td>最高リターン</td><td class="positive">$${this.data.performance.bestReturn.toFixed(2)}</td></tr>
        <tr><td>最低リターン</td><td class="negative">$${this.data.performance.worstReturn.toFixed(2)}</td></tr>
        <tr><td>ボラティリティ</td><td>${this.data.performance.volatility.toFixed(4)}</td></tr>
        <tr><td>シャープレシオ</td><td>${this.data.performance.sharpeRatio.toFixed(2)}</td></tr>
        <tr><td>最大ドローダウン</td><td class="negative">${this.data.performance.maxDrawdown.toFixed(2)}%</td></tr>
        <tr><td>プロフィットファクター</td><td>${this.data.performance.profitFactor.toFixed(2)}</td></tr>
    </table>

    <h2>通貨ペア別分析</h2>
    <table>
        <tr>
            <th>通貨ペア</th>
            <th>ポジション数</th>
            <th>総ロット</th>
            <th>損益</th>
            <th>勝率</th>
            <th>バランス比率</th>
            <th>リスクレベル</th>
        </tr>
        ${this.data.symbolAnalysis.map(symbol => `
        <tr>
            <td><strong>${symbol.symbol}</strong></td>
            <td>${symbol.totalPositions}</td>
            <td>${symbol.totalLots.toFixed(2)}</td>
            <td class="${symbol.totalProfit >= 0 ? 'positive' : 'negative'}">$${symbol.totalProfit.toFixed(2)}</td>
            <td>${symbol.winRate.toFixed(1)}%</td>
            <td>${symbol.balanceRatio.toFixed(2)}</td>
            <td>
                <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; 
                      background-color: ${symbol.riskLevel === 'low' ? '#dcfce7' : symbol.riskLevel === 'medium' ? '#fef3c7' : '#fee2e2'};
                      color: ${symbol.riskLevel === 'low' ? '#166534' : symbol.riskLevel === 'medium' ? '#92400e' : '#991b1b'};">
                    ${symbol.riskLevel === 'low' ? '低' : symbol.riskLevel === 'medium' ? '中' : '高'}
                </span>
            </td>
        </tr>
        `).join('')}
    </table>

    ${options.includeRawData ? `
    <h2>時系列データ</h2>
    <table>
        <tr>
            <th>時刻</th>
            <th>損益</th>
            <th>累積損益</th>
            <th>ドローダウン</th>
            <th>両建て数</th>
            <th>リスクスコア</th>
        </tr>
        ${this.data.timeSeriesData.slice(0, 20).map(point => `
        <tr>
            <td>${point.timestamp.toLocaleString()}</td>
            <td class="${point.totalProfit >= 0 ? 'positive' : 'negative'}">$${point.totalProfit.toFixed(2)}</td>
            <td>$${point.cumulativeProfit.toFixed(2)}</td>
            <td class="negative">${point.drawdown.toFixed(2)}%</td>
            <td>${point.hedgeCount}</td>
            <td>${point.riskScore.toFixed(1)}</td>
        </tr>
        `).join('')}
    </table>
    ` : ''}

    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
        <p>このレポートは${this.data.metadata.exportDate.toLocaleString()}に自動生成されました。</p>
        <p>ArbitrageAssistant - Hedge System v${this.data.metadata.version}</p>
    </footer>
</body>
</html>`
  }

  /**
   * エクスポート用データの準備
   */
  private prepareExportData(options: ExportOptions): any {
    const exportData: any = {
      metadata: this.data.metadata,
      statistics: this.data.statistics,
      performance: this.data.performance,
      symbolAnalysis: this.data.symbolAnalysis
    }

    if (options.includeRawData) {
      exportData.timeSeriesData = this.data.timeSeriesData
      if (this.data.hedgePositions) {
        exportData.hedgePositions = this.data.hedgePositions
      }
    }

    return exportData
  }

  /**
   * ファイル名の生成
   */
  private generateFilename(format: ExportFormat): string {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '')
    return `hedge_analytics_${dateStr}_${timeStr}.${format}`
  }

  /**
   * ファイルダウンロード
   */
  private async downloadFile(content: string, filename: string, mimeType: string): Promise<void> {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }

  /**
   * 静的メソッド：データエクスポートのファクトリー
   */
  static async exportAnalyticsData(
    data: ExportableData,
    options: ExportOptions
  ): Promise<void> {
    const exporter = new HedgeDataExporter(data)
    await exporter.export(options)
  }

  /**
   * 複数形式での一括エクスポート
   */
  static async exportMultipleFormats(
    data: ExportableData,
    formats: ExportFormat[],
    baseOptions: Omit<ExportOptions, 'format'>
  ): Promise<void> {
    const exporter = new HedgeDataExporter(data)
    
    for (const format of formats) {
      await exporter.export({
        ...baseOptions,
        format,
        filename: baseOptions.filename?.replace(/\.[^.]+$/, `.${format}`)
      })
    }
  }

  /**
   * エクスポート可能データの作成ヘルパー
   */
  static createExportableData(
    statistics: AdvancedHedgeStatistics,
    performance: HedgePerformanceMetrics,
    symbolAnalysis: SymbolAnalysis[],
    timeSeriesData: TimeSeriesAnalytics[],
    hedgePositions?: HedgePosition[],
    timeRange?: string
  ): ExportableData {
    return {
      metadata: {
        exportDate: new Date(),
        timeRange: timeRange || '不明',
        totalRecords: hedgePositions?.length || timeSeriesData.length,
        version: '1.0.0'
      },
      statistics,
      performance,
      symbolAnalysis,
      timeSeriesData,
      hedgePositions
    }
  }
}

export default HedgeDataExporter