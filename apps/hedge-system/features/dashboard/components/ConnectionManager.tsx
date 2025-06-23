'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { RefreshCw, Wifi, WifiOff, Send, Trash2, Play, Square } from 'lucide-react';

// Tauri WebSocketサーバーの型定義
interface WSServerState {
  is_running: boolean;
  port: number;
  host: string;
  connected_clients: number;
  total_messages_received: number;
  total_messages_sent: number;
  errors: number;
  uptime_seconds: number;
  started_at?: string;
}

interface ClientConnection {
  id: string;
  connected_at: string;
  last_heartbeat: string;
  authenticated: boolean;
  ea_info?: {
    version: string;
    platform: string;
    account: string;
    server_name?: string;
    company_name?: string;
  };
  message_count: number;
  error_count: number;
}

interface TestCommand {
  type: 'OPEN' | 'CLOSE' | 'PING' | 'CUSTOM';
  accountId: string;
  positionId?: string;
  symbol?: string;
  side?: 'BUY' | 'SELL';
  volume?: number;
  customData?: string;
}

/**
 * ConnectionManager - EA接続管理とテスト機能
 * MVPシステム設計書準拠のWebSocket通信テスト
 */
export function ConnectionManager() {
  const [serverState, setServerState] = useState<WSServerState | null>(null);
  const [clients, setClients] = useState<ClientConnection[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [testCommand, setTestCommand] = useState<TestCommand>({
    type: 'PING',
    accountId: '',
  });
  const [commandResult, setCommandResult] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  // サーバー状態とクライアント一覧の取得
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // サーバー状態取得
      const state = await invoke('get_websocket_server_status') as WSServerState;
      setServerState(state);

      // クライアント一覧取得
      const clientList = await invoke('get_websocket_clients') as ClientConnection[];
      setClients(clientList);

      addLog(`✅ Data refreshed: ${clientList.length} clients connected`);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      addLog(`❌ Failed to refresh data: ${error}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // WebSocketサーバー開始
  const startServer = async () => {
    try {
      await invoke('start_websocket_server', {
        port: 8080,
        host: '127.0.0.1',
        authToken: 'hedge-system-default-token'
      });
      addLog('🚀 WebSocket server started');
      await refreshData();
    } catch (error) {
      addLog(`❌ Failed to start server: ${error}`);
    }
  };

  // WebSocketサーバー停止
  const stopServer = async () => {
    try {
      await invoke('stop_websocket_server');
      addLog('🛑 WebSocket server stopped');
      await refreshData();
    } catch (error) {
      addLog(`❌ Failed to stop server: ${error}`);
    }
  };

  // クライアント切断
  const disconnectClient = async (clientId: string) => {
    try {
      await invoke('disconnect_websocket_client', { clientId });
      addLog(`🔌 Client ${clientId} disconnected`);
      await refreshData();
    } catch (error) {
      addLog(`❌ Failed to disconnect client: ${error}`);
    }
  };

  // テストコマンド送信
  const sendTestCommand = async () => {
    if (!selectedClient) {
      addLog('❌ Please select a client first');
      return;
    }

    try {
      let command: any = {
        type: testCommand.type,
        timestamp: new Date().toISOString(),
        accountId: testCommand.accountId || selectedClient,
      };

      // コマンドタイプに応じてパラメータを追加
      switch (testCommand.type) {
        case 'OPEN':
          command = {
            ...command,
            positionId: testCommand.positionId || `test_${Date.now()}`,
            symbol: testCommand.symbol || 'USDJPY',
            side: testCommand.side || 'BUY',
            volume: testCommand.volume || 1.0,
            metadata: {
              executionType: 'ENTRY',
              timestamp: new Date().toISOString()
            }
          };
          break;
        case 'CLOSE':
          command = {
            ...command,
            positionId: testCommand.positionId || 'test_position',
          };
          break;
        case 'CUSTOM':
          if (testCommand.customData) {
            try {
              const customJson = JSON.parse(testCommand.customData);
              command = { ...command, ...customJson };
            } catch (error) {
              addLog('❌ Invalid JSON in custom data');
              return;
            }
          }
          break;
      }

      // TODO: Tauri側にクライアント指定コマンド送信機能を実装
      setCommandResult(JSON.stringify(command, null, 2));
      addLog(`📤 Test command prepared: ${command.type} to ${selectedClient}`);
      addLog(`⚠️ Direct client messaging not yet implemented in Tauri WebSocket server`);

    } catch (error) {
      addLog(`❌ Failed to send test command: ${error}`);
    }
  };

  // ログ追加
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]); // 最新50件保持
  };

  // イベントリスナー設定
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unsubscribe = await listen('websocket-event', (event) => {
          const payload = event.payload as any;
          addLog(`📨 WebSocket event: ${payload.type} - ${JSON.stringify(payload)}`);
        });
      } catch (error) {
        console.error('Failed to setup event listeners:', error);
      }
    };

    setupListeners();
    refreshData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // クライアント選択時にアカウントIDを自動設定
  useEffect(() => {
    if (selectedClient && clients.length > 0) {
      const client = clients.find(c => c.id === selectedClient);
      if (client?.ea_info?.account) {
        setTestCommand(prev => ({
          ...prev,
          accountId: client.ea_info!.account
        }));
      }
    }
  }, [selectedClient, clients]);

  return (
    <div className="space-y-6">
      {/* サーバー状態 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {serverState?.is_running ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                WebSocket Server Status
              </CardTitle>
              <CardDescription>
                Port: {serverState?.port || 8080} | Host: {serverState?.host || '127.0.0.1'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {serverState?.is_running ? (
                <Button variant="destructive" size="sm" onClick={stopServer}>
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={startServer}>
                  <Play className="h-4 w-4 mr-1" />
                  Start
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {serverState?.connected_clients || 0}
              </div>
              <div className="text-sm text-gray-500">Connected EAs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {serverState?.total_messages_received || 0}
              </div>
              <div className="text-sm text-gray-500">Messages Received</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {serverState?.total_messages_sent || 0}
              </div>
              <div className="text-sm text-gray-500">Messages Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {serverState?.errors || 0}
              </div>
              <div className="text-sm text-gray-500">Errors</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 接続中EA一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>Connected EAs ({clients.length})</CardTitle>
          <CardDescription>
            Real-time EA connection status and information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No EAs connected. Make sure MT4/MT5 EA is running and properly configured.
            </div>
          ) : (
            <div className="space-y-3">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className={`p-4 border rounded-lg cursor-pointer ${
                    selectedClient === client.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedClient(client.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={client.authenticated ? 'default' : 'secondary'}>
                        {client.authenticated ? 'Authenticated' : 'Pending'}
                      </Badge>
                      <div>
                        <div className="font-medium">
                          {client.ea_info?.account || client.id}
                        </div>
                        <div className="text-sm text-gray-500">
                          {client.ea_info?.platform} | {client.ea_info?.version}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm">
                        <div>Messages: {client.message_count}</div>
                        <div className="text-gray-500">
                          Last: {new Date(client.last_heartbeat).toLocaleTimeString()}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          disconnectClient(client.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* テストコマンド送信 */}
      <Card>
        <CardHeader>
          <CardTitle>Test Command Sender</CardTitle>
          <CardDescription>
            Send test commands to selected EA (MVP System Design compliant)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client-select">Target EA</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an EA" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.ea_info?.account || client.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="command-type">Command Type</Label>
              <Select
                value={testCommand.type}
                onValueChange={(value) =>
                  setTestCommand(prev => ({ ...prev, type: value as any }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PING">PING (Heartbeat)</SelectItem>
                  <SelectItem value="OPEN">OPEN (Entry)</SelectItem>
                  <SelectItem value="CLOSE">CLOSE (Exit)</SelectItem>
                  <SelectItem value="CUSTOM">CUSTOM (JSON)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {testCommand.type === 'OPEN' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  value={testCommand.symbol || ''}
                  onChange={(e) =>
                    setTestCommand(prev => ({ ...prev, symbol: e.target.value }))
                  }
                  placeholder="USDJPY"
                />
              </div>
              <div>
                <Label htmlFor="side">Side</Label>
                <Select
                  value={testCommand.side || 'BUY'}
                  onValueChange={(value) =>
                    setTestCommand(prev => ({ ...prev, side: value as any }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="volume">Volume</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.01"
                  value={testCommand.volume || ''}
                  onChange={(e) =>
                    setTestCommand(prev => ({ ...prev, volume: parseFloat(e.target.value) || 1.0 }))
                  }
                  placeholder="1.0"
                />
              </div>
            </div>
          )}

          {(testCommand.type === 'CLOSE' || testCommand.type === 'OPEN') && (
            <div>
              <Label htmlFor="position-id">Position ID</Label>
              <Input
                id="position-id"
                value={testCommand.positionId || ''}
                onChange={(e) =>
                  setTestCommand(prev => ({ ...prev, positionId: e.target.value }))
                }
                placeholder="Auto-generated if empty"
              />
            </div>
          )}

          {testCommand.type === 'CUSTOM' && (
            <div>
              <Label htmlFor="custom-data">Custom JSON Data</Label>
              <Textarea
                id="custom-data"
                value={testCommand.customData || ''}
                onChange={(e) =>
                  setTestCommand(prev => ({ ...prev, customData: e.target.value }))
                }
                placeholder='{"customField": "customValue"}'
                rows={4}
              />
            </div>
          )}

          <div>
            <Label htmlFor="account-id">Account ID</Label>
            <Input
              id="account-id"
              value={testCommand.accountId}
              onChange={(e) =>
                setTestCommand(prev => ({ ...prev, accountId: e.target.value }))
              }
              placeholder="Auto-filled from selected EA"
            />
          </div>

          <Button
            onClick={sendTestCommand}
            disabled={!selectedClient}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            Send Test Command
          </Button>

          {commandResult && (
            <div>
              <Label>Generated Command</Label>
              <Textarea
                value={commandResult}
                readOnly
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ログ表示 */}
      <Card>
        <CardHeader>
          <CardTitle>WebSocket Log</CardTitle>
          <CardDescription>
            Real-time WebSocket events and messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto bg-gray-50 p-3 rounded font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}