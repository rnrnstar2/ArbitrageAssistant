import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Users, Eye, Edit } from "lucide-react";
import type { ClientPC, Account } from "../hooks/useClientsData";
import type { AccountGroup } from "../types/types";
import { formatCurrency } from "../utils";

interface GroupsTabProps {
  groups: AccountGroup[];
  accounts: Account[];
  clients: ClientPC[];
}

export const GroupsTab = ({ groups, accounts, clients }: GroupsTabProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>{group.name}</span>
              </CardTitle>
              <Badge variant="outline">{group.strategy}</Badge>
            </div>
            <div className="text-sm text-gray-500">
              {group.description}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">合計残高</span>
                  <div className="font-semibold">{formatCurrency(group.totalBalance)}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">アクティブポジション</span>
                  <div className="font-semibold">{group.totalPositions}</div>
                </div>
              </div>
              
              <div>
                <span className="text-xs text-gray-500">参加口座 ({group.accounts.length}):</span>
                <div className="space-y-1 mt-2">
                  {group.accounts.map((accountId) => {
                    const account = accounts.find(a => a.id === accountId);
                    const client = account ? clients.find(c => c.id === account.clientId) : null;
                    return account && client && (
                      <div key={accountId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${client.status === "online" ? "bg-green-500" : "bg-gray-400"}`} />
                          <span className="text-sm">{account.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatCurrency(account.balance)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1">
                  <Eye className="mr-1 h-3 w-3" />
                  詳細設定
                </Button>
                <Button size="sm" variant="outline">
                  <Edit className="mr-1 h-3 w-3" />
                  編集
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};