'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Input } from '@repo/ui/components/ui/input'
import { Label } from '@repo/ui/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select'
import { Checkbox } from '@repo/ui/components/ui/checkbox'
import { Badge } from '@repo/ui/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@repo/ui/components/ui/alert-dialog'

import { LinkedPositionDetector } from './linked-position-detector'
import { 
  Position, 
  LinkedPositionGroup, 
  LinkedCloseRequest, 
  LinkedCloseAction, 
  LinkedCloseSettings,
  RelationType 
} from './types'

interface LinkedPositionCloseSettingsProps {
  positions: Position[]
  selectedPosition: Position
  onCloseRequest: (request: LinkedCloseRequest) => void
  onCancel: () => void
  className?: string
}

export function LinkedPositionCloseSettings({
  positions,
  selectedPosition,
  onCloseRequest,
  onCancel,
  className = ''
}: LinkedPositionCloseSettingsProps) {
  const [settings, setSettings] = useState<LinkedCloseSettings>({
    enabled: true,
    closeOrder: 'simultaneous',
    sequentialDelay: 5,
    rollbackOnFailure: true,
    partialCloseHandling: 'proportional'
  })

  const [actions, setActions] = useState<Map<string, LinkedCloseAction>>(new Map())

  // 関連ポジションを検出
  const linkedPositions = useMemo(() => {
    return LinkedPositionDetector.findLinkedPositions(selectedPosition, positions)
  }, [selectedPosition, positions])

  // ポジショングループを作成
  const positionGroup = useMemo(() => {
    if (linkedPositions.length === 0) return null
    
    return {
      primaryPosition: selectedPosition,
      linkedPositions,
      totalExposure: 0, // LinkedPositionDetectorで計算済み
      netProfit: selectedPosition.profit + linkedPositions.reduce((sum, lp) => sum + lp.position.profit, 0)
    }
  }, [selectedPosition, linkedPositions])

  // アクション更新
  const updateAction = (positionId: string, updates: Partial<LinkedCloseAction>) => {
    const current = actions.get(positionId) || {
      positionId,
      action: 'close',
      closeType: 'market',
      priority: 1
    }
    
    setActions(new Map(actions.set(positionId, { ...current, ...updates })))
  }

  // 関連タイプのバッジ色
  const getRelationBadgeColor = (type: RelationType) => {
    switch (type) {
      case RelationType.HEDGE: return 'bg-red-100 text-red-800'
      case RelationType.SAME_PAIR: return 'bg-blue-100 text-blue-800'
      case RelationType.CORRELATION: return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 決済実行
  const handleExecuteClose = () => {
    const allActions: LinkedCloseAction[] = [
      {
        positionId: selectedPosition.id,
        action: 'close',
        closeType: 'market',
        priority: 0
      }
    ]

    // 関連ポジションのアクションを追加
    linkedPositions.forEach((lp, index) => {
      const action = actions.get(lp.position.id) || {
        positionId: lp.position.id,
        action: 'close',
        closeType: 'market',
        priority: index + 1
      }
      allActions.push(action)
    })

    const request: LinkedCloseRequest = {
      primaryPositionId: selectedPosition.id,
      actions: allActions,
      settings
    }

    onCloseRequest(request)
  }

  if (!positionGroup) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>関連ポジションなし</CardTitle>
          <CardDescription>
            選択されたポジションに関連するポジションが見つかりませんでした。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={() => onCloseRequest({
              primaryPositionId: selectedPosition.id,
              actions: [{
                positionId: selectedPosition.id,
                action: 'close',
                closeType: 'market',
                priority: 0
              }],
              settings: { ...settings, enabled: false }
            })}>
              単独で決済
            </Button>
            <Button variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* プライマリポジション */}
      <Card>
        <CardHeader>
          <CardTitle>プライマリポジション</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{selectedPosition.symbol}</div>
              <div className="text-sm text-gray-500">
                {selectedPosition.type.toUpperCase()} {selectedPosition.lots} lots @ {selectedPosition.openPrice}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-medium ${selectedPosition.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {selectedPosition.profit >= 0 ? '+' : ''}{selectedPosition.profit.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">
                Current: {selectedPosition.currentPrice}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 関連ポジション */}
      <Card>
        <CardHeader>
          <CardTitle>関連ポジション ({linkedPositions.length}件)</CardTitle>
          <CardDescription>
            純損益: <span className={`font-medium ${positionGroup.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {positionGroup.netProfit >= 0 ? '+' : ''}{positionGroup.netProfit.toFixed(2)}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkedPositions.map((lp) => {
            const action = actions.get(lp.position.id)
            return (
              <div key={lp.position.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getRelationBadgeColor(lp.relationType)}>
                      {lp.relationType === RelationType.HEDGE && '両建て'}
                      {lp.relationType === RelationType.SAME_PAIR && '同一ペア'}
                      {lp.relationType === RelationType.CORRELATION && `相関 ${(lp.correlation! * 100).toFixed(0)}%`}
                    </Badge>
                    <div>
                      <div className="font-medium">{lp.position.symbol}</div>
                      <div className="text-sm text-gray-500">
                        {lp.position.type.toUpperCase()} {lp.position.lots} lots
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${lp.position.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {lp.position.profit >= 0 ? '+' : ''}{lp.position.profit.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`action-${lp.position.id}`}>アクション</Label>
                    <Select 
                      value={action?.action || 'close'} 
                      onValueChange={(value) => updateAction(lp.position.id, { action: value as any })}
                    >
                      <SelectTrigger id={`action-${lp.position.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="close">決済</SelectItem>
                        <SelectItem value="trail">トレール</SelectItem>
                        <SelectItem value="none">何もしない</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor={`closeType-${lp.position.id}`}>決済タイプ</Label>
                    <Select 
                      value={action?.closeType || 'market'} 
                      onValueChange={(value) => updateAction(lp.position.id, { closeType: value as any })}
                      disabled={action?.action === 'none'}
                    >
                      <SelectTrigger id={`closeType-${lp.position.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="market">成行</SelectItem>
                        <SelectItem value="limit">指値</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {action?.closeType === 'limit' && action?.action !== 'none' && (
                  <div>
                    <Label htmlFor={`targetPrice-${lp.position.id}`}>目標価格</Label>
                    <Input
                      id={`targetPrice-${lp.position.id}`}
                      type="number"
                      step="0.00001"
                      value={action.targetPrice || ''}
                      onChange={(e) => updateAction(lp.position.id, { targetPrice: parseFloat(e.target.value) })}
                      placeholder="目標価格を入力"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* 実行設定 */}
      <Card>
        <CardHeader>
          <CardTitle>実行設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="closeOrder">実行順序</Label>
            <Select 
              value={settings.closeOrder} 
              onValueChange={(value) => setSettings(prev => ({ ...prev, closeOrder: value as any }))}
            >
              <SelectTrigger id="closeOrder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simultaneous">同時実行</SelectItem>
                <SelectItem value="sequential">順次実行</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.closeOrder === 'sequential' && (
            <div>
              <Label htmlFor="sequentialDelay">実行間隔（秒）</Label>
              <Input
                id="sequentialDelay"
                type="number"
                min="1"
                max="60"
                value={settings.sequentialDelay}
                onChange={(e) => setSettings(prev => ({ ...prev, sequentialDelay: parseInt(e.target.value) }))}
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rollbackOnFailure"
              checked={settings.rollbackOnFailure}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, rollbackOnFailure: checked as boolean }))}
            />
            <Label htmlFor="rollbackOnFailure">失敗時のロールバック</Label>
          </div>

          <div>
            <Label htmlFor="partialCloseHandling">部分決済の処理</Label>
            <Select 
              value={settings.partialCloseHandling} 
              onValueChange={(value) => setSettings(prev => ({ ...prev, partialCloseHandling: value as any }))}
            >
              <SelectTrigger id="partialCloseHandling">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proportional">比例的に処理</SelectItem>
                <SelectItem value="primary_only">プライマリのみ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 実行ボタン */}
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>連動決済を実行</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>連動決済の確認</AlertDialogTitle>
              <AlertDialogDescription>
                {linkedPositions.length + 1}件のポジションを連動決済します。
                この操作は取り消せません。実行してよろしいですか？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleExecuteClose}>
                実行
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <Button variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </div>
  )
}