import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { env } from '$amplify/env/post-confirmation';
import type { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognitoClient = new CognitoIdentityProviderClient();

interface UserValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * ユーザー情報の妥当性を検証
 */
function validateUserData(userId: string, email: string, name: string): UserValidationResult {
  const errors: string[] = [];

  // ユーザーID検証
  if (!userId || userId.trim().length === 0) {
    errors.push('User ID is required');
  }

  // メールアドレス検証
  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
  }

  // 名前検証
  if (!name || name.trim().length === 0) {
    errors.push('Name is required');
  } else if (name.length > 100) {
    errors.push('Name is too long');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * リトライ機能付きの処理実行
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error = new Error('No attempts made');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${operationName} - Attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      
      if (attempt > 1) {
        console.log(`${operationName} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      console.error(`${operationName} failed on attempt ${attempt}:`, error);
      
      if (attempt < maxRetries) {
        const delay = delayMs * attempt; // 指数バックオフ
        console.log(`Retrying ${operationName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const startTime = Date.now();
  const userId = event.request.userAttributes.sub;
  
  console.log('🚀 Post-confirmation handler started', {
    userId,
    triggerSource: event.triggerSource,
    userPoolId: event.userPoolId,
    timestamp: new Date().toISOString(),
  });

  let groupAdded = false;
  let userCreated = false;

  try {
    const { userAttributes } = event.request;
    const { userPoolId } = event;
    
    // ユーザー情報を取得・検証
    const email = userAttributes.email;
    const name = userAttributes.fullname || userAttributes.given_name || email.split('@')[0];
    
    console.log('📝 Processing user data', { userId, email, name });

    // 入力データの妥当性検証
    const validation = validateUserData(userId, email, name);
    if (!validation.isValid) {
      throw new Error(`User data validation failed: ${validation.errors.join(', ')}`);
    }

    console.log('✅ User data validation passed');

    // 1. ユーザーをCLIENTグループに追加（リトライ機能付き）
    await retryOperation(async () => {
      const addToGroupCommand = new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: userId,
        GroupName: 'client',
      });

      await cognitoClient.send(addToGroupCommand);
      groupAdded = true;
      console.log('👥 User added to client group successfully', { userId, email });
    }, 'Add user to group');

    // 2. データベースにユーザーレコードを作成（リトライ機能付き）
    const userRecord = await retryOperation(async () => {
      const record = await client.models.User.create({
        id: userId,
        email: email,
        name: name,
        role: 'CLIENT',
        isActive: true,
        pcStatus: 'OFFLINE',
      });
      
      userCreated = true;
      console.log('💾 User record created successfully', { userId, email, recordId: record.data?.id });
      return record;
    }, 'Create user record');

    const processingTime = Date.now() - startTime;
    console.log('🎉 Post-confirmation handler completed successfully', {
      userId,
      email,
      processingTimeMs: processingTime,
      userRecordId: userRecord.data?.id,
    });

    return event;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Post-confirmation handler error', {
      userId,
      email: event.request.userAttributes.email,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
      groupAdded,
      userCreated,
    });

    // ロールバック処理（可能な範囲で）
    if (groupAdded && !userCreated) {
      try {
        console.log('🔄 Attempting rollback: removing user from group');
        const removeFromGroupCommand = new AdminRemoveUserFromGroupCommand({
          UserPoolId: event.userPoolId,
          Username: userId,
          GroupName: 'client',
        });
        await cognitoClient.send(removeFromGroupCommand);
        console.log('↩️ Rollback successful: user removed from group');
      } catch (rollbackError) {
        console.error('💥 Rollback failed', rollbackError);
      }
    }

    // 重要な監視メトリクス用のログ
    console.error('🚨 POST_CONFIRMATION_FAILURE', {
      userId,
      email: event.request.userAttributes.email,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: processingTime,
      partialSuccess: {
        groupAdded,
        userCreated,
      },
    });

    // エラーが発生してもユーザー登録は完了させる
    // Cognitoでのユーザー確認は成功させ、後で手動修正が可能にする
    console.warn('⚠️ User registration completed despite post-confirmation errors - manual intervention may be required');
    
    return event;
  }
};