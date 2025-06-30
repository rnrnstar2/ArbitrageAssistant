import * as React from "react";
import { cn } from "../../lib/utils";

interface ClusterProps {
  children: React.ReactNode;
  gap?: number;
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  className?: string;
}

export function Cluster({ 
  children, 
  gap = 4, 
  justify = "start",
  className
}: ClusterProps) {
  const justifyClasses = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end", 
    between: "justify-between",
    around: "justify-around",
    evenly: "justify-evenly"
  };

  return (
    <div className={cn(
      "flex flex-wrap",
      `gap-${gap}`,
      justifyClasses[justify],
      className
    )}>
      {children}
    </div>
  );
}

Cluster.displayName = "Cluster";