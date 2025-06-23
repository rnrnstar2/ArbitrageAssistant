import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeftRight, Plus } from "lucide-react";
import type { Account } from "../hooks/useClientsData";

interface LinkingTabProps {
  accounts: Account[];
}

export const LinkingTab = ({ accounts }: LinkingTabProps) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ArrowLeftRight className="h-5 w-5" />
            <span>口座間連動設定</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {accounts.filter(acc => acc.linkedAccounts.length > 0).map((account) => {
                const linkedAccount = accounts.find(a => a.id === account.linkedAccounts[0]);
                return linkedAccount && (
                  <div key={account.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">連動ペア</h4>
                      <Badge variant="outline">アクティブ</Badge>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="flex-1 text-center">
                        <div className="p-3 bg-blue-50 rounded">
                          <div className="font-medium text-sm">{account.name}</div>
                          <div className="text-xs text-gray-500">基準口座</div>
                        </div>
                      </div>
                      
                      <ArrowLeftRight className="h-5 w-5 text-gray-400" />
                      
                      <div className="flex-1 text-center">
                        <div className="p-3 bg-green-50 rounded">
                          <div className="font-medium text-sm">{linkedAccount.name}</div>
                          <div className="text-xs text-gray-500">連動口座</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 text-xs text-gray-500 text-center">
                      ロット比率: 1:1 • 逆方向エントリー
                    </div>
                    
                    <div className="flex space-x-2 mt-4">
                      <Button size="sm" variant="outline" className="flex-1">
                        設定変更
                      </Button>
                      <Button size="sm" variant="outline">
                        一時停止
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="pt-4 border-t">
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                新規連動設定
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};