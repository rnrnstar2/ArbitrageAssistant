import React from 'react';
import { Card } from '@repo/ui/components/ui/card';

interface StatCardProps {
  title: string;
  value: number;
  format?: 'currency' | 'number';
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, format = 'number', color = 'blue' }) => {
  const formatValue = (value: number, format: string) => {
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
      <div className={`text-2xl font-bold ${getColorClass(color)}`}>
        {formatValue(value, format)}
      </div>
      <div className="text-sm text-gray-600">{title}</div>
    </Card>
  );
};