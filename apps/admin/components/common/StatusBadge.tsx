import React from 'react';
import { Badge } from '@repo/ui/components/ui/badge';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusColor = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'PENDING': return 'secondary';
      case 'OPENING': case 'EXECUTING': return 'default';
      case 'OPEN': case 'EXECUTED': return 'default';
      case 'CLOSING': return 'outline';
      case 'CLOSED': return 'outline';
      case 'STOPPED': case 'FAILED': return 'destructive';
      case 'CANCELED': return 'destructive';
      case 'ACTIVE': return 'default';
      case 'INACTIVE': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Badge variant={getStatusColor(status)}>
      {status}
    </Badge>
  );
};