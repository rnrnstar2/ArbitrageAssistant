import React from 'react';
import { Card } from '../../../../packages/ui/src/components/ui/card';

interface StatCardProps {
  title: string;
  value: number | string;
  format?: 'currency' | 'number';
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, format = 'number', color = 'blue', icon }) => {
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
      case 'blue': return 'text-blue-600';
      case 'green': return 'text-green-600';
      case 'orange': return 'text-orange-600';
      case 'red': return 'text-red-600';
      case 'purple': return 'text-purple-600';
      default: return 'text-blue-600';
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
      <div className="text-sm text-gray-600">{title}</div>
    </Card>
  );
};