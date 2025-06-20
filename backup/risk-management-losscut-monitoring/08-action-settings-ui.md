# Task 08: アクション設定画面UIの実装

## 概要
ポジション別ネクストアクション設定と自動実行条件を管理するUI画面を実装する。ユーザーが直感的にリスク対応ルールを設定できる画面。

## 実装対象ファイル
- `apps/admin/src/features/risk-management/components/ActionSettingsPage.tsx`
- `apps/admin/src/features/risk-management/components/ActionChainBuilder.tsx`
- `apps/admin/src/features/risk-management/components/TriggerConditionEditor.tsx`
- `apps/admin/src/features/risk-management/components/ActionStepEditor.tsx`
- `apps/admin/src/features/risk-management/hooks/useActionSettings.ts`

## 具体的な実装内容

### ActionSettingsPage.tsx
```typescript
export const ActionSettingsPage: React.FC = () => {
  const {
    actionChains,
    selectedChain,
    isLoading,
    saveActionChain,
    deleteActionChain,
    setSelectedChain
  } = useActionSettings()
  
  return (
    <div className="action-settings-page">
      <PageHeader>
        <h1>アクション設定</h1>
        <Button onClick={() => setSelectedChain(null)}>
          新規作成
        </Button>
      </PageHeader>
      
      <div className="settings-layout">
        {/* 左側: アクション一覧 */}
        <div className="action-list-panel">
          <ActionChainList
            chains={actionChains}
            selectedId={selectedChain?.id}
            onSelect={setSelectedChain}
            onDelete={deleteActionChain}
          />
        </div>
        
        {/* 右側: 編集エリア */}
        <div className="action-editor-panel">
          {selectedChain ? (
            <ActionChainBuilder
              actionChain={selectedChain}
              onSave={saveActionChain}
              onCancel={() => setSelectedChain(null)}
            />
          ) : (
            <EmptyState message="アクションチェーンを選択してください" />
          )}
        </div>
      </div>
    </div>
  )
}
```

### ActionChainBuilder.tsx
```typescript
interface ActionChainBuilderProps {
  actionChain: ActionChain
  onSave: (chain: ActionChain) => void
  onCancel: () => void
}

export const ActionChainBuilder: React.FC<ActionChainBuilderProps> = ({
  actionChain,
  onSave,
  onCancel
}) => {
  const [editingChain, setEditingChain] = useState(actionChain)
  const [errors, setErrors] = useState<ValidationError[]>([])
  
  const handleSave = async () => {
    const validationResult = validateActionChain(editingChain)
    if (!validationResult.isValid) {
      setErrors(validationResult.errors)
      return
    }
    
    await onSave(editingChain)
    setErrors([])
  }
  
  return (
    <div className="action-chain-builder">
      <div className="builder-header">
        <Input
          label="チェーン名"
          value={editingChain.name}
          onChange={(name) => setEditingChain({ ...editingChain, name })}
          placeholder="例: ロスカット緊急対応"
        />
        
        <Select
          label="優先度"
          value={editingChain.priority}
          onChange={(priority) => setEditingChain({ ...editingChain, priority })}
          options={[
            { value: 1, label: '最高' },
            { value: 2, label: '高' },
            { value: 3, label: '中' },
            { value: 4, label: '低' }
          ]}
        />
      </div>
      
      {/* トリガー条件設定 */}
      <Card className="trigger-section">
        <CardHeader>
          <h3>トリガー条件</h3>
        </CardHeader>
        <CardContent>
          <TriggerConditionEditor
            trigger={editingChain.trigger}
            onChange={(trigger) => setEditingChain({ ...editingChain, trigger })}
          />
        </CardContent>
      </Card>
      
      {/* アクションステップ設定 */}
      <Card className="actions-section">
        <CardHeader>
          <h3>実行アクション</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => addActionStep(editingChain, setEditingChain)}
          >
            + アクション追加
          </Button>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={(result) => handleActionReorder(result, setEditingChain)}>
            <Droppable droppableId="actions">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {editingChain.actions.map((action, index) => (
                    <Draggable key={action.id} draggableId={action.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <ActionStepEditor
                            action={action}
                            index={index}
                            onChange={(updatedAction) => updateActionStep(index, updatedAction, setEditingChain)}
                            onDelete={() => deleteActionStep(index, setEditingChain)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>
      
      {/* エラー表示 */}
      {errors.length > 0 && (
        <Alert variant="error">
          <h4>設定エラー</h4>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
          </ul>
        </Alert>
      )}
      
      {/* 保存/キャンセルボタン */}
      <div className="builder-actions">
        <Button variant="primary" onClick={handleSave}>
          保存
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </div>
  )
}
```

### TriggerConditionEditor.tsx
```typescript
interface TriggerConditionEditorProps {
  trigger: TriggerCondition
  onChange: (trigger: TriggerCondition) => void
}

export const TriggerConditionEditor: React.FC<TriggerConditionEditorProps> = ({
  trigger,
  onChange
}) => {
  return (
    <div className="trigger-editor">
      <div className="trigger-type">
        <Select
          label="トリガー種類"
          value={trigger.type}
          onChange={(type) => onChange({ ...trigger, type })}
          options={[
            { value: 'margin_level', label: '証拠金維持率' },
            { value: 'loss_amount', label: '損失額' },
            { value: 'profit_target', label: '利益目標' },
            { value: 'manual', label: '手動実行' }
          ]}
        />
      </div>
      
      {trigger.type !== 'manual' && (
        <>
          <div className="trigger-operator">
            <Select
              label="条件"
              value={trigger.operator}
              onChange={(operator) => onChange({ ...trigger, operator })}
              options={[
                { value: 'lt', label: '未満' },
                { value: 'lte', label: '以下' },
                { value: 'gt', label: '超過' },
                { value: 'gte', label: '以上' },
                { value: 'eq', label: '等しい' }
              ]}
            />
          </div>
          
          <div className="trigger-value">
            <Input
              label={getTriggerValueLabel(trigger.type)}
              type="number"
              value={trigger.value}
              onChange={(value) => onChange({ ...trigger, value: Number(value) })}
              placeholder="閾値を入力"
            />
          </div>
        </>
      )}
      
      <div className="trigger-account">
        <Select
          label="対象口座"
          value={trigger.accountId || 'all'}
          onChange={(accountId) => onChange({ 
            ...trigger, 
            accountId: accountId === 'all' ? undefined : accountId 
          })}
          options={[
            { value: 'all', label: '全口座' },
            ...accountOptions
          ]}
        />
      </div>
      
      {/* プレビュー表示 */}
      <div className="trigger-preview">
        <Label>条件プレビュー</Label>
        <div className="preview-text">
          {formatTriggerCondition(trigger)}
        </div>
      </div>
    </div>
  )
}
```

### ActionStepEditor.tsx
```typescript
interface ActionStepEditorProps {
  action: ActionStep
  index: number
  onChange: (action: ActionStep) => void
  onDelete: () => void
}

export const ActionStepEditor: React.FC<ActionStepEditorProps> = ({
  action,
  index,
  onChange,
  onDelete
}) => {
  return (
    <Card className="action-step-editor">
      <CardHeader>
        <div className="step-header">
          <div className="step-number">{index + 1}</div>
          <Select
            value={action.type}
            onChange={(type) => onChange({ ...action, type })}
            options={ACTION_TYPE_OPTIONS}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="delete-button"
          >
            <TrashIcon />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* アクション固有のパラメータ設定 */}
        <ActionParametersEditor
          actionType={action.type}
          parameters={action.parameters}
          onChange={(parameters) => onChange({ ...action, parameters })}
        />
        
        <div className="action-options">
          <div className="option-row">
            <Input
              label="タイムアウト (秒)"
              type="number"
              value={action.timeout / 1000}
              onChange={(value) => onChange({ 
                ...action, 
                timeout: Number(value) * 1000 
              })}
            />
            
            <Input
              label="リトライ回数"
              type="number"
              value={action.retryCount}
              onChange={(retryCount) => onChange({ 
                ...action, 
                retryCount: Number(retryCount) 
              })}
            />
          </div>
          
          <div className="dependencies">
            <Select
              label="依存アクション"
              multiple
              value={action.dependsOn || []}
              onChange={(dependsOn) => onChange({ ...action, dependsOn })}
              options={getDependencyOptions(index)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

## データ型とバリデーション
```typescript
interface ValidationError {
  field: string
  message: string
}

const validateActionChain = (chain: ActionChain): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (!chain.name.trim()) {
    errors.push({ field: 'name', message: 'チェーン名は必須です' })
  }
  
  if (chain.actions.length === 0) {
    errors.push({ field: 'actions', message: '最低1つのアクションが必要です' })
  }
  
  // 循環依存チェック
  if (hasCyclicDependency(chain.actions)) {
    errors.push({ field: 'dependencies', message: '循環依存が検出されました' })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}
```

## 完了条件
- [ ] ActionSettingsPage 実装
- [ ] ActionChainBuilder 実装
- [ ] TriggerConditionEditor 実装
- [ ] ActionStepEditor 実装
- [ ] useActionSettings hook実装
- [ ] ドラッグ&ドロップ機能
- [ ] バリデーション機能
- [ ] 設定のインポート/エクスポート
- [ ] コンポーネントテスト実装

## UI/UX要件
- 直感的なドラッグ&ドロップ操作
- リアルタイムバリデーション
- 設定プレビュー表示
- アクションテンプレート機能
- 設定の複製・編集機能

## 参考ファイル
- `apps/admin/features/monitoring/alerts/`
- 既存の設定画面コンポーネント

## 注意事項
- 複雑な設定でもユーザビリティを保つ
- 設定ミスによる事故防止
- 設定変更の履歴管理
- 緊急時の設定無効化機能