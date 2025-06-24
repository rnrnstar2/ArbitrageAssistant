/**
 * User Service - MVP システム設計書準拠のユーザー管理
 * 
 * 設計原則（v7.0）：
 * - Cognito認証との連携
 * - PCステータス管理（複数システム連携用）
 * - ユーザーロール管理
 */

import { amplifyClient, getCurrentUserId, handleGraphQLError, retryGraphQLOperation } from '../client';
import type {
  User,
  UserRole,
  PCStatus,
  CreateUserInput,
  UpdateUserInput
} from '../types';

export class UserService {
  /**
   * ユーザー作成（通常はCognito post-confirmationで自動作成）
   */
  async createUser(input: Omit<CreateUserInput, 'id'>): Promise<User> {
    try {
      const result = await retryGraphQLOperation(async () => {
        return await amplifyClient.models.User.create({
          ...input,
          isActive: true, // デフォルトで有効
        });
      });
      
      if (!result.data) {
        throw new Error('User creation failed');
      }
      
      console.log('✅ User created:', result.data.id);
      return result.data as unknown as User;
    } catch (error) {
      console.error('❌ Create user error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * ユーザー更新
   */
  async updateUser(id: string, updates: Partial<UpdateUserInput>): Promise<User> {
    try {
      const result = await retryGraphQLOperation(async () => {
        return await amplifyClient.models.User.update({
          id,
          ...updates
        });
      });
      
      if (!result.data) {
        throw new Error('User update failed');
      }
      
      console.log('✅ User updated:', id);
      return result.data as unknown as User;
    } catch (error) {
      console.error('❌ Update user error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * 現在のユーザー情報取得
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const userId = await getCurrentUserId();
      return this.getUser(userId);
    } catch (error) {
      console.error('❌ Get current user error:', error);
      return null;
    }
  }

  /**
   * ユーザー取得
   */
  async getUser(id: string): Promise<User | null> {
    try {
      const result = await amplifyClient.models.User.get({ id });
      return (result.data as unknown as User) || null;
    } catch (error) {
      console.error('❌ Get user error:', error);
      return null;
    }
  }

  /**
   * PCステータス更新（複数システム連携用）
   */
  async updatePCStatus(status: typeof PCStatus[keyof typeof PCStatus]): Promise<User | null> {
    try {
      const userId = await getCurrentUserId();
      console.log('🖥️ Updating PC status:', userId, status);
      
      return this.updateUser(userId, { 
        pcStatus: status 
      });
    } catch (error) {
      console.error('❌ Update PC status error:', error);
      return null;
    }
  }

  /**
   * ユーザー有効化/無効化
   */
  async updateUserStatus(id: string, isActive: boolean): Promise<User> {
    console.log('🔄 Updating user status:', id, isActive);
    return this.updateUser(id, { isActive });
  }

  /**
   * ユーザーロール更新
   */
  async updateUserRole(id: string, role: typeof UserRole[keyof typeof UserRole]): Promise<User> {
    console.log('👥 Updating user role:', id, role);
    return this.updateUser(id, { role });
  }

  /**
   * オンラインユーザー一覧取得（管理者用）
   */
  async listOnlineUsers(): Promise<User[]> {
    try {
      const result = await retryGraphQLOperation(async () => {
        return await amplifyClient.models.User.list({
          filter: {
            pcStatus: { eq: 'ONLINE' },
            isActive: { eq: true }
          }
        });
      });
      
      return (result.data as unknown as User[]) || [];
    } catch (error) {
      console.error('❌ List online users error:', error);
      return [];
    }
  }

  /**
   * アクティブユーザー一覧取得（管理者用）
   */
  async listActiveUsers(): Promise<User[]> {
    try {
      const result = await retryGraphQLOperation(async () => {
        return await amplifyClient.models.User.list({
          filter: {
            isActive: { eq: true }
          }
        });
      });
      
      return (result.data as unknown as User[]) || [];
    } catch (error) {
      console.error('❌ List active users error:', error);
      return [];
    }
  }

  /**
   * ユーザーがオンラインかチェック
   */
  async isUserOnline(userId?: string): Promise<boolean> {
    try {
      const targetUserId = userId || await getCurrentUserId();
      const user = await this.getUser(targetUserId);
      
      return user?.pcStatus === 'ONLINE' && user?.isActive === true;
    } catch (error) {
      console.error('❌ Check user online error:', error);
      return false;
    }
  }

  /**
   * ユーザー権限チェック
   */
  async hasPermission(permission: 'admin' | 'client'): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user || !user.isActive) return false;
      
      switch (permission) {
        case 'admin':
          return user.role === 'ADMIN';
        case 'client':
          return user.role === 'CLIENT' || user.role === 'ADMIN';
        default:
          return false;
      }
    } catch (error) {
      console.error('❌ Check permission error:', error);
      return false;
    }
  }

  /**
   * ユーザー削除
   */
  async deleteUser(id: string): Promise<boolean> {
    try {
      await amplifyClient.models.User.delete({ id });
      console.log('✅ User deleted:', id);
      return true;
    } catch (error) {
      console.error('❌ Delete user error:', error);
      return false;
    }
  }

  /**
   * ユーザー統計取得
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    online: number;
    admin: number;
    client: number;
  }> {
    try {
      const allUsers = await this.listActiveUsers();
      const onlineUsers = await this.listOnlineUsers();
      
      const stats = {
        total: allUsers.length,
        active: allUsers.filter(user => user.isActive).length,
        online: onlineUsers.length,
        admin: allUsers.filter(user => user.role === 'ADMIN').length,
        client: allUsers.filter(user => user.role === 'CLIENT').length
      };
      
      return stats;
    } catch (error) {
      console.error('❌ Get user stats error:', error);
      return { total: 0, active: 0, online: 0, admin: 0, client: 0 };
    }
  }
}

// シングルトンインスタンス
export const userService = new UserService();

// 便利関数エクスポート
export const createUser = (input: Omit<CreateUserInput, 'id'>) => 
  userService.createUser(input);

export const updateUser = (id: string, updates: Partial<UpdateUserInput>) => 
  userService.updateUser(id, updates);

export const getUser = (id: string) => 
  userService.getUser(id);

export const updateUserStatus = (id: string, isActive: boolean) => 
  userService.updateUserStatus(id, isActive);