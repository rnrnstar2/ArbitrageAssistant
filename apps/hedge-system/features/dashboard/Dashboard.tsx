"use client";

import React, { useState } from 'react';
import { SystemProvider } from './context/SystemContext';
import { 
  SystemStatus,
  ConnectionManager,
  TrailMonitor,
  ActionQueue
} from './components';
import { DashboardProps } from './types';

function DashboardContent({ className }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('status');

  return (
    <div className={`min-h-screen bg-gray-100 ${className || ''}`}>
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Hedge System
            </h1>
            <div className="flex space-x-4">
              <button
                className={`px-4 py-2 rounded ${
                  activeTab === 'status' ? 'bg-blue-500 text-white' : 'text-gray-500'
                }`}
                onClick={() => setActiveTab('status')}
              >
                システム状態
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  activeTab === 'connections' ? 'bg-blue-500 text-white' : 'text-gray-500'
                }`}
                onClick={() => setActiveTab('connections')}
              >
                EA接続
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  activeTab === 'trail' ? 'bg-blue-500 text-white' : 'text-gray-500'
                }`}
                onClick={() => setActiveTab('trail')}
              >
                トレール監視
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  activeTab === 'actions' ? 'bg-blue-500 text-white' : 'text-gray-500'
                }`}
                onClick={() => setActiveTab('actions')}
              >
                アクション
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'status' && <SystemStatus />}
        {activeTab === 'connections' && <ConnectionManager />}
        {activeTab === 'trail' && <TrailMonitor />}
        {activeTab === 'actions' && <ActionQueue />}
      </div>
    </div>
  );
}

export function Dashboard(props: DashboardProps) {
  return (
    <SystemProvider>
      <DashboardContent {...props} />
    </SystemProvider>
  );
}