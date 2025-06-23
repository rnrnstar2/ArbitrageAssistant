import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Link, Eye, Edit, AlertTriangle } from "lucide-react";
// Temporary types for MVP (until proper models are implemented)
type User = any;
type Account = any;
import { formatCurrency, getMarginLevelColor } from "../utils";

interface AccountsTabProps {
  accounts: Account[];
  clients: User[];
}

export const AccountsTab = ({ accounts, clients }: AccountsTabProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {accounts.map((account) => {
        const client = clients.find(c => c.id === account.userId);
        return (
          <Card key={account.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{account.name}</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {account.isActive ? '稼働中' : '停止中'}
                  </Badge>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {client?.name} • {account.broker}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-500">残高</span>
                    <div className="font-semibold">{formatCurrency(account.balance)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">有効証拠金</span>
                    <div className="font-semibold">{formatCurrency(account.equity)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">必要証拠金</span>
                    <div className="font-semibold">{formatCurrency(account.margin)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">証拠金維持率</span>
                    <div className={`font-semibold ${getMarginLevelColor(account.marginLevel)}`}>
                      {account.marginLevel > 0 ? `${account.marginLevel}%` : "-"}
                    </div>
                  </div>
                </div>
                
                {account.marginLevel > 0 && account.marginLevel < 200 && (
                  <div className="flex items-center space-x-2 p-2 bg-yellow-50 rounded text-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">証拠金維持率が低下しています</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">アカウント番号: {account.accountNumber}</span>
                  <Badge variant="outline">{account.broker}</Badge>
                </div>
                
                <div className="flex space-x-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Eye className="mr-1 h-3 w-3" />
                    詳細
                  </Button>
                  <Button size="sm" variant="outline">
                    <Edit className="mr-1 h-3 w-3" />
                    編集
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};