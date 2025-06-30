import * as React from "react";
import { cn } from "../../lib/utils";

interface AutoGridProps {
  children: React.ReactNode;
  minWidth?: number;
  gap?: number;
  className?: string;
}

export function AutoGrid({ 
  children, 
  minWidth = 300, 
  gap = 6,
  className
}: AutoGridProps) {
  return (
    <div 
      className={cn(
        "grid",
        `gap-${gap}`,
        className
      )}
      style={{ 
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` 
      }}
    >
      {children}
    </div>
  );
}

AutoGrid.displayName = "AutoGrid";