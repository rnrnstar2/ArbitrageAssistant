"use client";

import { SystemProvider } from './context/SystemContext';
import { 
  SystemHeader,
  SystemSummaryCard,
  EAConnectionList,
  QuickActionPanel,
  SettingsModal,
  SystemFooter,
  ControlBar
} from './components';
import { DashboardProps } from './types';

function DashboardContent({ className }: DashboardProps) {
  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ${className || ''}`}>
      <SystemHeader />
      
      <div className="p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <ControlBar />
          <SystemSummaryCard />
          <EAConnectionList />
          <QuickActionPanel />
          <SystemFooter />
        </div>
      </div>
      
      <SettingsModal />
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