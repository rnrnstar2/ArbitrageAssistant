import React from 'react';
import { Card } from '../../../../packages/ui/src/components/ui/card';

interface StatCardProps {
  title: string;
  value: number | string;
  format?: 'currency' | 'number';
  color?: 'info' | 'success' | 'warning' | 'error' | 'primary';
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, format = 'number', color = 'info', icon }) => {
  const formatValue = (value: number | string, format: string) => {
    if (typeof value === 'string') {
      return value;
    }
    if (format === 'currency') {
      return new Intl.NumberFormat('ja-JP', { 
        style: 'currency', 
        currency: 'JPY' 
      }).format(value);
    }
    return value.toLocaleString();
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case 'info': return 'text-status-info';
      case 'success': return 'text-status-success';
      case 'warning': return 'text-status-warning';
      case 'error': return 'text-status-error';
      case 'primary': return 'text-primary';
      default: return 'text-status-info';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-2">
        <div className={`text-2xl font-bold ${getColorClass(color)}`}>
          {formatValue(value, format)}
        </div>
        {icon && <div className={`${getColorClass(color)}`}>{icon}</div>}
      </div>
      <div className="text-sm text-text-subtle">{title}</div>
    </Card>
  );
};