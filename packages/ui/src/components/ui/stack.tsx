import * as React from "react";
import { cn } from "../../lib/utils";

interface StackProps {
  children: React.ReactNode;
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  className?: string;
}

export function Stack({ 
  children, 
  gap = 4, 
  align = "stretch",
  className
}: StackProps) {
  const alignClasses = {
    start: "items-start",
    center: "items-center", 
    end: "items-end",
    stretch: "items-stretch"
  };

  return (
    <div className={cn(
      "flex flex-col",
      `gap-${gap}`, 
      alignClasses[align],
      className
    )}>
      {children}
    </div>
  );
}

Stack.displayName = "Stack";