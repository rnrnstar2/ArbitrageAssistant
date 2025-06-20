import { CloseHistory, CloseHistoryExport, CloseHistoryStats } from './types';

/**
 * CSV形式でエクスポート
 */
export function exportToCSV(
  data: CloseHistory[], 
  stats: CloseHistoryStats,
  filename?: string
): void {
  // CSVヘッダー
  const headers = [
    'ID',
    'ポジションID',
    'アカウントID',
    '通貨ペア',
    '売買方向',
    'ロット数',
    '開始価格',
    '決済価格',
    '損益',
    'スワップコスト',
    '総損益',
    '保有日数',
    '日次損益',
    '決済タイプ',
    'ステータス',
    '実行時刻',
    'エラー'
  ];

  // データ行
  const rows = data.map(item => [
    item.id,
    item.positionId,
    item.accountId,
    item.symbol,
    item.type === 'buy' ? '買い' : '売り',
    item.lots,
    item.openPrice,
    item.closePrice,
    item.profit,
    item.swapCost,
    item.totalReturn,
    item.holdingDays,
    item.dailyReturn,
    item.closeType === 'market' ? '成行' : '指値',
    item.status === 'executed' ? '完了' : item.status === 'pending' ? '実行中' : '失敗',
    item.executedAt ? item.executedAt.toISOString() : '',
    item.error || ''
  ]);

  // 統計情報を追加
  const statsRows = [
    [],
    ['=== 統計情報 ==='],
    ['総決済数', stats.totalTrades],
    ['総損益', stats.totalProfit],
    ['総スワップコスト', stats.totalSwapCost],
    ['総損益（スワップ考慮）', stats.totalReturn],
    ['平均保有日数', stats.averageHoldingDays],
    ['成功率', `${(stats.successRate * 100).toFixed(2)}%`],
    ['利益率', `${(stats.profitableRate * 100).toFixed(2)}%`],
    ['平均損益', stats.averageProfit],
    ['最大利益', stats.maxProfit],
    ['最大損失', stats.maxLoss]
  ];

  // CSV文字列を作成
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => 
      typeof cell === 'string' && cell.includes(',') 
        ? `"${cell.replace(/"/g, '""')}"` 
        : cell
    ).join(',')),
    ...statsRows.map(row => row.join(','))
  ].join('\n');

  // BOMを追加（Excelで正しく表示するため）
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  downloadFile(blob, filename || `close_history_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * JSON形式でエクスポート
 */
export function exportToJSON(
  data: CloseHistory[], 
  stats: CloseHistoryStats,
  filename?: string
): void {
  const exportData: CloseHistoryExport = {
    format: 'json',
    data,
    summary: stats,
    filters: {}, // フィルター情報は呼び出し元から渡す必要がある
    exportedAt: new Date()
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  
  downloadFile(blob, filename || `close_history_${new Date().toISOString().split('T')[0]}.json`);
}

/**
 * Excel形式でエクスポート（簡易版）
 * 注意: 本格的なExcelファイルの生成には追加のライブラリが必要
 */
export function exportToExcel(
  data: CloseHistory[], 
  stats: CloseHistoryStats,
  filename?: string
): void {
  // 簡易的なXML形式のExcelファイルを生成
  const headers = [
    'ID', 'ポジションID', 'アカウントID', '通貨ペア', '売買方向', 
    'ロット数', '開始価格', '決済価格', '損益', 'スワップコスト', 
    '総損益', '保有日数', '日次損益', '決済タイプ', 'ステータス', '実行時刻'
  ];

  let xmlContent = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<Worksheet ss:Name="決済履歴">
<Table>`;

  // ヘッダー行
  xmlContent += '<Row>';
  headers.forEach(header => {
    xmlContent += `<Cell><Data ss:Type="String">${header}</Data></Cell>`;
  });
  xmlContent += '</Row>';

  // データ行
  data.forEach(item => {
    xmlContent += '<Row>';
    [
      item.id,
      item.positionId,
      item.accountId,
      item.symbol,
      item.type === 'buy' ? '買い' : '売り',
      item.lots,
      item.openPrice,
      item.closePrice,
      item.profit,
      item.swapCost,
      item.totalReturn,
      item.holdingDays,
      item.dailyReturn,
      item.closeType === 'market' ? '成行' : '指値',
      item.status === 'executed' ? '完了' : item.status === 'pending' ? '実行中' : '失敗',
      item.executedAt ? item.executedAt.toISOString() : ''
    ].forEach(cell => {
      const cellType = typeof cell === 'number' ? 'Number' : 'String';
      const cellValue = typeof cell === 'string' 
        ? cell.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        : cell;
      xmlContent += `<Cell><Data ss:Type="${cellType}">${cellValue}</Data></Cell>`;
    });
    xmlContent += '</Row>';
  });

  // 統計情報
  xmlContent += '<Row></Row>'; // 空行
  xmlContent += '<Row><Cell><Data ss:Type="String">統計情報</Data></Cell></Row>';
  
  const statsData = [
    ['総決済数', stats.totalTrades],
    ['総損益', stats.totalProfit],
    ['総スワップコスト', stats.totalSwapCost],
    ['総損益（スワップ考慮）', stats.totalReturn],
    ['平均保有日数', stats.averageHoldingDays],
    ['成功率', `${(stats.successRate * 100).toFixed(2)}%`],
    ['利益率', `${(stats.profitableRate * 100).toFixed(2)}%`]
  ];

  statsData.forEach(([label, value]) => {
    xmlContent += '<Row>';
    xmlContent += `<Cell><Data ss:Type="String">${label}</Data></Cell>`;
    xmlContent += `<Cell><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${value}</Data></Cell>`;
    xmlContent += '</Row>';
  });

  xmlContent += '</Table></Worksheet></Workbook>';

  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadFile(blob, filename || `close_history_${new Date().toISOString().split('T')[0]}.xls`);
}

/**
 * ファイルダウンロード用ヘルパー関数
 */
function downloadFile(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // メモリリークを防ぐ
  URL.revokeObjectURL(url);
}

/**
 * エクスポート形式の検証
 */
export function validateExportFormat(format: string): format is 'csv' | 'excel' | 'json' {
  return ['csv', 'excel', 'json'].includes(format);
}

/**
 * エクスポートサイズの制限チェック
 */
export function checkExportSize(data: CloseHistory[]): { canExport: boolean; message?: string } {
  const maxRecords = 10000; // 最大10,000件
  const maxSizeBytes = 50 * 1024 * 1024; // 50MB
  
  if (data.length > maxRecords) {
    return {
      canExport: false,
      message: `エクスポート可能な最大件数（${maxRecords}件）を超えています。フィルターを使用してデータを絞り込んでください。`
    };
  }
  
  // 概算サイズチェック（1件あたり約1KB）
  const estimatedSize = data.length * 1024;
  if (estimatedSize > maxSizeBytes) {
    return {
      canExport: false,
      message: `エクスポートデータのサイズが大きすぎます。フィルターを使用してデータを絞り込んでください。`
    };
  }
  
  return { canExport: true };
}