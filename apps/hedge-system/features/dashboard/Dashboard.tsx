"use client";

import React from 'react';
import { SystemProvider } from './context/SystemContext';
import { EnhancedSystemOverview } from './components/EnhancedSystemOverview';
import { DashboardProps } from './types';

function DashboardContent({ className }: DashboardProps) {
  return (
    <div className={`min-h-screen bg-gray-50 ${className || ''}`}>
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-xl font-bold text-gray-900">
              Hedge System Monitor
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              ポジション管理型自動取引システム - リアルタイム監視
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <EnhancedSystemOverview />
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