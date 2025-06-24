/**
 * Account Service - MVP システム設計書準拠の口座管理
 * 
 * 設計原則（v7.0）：
 * - userIdベースの高速クエリ
 * - クレジット（ボーナス）管理
 * - リアルタイム残高更新
 * - ボーナスアービトラージ対応
 */

import { amplifyClient, getCurrentUserId, handleGraphQLError, retryGraphQLOperation } from '../client';
import type {
  Account,
  CreateAccountInput,
  UpdateAccountInput,
  AccountFilters,
  CreditUtilization
} from '../types';

export class AccountService {
  /**
   * 口座作成
   */
  async createAccount(input: Omit<CreateAccountInput, 'userId'>): Promise<Account> {
    try {
      const userId = await getCurrentUserId();
      
      const result = await retryGraphQLOperation(async () => {
        return await amplifyClient.models.Account.create({
          ...input,
          userId,
          isActive: true, // デフォルトで有効
          lastUpdated: new Date().toISOString()
        });
      });
      
      if (!result.data) {
        throw new Error('Account creation failed');
      }
      
      console.log('✅ Account created:', result.data.id);
      return result.data;
    } catch (error) {
      console.error('❌ Create account error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * 口座更新
   */
  async updateAccount(id: string, updates: Partial<UpdateAccountInput>): Promise<Account> {
    try {
      const result = await retryGraphQLOperation(async () => {
        return await amplifyClient.models.Account.update({
          id,
          ...updates,
          lastUpdated: new Date().toISOString()
        });
      });
      
      if (!result.data) {
        throw new Error('Account update failed');
      }
      
      console.log('✅ Account updated:', id);
      return result.data;
    } catch (error) {
      console.error('❌ Update account error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * ユーザーの口座一覧取得（userIdベース高速検索）
   */
  async listUserAccounts(filters: AccountFilters = {}): Promise<Account[]> {
    try {
      const userId = await getCurrentUserId();
      
      const result = await retryGraphQLOperation(async () => {
        const queryFilter: any = { userId: { eq: userId } };
        
        if (filters.isActive !== undefined) {
          queryFilter.isActive = { eq: filters.isActive };
        }
        
        return await amplifyClient.models.Account.list({
          filter: queryFilter,
          limit: filters.limit || 100
        });
      });
      
      return result.data || [];
    } catch (error) {
      console.error('❌ List user accounts error:', error);
      return [];
    }
  }

  /**
   * アクティブ口座のみ取得
   */
  async listActiveAccounts(): Promise<Account[]> {
    return this.listUserAccounts({ isActive: true });
  }

  /**
   * 口座残高更新（MT4/MT5からの定期更新用）
   */
  async updateAccountBalance(
    id: string, 
    balance: number, 
    credit: number, 
    equity: number
  ): Promise<Account> {
    console.log('💰 Updating account balance:', id, { balance, credit, equity });
    
    return this.updateAccount(id, {
      balance,
      credit,
      equity
    });
  }

  /**
   * 口座状態切り替え
   */
  async updateAccountStatus(id: string, isActive: boolean): Promise<Account> {
    console.log('🔄 Updating account status:', id, isActive);
    return this.updateAccount(id, { isActive });
  }

  /**
   * クレジット活用状況計算（ボーナスアービトラージ対応）
   */
  async calculateCreditUtilization(accountId?: string): Promise<CreditUtilization> {
    try {
      const accounts = accountId 
        ? [await this.getAccount(accountId)].filter(Boolean)
        : await this.listActiveAccounts();
      
      if (accounts.length === 0) {
        return {
          accountId: accountId || 'all',
          totalBalance: 0,
          totalCredit: 0,
          totalEquity: 0,
          creditRatio: 0,
          utilizationRate: 0,
          availableCapacity: 0
        };
      }
      
      const totals = accounts.reduce((acc, account) => ({
        balance: acc.balance + (account?.balance || 0),
        credit: acc.credit + (account?.credit || 0),
        equity: acc.equity + (account?.equity || 0)
      }), { balance: 0, credit: 0, equity: 0 });
      
      const creditRatio = totals.balance > 0 ? totals.credit / totals.balance : 0;
      const utilizationRate = totals.credit > 0 ? (totals.balance / totals.credit) : 0;
      const availableCapacity = Math.max(0, totals.credit - totals.balance);
      
      console.log('📊 Credit utilization calculated:', {
        accounts: accounts.length,
        totals,
        creditRatio,
        utilizationRate
      });
      
      return {
        accountId: accountId || 'all',
        totalBalance: totals.balance,
        totalCredit: totals.credit,
        totalEquity: totals.equity,
        creditRatio,
        utilizationRate,
        availableCapacity
      };
    } catch (error) {
      console.error('❌ Calculate credit utilization error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * 口座容量計算（新規ポジション用）
   */
  async getAccountCapacity(accountId: string): Promise<{
    available: number;
    used: number;
    total: number;
    utilizationRate: number;
  }> {
    try {
      const account = await this.getAccount(accountId);
      if (!account) {
        throw new Error('Account not found');
      }
      
      const total = (account.balance || 0) + (account.credit || 0);
      const equity = account.equity || 0;
      const used = Math.max(0, total - equity);
      const available = Math.max(0, equity);
      const utilizationRate = total > 0 ? used / total : 0;
      
      return {
        available,
        used,
        total,
        utilizationRate
      };
    } catch (error) {
      console.error('❌ Get account capacity error:', error);
      return { available: 0, used: 0, total: 0, utilizationRate: 0 };
    }
  }

  /**
   * クレジット変動監視（定期チェック用）
   */
  async monitorCreditChanges(accountId: string, threshold: number = 0.05): Promise<{
    hasSignificantChange: boolean;
    previousCredit?: number;
    currentCredit: number;
    changeRate: number;
  }> {
    try {
      const account = await this.getAccount(accountId);
      if (!account) {
        throw new Error('Account not found');
      }
      
      const currentCredit = account.credit || 0;
      
      // 簡易実装: 前回値は外部で管理する必要がある
      // 本格実装では履歴テーブルまたはキャッシュを使用
      const previousCredit = 0; // TODO: 履歴から取得
      
      const changeRate = previousCredit > 0 
        ? Math.abs(currentCredit - previousCredit) / previousCredit 
        : 0;
      
      const hasSignificantChange = changeRate > threshold;
      
      if (hasSignificantChange) {
        console.log('⚠️ Significant credit change detected:', {
          accountId,
          previousCredit,
          currentCredit,
          changeRate
        });
      }
      
      return {
        hasSignificantChange,
        previousCredit,
        currentCredit,
        changeRate
      };
    } catch (error) {
      console.error('❌ Monitor credit changes error:', error);
      return {
        hasSignificantChange: false,
        currentCredit: 0,
        changeRate: 0
      };
    }
  }

  /**
   * 口座取得
   */
  async getAccount(id: string): Promise<Account | null> {
    try {
      const result = await amplifyClient.models.Account.get({ id });
      return result.data || null;
    } catch (error) {
      console.error('❌ Get account error:', error);
      return null;
    }
  }

  /**
   * 口座削除
   */
  async deleteAccount(id: string): Promise<boolean> {
    try {
      await amplifyClient.models.Account.delete({ id });
      console.log('✅ Account deleted:', id);
      return true;
    } catch (error) {
      console.error('❌ Delete account error:', error);
      return false;
    }
  }

  /**
   * 口座統計取得
   */
  async getAccountStats(): Promise<{
    total: number;
    active: number;
    totalBalance: number;
    totalCredit: number;
    totalEquity: number;
    averageCreditRatio: number;
  }> {
    try {
      const allAccounts = await this.listUserAccounts();
      const activeAccounts = allAccounts.filter(account => account.isActive);
      
      const totals = allAccounts.reduce((acc, account) => ({
        balance: acc.balance + (account.balance || 0),
        credit: acc.credit + (account.credit || 0),
        equity: acc.equity + (account.equity || 0)
      }), { balance: 0, credit: 0, equity: 0 });
      
      const averageCreditRatio = allAccounts.length > 0
        ? allAccounts.reduce((acc, account) => {
            const balance = account.balance || 0;
            const credit = account.credit || 0;
            return acc + (balance > 0 ? credit / balance : 0);
          }, 0) / allAccounts.length
        : 0;
      
      return {
        total: allAccounts.length,
        active: activeAccounts.length,
        totalBalance: totals.balance,
        totalCredit: totals.credit,
        totalEquity: totals.equity,
        averageCreditRatio
      };
    } catch (error) {
      console.error('❌ Get account stats error:', error);
      return {
        total: 0,
        active: 0,
        totalBalance: 0,
        totalCredit: 0,
        totalEquity: 0,
        averageCreditRatio: 0
      };
    }
  }
}

// シングルトンインスタンス
export const accountService = new AccountService();

// 便利関数エクスポート
export const updateAccount = (id: string, updates: Partial<UpdateAccountInput>) => 
  accountService.updateAccount(id, updates);

export const listUserAccounts = (filters?: AccountFilters) => 
  accountService.listUserAccounts(filters);

export const getAccount = (id: string) => 
  accountService.getAccount(id);

export const updateAccountBalance = (id: string, balance: number, credit: number, equity: number) => 
  accountService.updateAccountBalance(id, balance, credit, equity);

export const calculateCreditUtilization = (accountId?: string) => 
  accountService.calculateCreditUtilization(accountId);