import * as React from "react";
import { cn } from "../../lib/utils";

interface DashboardProps {
  children: React.ReactNode;
  className?: string;
}

export function Dashboard({ children, className }: DashboardProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 lg:grid-cols-[250px_1fr] min-h-screen",
      className
    )}>
      {children}
    </div>
  );
}

interface DashboardSidebarProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardSidebar({ children, className }: DashboardSidebarProps) {
  return (
    <aside className={cn(
      "bg-gray-900 text-white p-6",
      className
    )}>
      {children}
    </aside>
  );
}

interface DashboardMainProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardMain({ children, className }: DashboardMainProps) {
  return (
    <main className={cn(
      "grid grid-rows-[auto_1fr] overflow-hidden",
      className
    )}>
      {children}
    </main>
  );
}

interface DashboardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardHeader({ children, className }: DashboardHeaderProps) {
  return (
    <header className={cn(
      "bg-white border-b p-4",
      className
    )}>
      {children}
    </header>
  );
}

interface DashboardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardContent({ children, className }: DashboardContentProps) {
  return (
    <div className={cn(
      "overflow-auto p-6",
      className
    )}>
      {children}
    </div>
  );
}

Dashboard.displayName = "Dashboard";
DashboardSidebar.displayName = "DashboardSidebar";
DashboardMain.displayName = "DashboardMain";
DashboardHeader.displayName = "DashboardHeader";
DashboardContent.displayName = "DashboardContent";