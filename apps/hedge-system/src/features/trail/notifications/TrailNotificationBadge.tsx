/**
 * トレール通知システム - 通知バッジコンポーネント
 */

'use client';

import React from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Bell, BellRing } from 'lucide-react';
import { useUnacknowledgedTrailNotifications } from './useTrailNotifications';

interface TrailNotificationBadgeProps {
  onClick?: () => void;
  showCount?: boolean;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
  className?: string;
}

export function TrailNotificationBadge({
  onClick,
  showCount = true,
  animate = true,
  size = 'md',
  variant = 'ghost',
  className = ''
}: TrailNotificationBadgeProps) {
  const { count } = useUnacknowledgedTrailNotifications();

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const badgeSizes = {
    sm: 'h-4 w-4 text-xs',
    md: 'h-5 w-5 text-xs',
    lg: 'h-6 w-6 text-sm'
  };

  if (count === 0) {
    return (
      <Button
        variant={variant}
        size="sm"
        onClick={onClick}
        className={`${sizeClasses[size]} p-0 ${className}`}
      >
        <Bell className={iconSizes[size]} />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant={variant}
        size="sm"
        onClick={onClick}
        className={`${sizeClasses[size]} p-0 ${animate ? 'animate-pulse' : ''} ${className}`}
      >
        <BellRing className={iconSizes[size]} />
      </Button>
      
      {showCount && (
        <Badge 
          variant="destructive" 
          className={`absolute -top-1 -right-1 ${badgeSizes[size]} p-0 flex items-center justify-center font-bold`}
        >
          {count > 99 ? '99+' : count}
        </Badge>
      )}
    </div>
  );
}

interface TrailNotificationIndicatorProps {
  className?: string;
}

export function TrailNotificationIndicator({ className }: TrailNotificationIndicatorProps) {
  const { count, notifications } = useUnacknowledgedTrailNotifications();

  if (count === 0) return null;

  const criticalCount = notifications.filter(n => n.severity === 'critical').length;
  const errorCount = notifications.filter(n => n.severity === 'error').length;

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {criticalCount > 0 && (
        <Badge variant="destructive" className="animate-pulse">
          🚨 {criticalCount}
        </Badge>
      )}
      {errorCount > 0 && (
        <Badge variant="destructive">
          ❌ {errorCount}
        </Badge>
      )}
      {count - criticalCount - errorCount > 0 && (
        <Badge variant="secondary">
          📢 {count - criticalCount - errorCount}
        </Badge>
      )}
    </div>
  );
}

interface TrailNotificationToastProps {
  maxVisible?: number;
  autoHide?: boolean;
  hideDelay?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export function TrailNotificationToast({
  maxVisible = 3,
  autoHide = true,
  hideDelay = 5000,
  position = 'top-right',
  className = ''
}: TrailNotificationToastProps) {
  const { notifications, acknowledge } = useUnacknowledgedTrailNotifications();

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  const visibleNotifications = notifications.slice(0, maxVisible);

  React.useEffect(() => {
    if (!autoHide) return;

    const timers = visibleNotifications
      .filter(n => n.autoClose !== false)
      .map(notification => 
        setTimeout(() => {
          acknowledge(notification.id);
        }, hideDelay)
      );

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [visibleNotifications, autoHide, hideDelay, acknowledge]);

  if (visibleNotifications.length === 0) return null;

  return (
    <div className={`fixed z-50 space-y-2 ${positionClasses[position]} ${className}`}>
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            max-w-sm p-4 rounded-lg shadow-lg border-l-4 bg-white
            ${notification.severity === 'critical' ? 'border-red-500' : ''}
            ${notification.severity === 'error' ? 'border-red-400' : ''}
            ${notification.severity === 'warning' ? 'border-orange-400' : ''}
            ${notification.severity === 'success' ? 'border-green-400' : ''}
            ${notification.severity === 'info' ? 'border-blue-400' : ''}
            animate-slide-in-right
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium">{notification.title}</span>
                <Badge variant="outline" className="text-xs">
                  {notification.type.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm text-gray-700">{notification.message}</p>
              <div className="text-xs text-gray-500 mt-1">
                {notification.data.symbol} | {new Date(notification.timestamp).toLocaleTimeString('ja-JP')}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => acknowledge(notification.id)}
              className="h-6 w-6 p-0 ml-2"
            >
              ×
            </Button>
          </div>
        </div>
      ))}
      
      {notifications.length > maxVisible && (
        <div className="text-center p-2 bg-gray-100 rounded text-sm text-gray-600">
          他に {notifications.length - maxVisible} 件の通知があります
        </div>
      )}
    </div>
  );
}