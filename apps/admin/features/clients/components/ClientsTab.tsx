import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Monitor, Wifi, WifiOff, Eye } from "lucide-react";
import type { ClientPC } from "../hooks/useClientsData";
import type { AccountGroup } from "../types/types";

interface ClientsTabProps {
  clients: ClientPC[];
  groups: AccountGroup[];
}

export const ClientsTab = ({ clients, groups }: ClientsTabProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
      {clients.map((client) => (
        <Card key={client.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="h-5 w-5" />
                <span>{client.name}</span>
              </CardTitle>
              <Badge variant={client.status === "online" ? "default" : "secondary"}>
                {client.status === "online" ? (
                  <>
                    <Wifi className="mr-1 h-3 w-3" />
                    オンライン
                  </>
                ) : (
                  <>
                    <WifiOff className="mr-1 h-3 w-3" />
                    オフライン
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                最終接続: {client.lastSeen}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">口座数</span>
                  <div className="font-semibold">{client.accounts.length}</div>
                </div>
                <div>
                  <span className="text-gray-600">グループ</span>
                  <div className="font-semibold">{client.groups.length}</div>
                </div>
              </div>
              
              <div className="space-y-1">
                <span className="text-xs text-gray-500">参加グループ:</span>
                <div className="flex flex-wrap gap-1">
                  {client.groups.map((groupId) => {
                    const group = groups.find(g => g.id === groupId);
                    return group && (
                      <Badge key={groupId} variant="outline" className="text-xs">
                        {group.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex space-x-2 pt-3">
                <Button size="sm" variant="outline" className="flex-1">
                  <Eye className="mr-1 h-3 w-3" />
                  詳細
                </Button>
                <Button size="sm" variant="outline" disabled={client.status === "offline"}>
                  設定
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};