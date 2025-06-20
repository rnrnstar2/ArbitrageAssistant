"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import { Input } from "@repo/ui/components/ui/input";
import { Switch } from "@repo/ui/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Separator } from "@repo/ui/components/ui/separator";
import { Badge } from "@repo/ui/components/ui/badge";
import { useToast } from "@repo/ui/hooks/use-toast";
import { 
  SettingsIcon, 
  ClockIcon, 
  ShieldIcon, 
  BellIcon, 
  RefreshCwIcon,
  AlertTriangleIcon,
  CheckIcon,
  XIcon,
  CalendarIcon,
  DollarSignIcon
} from "lucide-react";
import { AutoExecutionService, AutoExecutionSettings } from "../services/auto-execution-service";

interface AutoExecutionSettingsDialogProps {
  children: React.ReactNode;
}

export function AutoExecutionSettingsDialog({ children }: AutoExecutionSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AutoExecutionSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const executionService = AutoExecutionService.getInstance();

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      const currentSettings = executionService.getSettings();
      setSettings(currentSettings);
      setHasChanges(false);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "エラー",
        description: "設定の読み込みに失敗しました",
        variant: "destructive",
      });
    }
  };

  const updateSetting = <K extends keyof AutoExecutionSettings>(
    key: K, 
    value: AutoExecutionSettings[K]
  ) => {
    if (!settings) return;
    
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  const updateDayOfWeek = (day: number, checked: boolean) => {
    if (!settings) return;
    
    const newDays = checked 
      ? [...settings.daysOfWeek, day].sort()
      : settings.daysOfWeek.filter(d => d !== day);
    
    updateSetting('daysOfWeek', newDays);
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    setIsLoading(true);
    try {
      await executionService.updateSettings(settings);
      setHasChanges(false);
      toast({
        title: "設定保存",
        description: "自動実行設定を保存しました",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetToDefaults = () => {
    const defaultSettings = AutoExecutionService.getInstance().getSettings();
    setSettings(defaultSettings);
    setHasChanges(true);
  };

  const testExecution = async () => {
    try {
      await executionService.executeManually();
      toast({
        title: "テスト実行",
        description: "手動実行を開始しました",
      });
    } catch (error) {
      console.error("Error in test execution:", error);
      toast({
        title: "エラー",
        description: "テスト実行に失敗しました",
        variant: "destructive",
      });
    }
  };

  if (!settings) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center py-8">
            <div className="text-gray-500">設定を読み込み中...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const executionStatus = executionService.getExecutionStatus();
  const nextExecution = executionStatus.nextExecution;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <SettingsIcon className="h-5 w-5" />
            <span>自動実行設定</span>
            {executionStatus.enabled && (
              <Badge variant="default" className="ml-2">有効</Badge>
            )}
            {hasChanges && (
              <Badge variant="secondary" className="ml-2">未保存</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ステータス概要 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">状態</div>
                <div className={`font-medium flex items-center space-x-1 ${settings.enabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {settings.enabled ? <CheckIcon className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
                  <span>{settings.enabled ? '有効' : '無効'}</span>
                </div>
              </div>
              <div>
                <div className="text-gray-500">次回実行</div>
                <div className="font-medium">
                  {nextExecution ? nextExecution.toLocaleString() : '未設定'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">実行モード</div>
                <div className="font-medium">
                  {settings.dryRunMode ? 'ドライラン' : '本番実行'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">連続失敗</div>
                <div className={`font-medium ${executionStatus.consecutiveFailures > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {executionStatus.consecutiveFailures} / {settings.maxConsecutiveFailures}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">基本設定</TabsTrigger>
            <TabsTrigger value="execution">実行条件</TabsTrigger>
            <TabsTrigger value="safety">安全設定</TabsTrigger>
            <TabsTrigger value="notifications">通知設定</TabsTrigger>
            <TabsTrigger value="rebuild">再構築設定</TabsTrigger>
          </TabsList>

          {/* 基本設定 */}
          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ClockIcon className="h-4 w-4" />
                  <span>スケジュール設定</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled" className="text-base">自動実行を有効にする</Label>
                  <Switch
                    id="enabled"
                    checked={settings.enabled}
                    onCheckedChange={(checked) => updateSetting('enabled', checked)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="executionTime">実行時刻</Label>
                    <Select
                      value={settings.executionTime}
                      onValueChange={(value) => updateSetting('executionTime', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="22:00">22:00</SelectItem>
                        <SelectItem value="22:30">22:30</SelectItem>
                        <SelectItem value="23:00">23:00</SelectItem>
                        <SelectItem value="23:30">23:30</SelectItem>
                        <SelectItem value="00:00">00:00</SelectItem>
                        <SelectItem value="00:30">00:30</SelectItem>
                        <SelectItem value="01:00">01:00</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">タイムゾーン</Label>
                    <Select
                      value={settings.timezone}
                      onValueChange={(value) => updateSetting('timezone', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>実行曜日</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {dayNames.map((dayName, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${index}`}
                          checked={settings.daysOfWeek.includes(index)}
                          onCheckedChange={(checked) => updateDayOfWeek(index, checked as boolean)}
                        />
                        <Label htmlFor={`day-${index}`} className="text-sm">{dayName}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 実行条件 */}
          <TabsContent value="execution" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSignIcon className="h-4 w-4" />
                  <span>実行条件</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minSwapCostThreshold">最小スワップコスト閾値 ($)</Label>
                    <Input
                      id="minSwapCostThreshold"
                      type="number"
                      step="0.1"
                      value={settings.minSwapCostThreshold}
                      onChange={(e) => updateSetting('minSwapCostThreshold', parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxPositionsPerExecution">1回当たり最大処理ポジション数</Label>
                    <Input
                      id="maxPositionsPerExecution"
                      type="number"
                      value={settings.maxPositionsPerExecution}
                      onChange={(e) => updateSetting('maxPositionsPerExecution', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requireManualApproval">手動承認を必要とする</Label>
                    <Switch
                      id="requireManualApproval"
                      checked={settings.requireManualApproval}
                      onCheckedChange={(checked) => updateSetting('requireManualApproval', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="excludeHedgedPositions">両建てポジションを除外</Label>
                    <Switch
                      id="excludeHedgedPositions"
                      checked={settings.excludeHedgedPositions}
                      onCheckedChange={(checked) => updateSetting('excludeHedgedPositions', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="excludeProfitablePositions">利益のあるポジションを除外</Label>
                    <Switch
                      id="excludeProfitablePositions"
                      checked={settings.excludeProfitablePositions}
                      onCheckedChange={(checked) => updateSetting('excludeProfitablePositions', checked)}
                    />
                  </div>

                  {settings.excludeProfitablePositions && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="profitableThreshold">利益閾値 ($)</Label>
                      <Input
                        id="profitableThreshold"
                        type="number"
                        step="0.1"
                        value={settings.profitableThreshold}
                        onChange={(e) => updateSetting('profitableThreshold', parseFloat(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 安全設定 */}
          <TabsContent value="safety" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ShieldIcon className="h-4 w-4" />
                  <span>安全設定</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dryRunMode" className="text-base">ドライランモード</Label>
                    <div className="text-sm text-gray-500">実際の決済は行わず、動作のみシミュレート</div>
                  </div>
                  <Switch
                    id="dryRunMode"
                    checked={settings.dryRunMode}
                    onCheckedChange={(checked) => updateSetting('dryRunMode', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label htmlFor="stopOnError">エラー時に実行を停止</Label>
                  <Switch
                    id="stopOnError"
                    checked={settings.stopOnError}
                    onCheckedChange={(checked) => updateSetting('stopOnError', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxConsecutiveFailures">最大連続失敗回数</Label>
                  <Input
                    id="maxConsecutiveFailures"
                    type="number"
                    value={settings.maxConsecutiveFailures}
                    onChange={(e) => updateSetting('maxConsecutiveFailures', parseInt(e.target.value))}
                  />
                  <div className="text-sm text-gray-500">
                    この回数連続で失敗すると自動実行を無効にします
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 通知設定 */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BellIcon className="h-4 w-4" />
                  <span>通知設定</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifyBeforeExecution">実行前通知</Label>
                    <Switch
                      id="notifyBeforeExecution"
                      checked={settings.notifyBeforeExecution}
                      onCheckedChange={(checked) => updateSetting('notifyBeforeExecution', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifyAfterExecution">実行後通知</Label>
                    <Switch
                      id="notifyAfterExecution"
                      checked={settings.notifyAfterExecution}
                      onCheckedChange={(checked) => updateSetting('notifyAfterExecution', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifyOnError">エラー時通知</Label>
                    <Switch
                      id="notifyOnError"
                      checked={settings.notifyOnError}
                      onCheckedChange={(checked) => updateSetting('notifyOnError', checked)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notificationMinutes">事前通知時間（分）</Label>
                  <Input
                    id="notificationMinutes"
                    type="number"
                    value={settings.notificationMinutes}
                    onChange={(e) => updateSetting('notificationMinutes', parseInt(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 再構築設定 */}
          <TabsContent value="rebuild" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <RefreshCwIcon className="h-4 w-4" />
                  <span>再構築設定</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoRebuild" className="text-base">自動再構築</Label>
                    <div className="text-sm text-gray-500">決済後に同じポジションを再構築</div>
                  </div>
                  <Switch
                    id="autoRebuild"
                    checked={settings.autoRebuild}
                    onCheckedChange={(checked) => updateSetting('autoRebuild', checked)}
                  />
                </div>

                {settings.autoRebuild && (
                  <>
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label htmlFor="rebuildDelayMinutes">再構築遅延時間（分）</Label>
                      <Input
                        id="rebuildDelayMinutes"
                        type="number"
                        value={settings.rebuildDelayMinutes}
                        onChange={(e) => updateSetting('rebuildDelayMinutes', parseInt(e.target.value))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="rebuildOnSameAccount">同一アカウントで再構築</Label>
                      <Switch
                        id="rebuildOnSameAccount"
                        checked={settings.rebuildOnSameAccount}
                        onCheckedChange={(checked) => updateSetting('rebuildOnSameAccount', checked)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* フッター */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex space-x-2">
            <Button variant="outline" onClick={resetToDefaults}>
              デフォルトに戻す
            </Button>
            <Button variant="outline" onClick={testExecution}>
              テスト実行
            </Button>
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={saveSettings} 
              disabled={!hasChanges || isLoading}
            >
              {isLoading ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}