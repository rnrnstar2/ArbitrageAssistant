import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Plus } from "lucide-react";
import { QuickStrategyPreset } from "../types";
import { getTypeIcon } from "../utils";

interface QuickStrategyCardProps {
  quickPresets: QuickStrategyPreset[];
  isLoading: boolean;
}

export function QuickStrategyCard({ quickPresets, isLoading }: QuickStrategyCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>クイック戦略作成</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 border rounded">
                <div className="w-24 h-4 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="w-full h-3 bg-gray-200 rounded animate-pulse" />
              </div>
            ))
          ) : (
            quickPresets.map((preset) => {
              const Icon = getTypeIcon(preset.type);
              return (
                <Button
                  key={preset.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-3"
                >
                  <div className="flex items-start space-x-3">
                    <Icon className="h-4 w-4 mt-0.5 text-blue-600" />
                    <div className="text-left">
                      <div className="font-medium text-sm">{preset.name}</div>
                      <div className="text-xs text-gray-500">{preset.description}</div>
                    </div>
                  </div>
                </Button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}