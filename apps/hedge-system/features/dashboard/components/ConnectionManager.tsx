"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@repo/ui/components/ui/card';

interface ConnectionEvent {
  timestamp: Date;
  type: 'connect' | 'disconnect';
  accountId: string;
}

export const ConnectionManager: React.FC = () => {
  const [connections, setConnections] = useState<string[]>([]);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionEvent[]>([]);

  useEffect(() => {
    const updateConnections = async () => {
      try {
        // Mock data for now - would integrate with actual wsHandler
        const connectedAccounts = ['12345678', '87654321', '11111111', '99999999'];
        setConnections(connectedAccounts);
      } catch (error) {
        console.error('Failed to update connections:', error);
      }
    };

    // Mock connection history
    const mockHistory: ConnectionEvent[] = [
      { timestamp: new Date(Date.now() - 300000), type: 'connect', accountId: '12345678' },
      { timestamp: new Date(Date.now() - 240000), type: 'connect', accountId: '87654321' },
      { timestamp: new Date(Date.now() - 180000), type: 'disconnect', accountId: '55555555' },
      { timestamp: new Date(Date.now() - 120000), type: 'connect', accountId: '11111111' },
      { timestamp: new Date(Date.now() - 60000), type: 'connect', accountId: '99999999' },
    ];
    setConnectionHistory(mockHistory);

    const interval = setInterval(updateConnections, 1000);
    updateConnections();

    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      {/* 接続状況 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">EA接続状況</h3>
        
        <div className="space-y-2">
          {connections.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              接続中のEAはありません
            </div>
          ) : (
            connections.map(accountId => (
              <div key={accountId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-medium">口座: {accountId.slice(-8)}</span>
                </div>
                <div className="text-sm text-gray-500">
                  接続中
                </div>
              </div>
            ))
          )}
        </div>

        {/* 接続統計 */}
        <div className="mt-4 p-4 bg-blue-50 rounded">
          <div className="text-sm text-blue-700">
            総接続数: {connections.length}
          </div>
        </div>
      </Card>

      {/* 接続履歴 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">接続履歴</h3>
        
        <div className="max-h-60 overflow-y-auto space-y-2">
          {connectionHistory.map((event, index) => (
            <div key={index} className="flex items-center space-x-3 text-sm">
              <div className="text-gray-500">
                {formatTime(event.timestamp)}
              </div>
              <div className={`w-2 h-2 rounded-full ${
                event.type === 'connect' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <div>
                口座 {event.accountId.slice(-8)} が
                {event.type === 'connect' ? '接続' : '切断'}しました
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};