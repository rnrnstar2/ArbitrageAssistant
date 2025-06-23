'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartDataPoint {
  timestamp: string;
  pnl: number;
  positions: number;
  volume: number;
}

interface RealTimeChartProps {
  data: ChartDataPoint[];
}

export function RealTimeChart({ data }: RealTimeChartProps) {
  const [timeRange, setTimeRange] = useState('1h');
  const [metric, setMetric] = useState('pnl');

  const getFilteredData = () => {
    const now = new Date();
    let cutoff: Date;

    switch (timeRange) {
      case '15m':
        cutoff = new Date(now.getTime() - 15 * 60 * 1000);
        break;
      case '1h':
        cutoff = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        cutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      default:
        return data;
    }

    return data.filter(point => new Date(point.timestamp) >= cutoff);
  };

  const getMetricLabel = () => {
    switch (metric) {
      case 'pnl': return '損益 (円)';
      case 'positions': return 'ポジション数';
      case 'volume': return '取引量';
      default: return '';
    }
  };

  const getLineColor = () => {
    switch (metric) {
      case 'pnl': return '#10B981';
      case 'positions': return '#3B82F6';
      case 'volume': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const filteredData = getFilteredData();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>パフォーマンスチャート</CardTitle>
          <div className="flex space-x-2">
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pnl">損益</SelectItem>
                <SelectItem value="positions">ポジション数</SelectItem>
                <SelectItem value="volume">取引量</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">15分</SelectItem>
                <SelectItem value="1h">1時間</SelectItem>
                <SelectItem value="6h">6時間</SelectItem>
                <SelectItem value="24h">24時間</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {filteredData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value) => [value, getMetricLabel()]}
                />
                <Line 
                  type="monotone" 
                  dataKey={metric} 
                  stroke={getLineColor()} 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              データがありません
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}