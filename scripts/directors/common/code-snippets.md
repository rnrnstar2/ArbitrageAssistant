# 共通コードスニペット集

## 🔧 プロジェクト共通パターン

### TypeScript基本型定義
```typescript
// ユーザー基本型
interface User {
  id: string;
  userId: string;  // userIdベース最適化
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}

// ポジション基本型
interface Position {
  id: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  status: 'active' | 'trailing' | 'closed';
  pnl: number;
  createdAt: string;
  updatedAt: string;
}

// 市場データ基本型
interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  bid: number;
  ask: number;
  spread: number;
}
```

### エラーハンドリングパターン
```typescript
// Result型パターン
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// エラーハンドリング関数
const handleAsync = async <T>(
  promise: Promise<T>
): Promise<Result<T>> => {
  try {
    const data = await promise;
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

// 使用例
const result = await handleAsync(fetchUserData(userId));
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error.message);
}
```

## 🗄️ Backend共通パターン

### GraphQL基本パターン
```typescript
// GraphQL型定義パターン
const userType = a.model({
  userId: a.id().required(),
  email: a.email().required(),
  positions: a.hasMany('Position', 'userId'),
}).authorization(allow => [
  allow.owner().to(['read', 'update', 'delete']),
]);

// GraphQLクエリパターン
const getUserWithPositions = `
  query GetUserWithPositions($userId: ID!) {
    user(userId: $userId) {
      id
      userId
      email
      positions {
        items {
          id
          symbol
          status
          pnl
        }
      }
    }
  }
`;
```

### 認証パターン
```typescript
// JWT検証パターン
import { getCurrentUser } from 'aws-amplify/auth';

const authenticateUser = async (): Promise<Result<User>> => {
  try {
    const currentUser = await getCurrentUser();
    return { 
      success: true, 
      data: {
        id: currentUser.userId,
        userId: currentUser.userId,
        email: currentUser.signInDetails?.loginId || '',
        // ... other fields
      }
    };
  } catch (error) {
    return { success: false, error: error as Error };
  }
};
```

## ⚡ Trading共通パターン

### Position管理パターン
```typescript
// Position計算ユーティリティ
class PositionCalculator {
  static calculatePnL(position: Position, currentPrice: number): number {
    const priceDiff = position.side === 'long' 
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;
    return priceDiff * position.quantity;
  }
  
  static calculatePercentageReturn(position: Position, currentPrice: number): number {
    const pnl = this.calculatePnL(position, currentPrice);
    return (pnl / (position.entryPrice * position.quantity)) * 100;
  }
}

// Trail実行判定
class TrailManager {
  static shouldExecuteTrail(
    position: Position, 
    currentPrice: number, 
    trailConfig: TrailConfig
  ): boolean {
    if (trailConfig.type === 'percentage') {
      const percentageMove = Math.abs(
        (currentPrice - position.entryPrice) / position.entryPrice
      ) * 100;
      return percentageMove >= trailConfig.value;
    }
    return Math.abs(currentPrice - position.entryPrice) >= trailConfig.value;
  }
}
```

## 🔌 Integration共通パターン

### WebSocket通信パターン
```typescript
// WebSocket クライアント基本実装
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };
      
      this.ws.onerror = (error) => {
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.ws.onclose = () => {
        this.handleReconnect();
      };
    });
  }
  
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(this.ws?.url || ''), 1000 * this.reconnectAttempts);
    }
  }
  
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
```

## 🎨 Frontend共通パターン

### React Hook パターン
```typescript
// カスタムフック例
const useRealtimeData = (userId: string) => {
  const [data, setData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8080/realtime/${userId}`);
    
    ws.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      setData(prev => [...prev, newData]);
    };
    
    ws.onerror = (error) => {
      setError(new Error('WebSocket connection failed'));
    };
    
    ws.onopen = () => {
      setLoading(false);
    };
    
    return () => {
      ws.close();
    };
  }, [userId]);
  
  return { data, loading, error };
};

// コンポーネント状態管理パターン
const useFormValidation = <T>(initialValues: T, validationRules: any) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  
  const validate = (fieldName?: keyof T) => {
    // バリデーションロジック
  };
  
  const handleChange = (name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    validate(name);
  };
  
  return { values, errors, handleChange, validate };
};
```

### shadcn/ui活用パターン
```typescript
// 推奨コンポーネント使用例
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// フォームコンポーネント例
const TradingForm = () => {
  const { values, errors, handleChange } = useFormValidation(
    { symbol: '', quantity: 0, side: 'long' as const },
    validationRules
  );
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>新規ポジション作成</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="symbol">通貨ペア</Label>
          <Input
            id="symbol"
            value={values.symbol}
            onChange={(e) => handleChange('symbol', e.target.value)}
          />
        </div>
        <Button type="submit">ポジション作成</Button>
      </CardContent>
    </Card>
  );
};
```

## 🚀 DevOps共通パターン

### テストパターン
```typescript
// React Testing Library パターン
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('TradingForm', () => {
  it('should create position when form is submitted', async () => {
    render(<TradingForm />);
    
    fireEvent.change(screen.getByLabelText(/通貨ペア/), {
      target: { value: 'USD/JPY' }
    });
    
    fireEvent.click(screen.getByText(/ポジション作成/));
    
    await waitFor(() => {
      expect(screen.getByText(/ポジションが作成されました/)).toBeInTheDocument();
    });
  });
});

// 統合テストパターン
describe('Position Integration', () => {
  it('should handle position lifecycle', async () => {
    // 1. ポジション作成
    const position = await createPosition(testData);
    expect(position.status).toBe('active');
    
    // 2. Trail実行
    const trailResult = await executeTrail(position.id);
    expect(trailResult.success).toBe(true);
    
    // 3. 決済実行
    const settlementResult = await settlePosition(position.id);
    expect(settlementResult.success).toBe(true);
  });
});
```

## 📋 品質保証パターン

### Lint設定パターン
```json
// .eslintrc.json 推奨設定
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-console": "warn"
  }
}
```

### TypeScript設定パターン
```json
// tsconfig.json 推奨設定
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**これらのパターンを活用して、一貫性のある高品質な実装を実現してください。**