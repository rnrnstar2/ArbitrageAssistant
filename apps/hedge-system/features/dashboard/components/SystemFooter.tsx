"use client";

import { useSystem } from '../context/SystemContext';

export function SystemFooter() {
  const { systemStatus } = useSystem();

  return (
    <div className="text-center text-sm text-gray-500 py-4">
      <p>
        WebSocketサーバー: ポート {systemStatus.webSocketPort} | 
        Admin接続: {systemStatus.adminConnected ? '正常' : '切断'} | 
        稼働時間: {systemStatus.uptime}
      </p>
    </div>
  );
}