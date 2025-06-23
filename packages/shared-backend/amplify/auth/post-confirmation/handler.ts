import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { env } from '$amplify/env/post-confirmation';
import type { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognitoClient = new CognitoIdentityProviderClient();

export const handler: PostConfirmationTriggerHandler = async (event) => {
  console.log('Post-confirmation handler started', { userId: event.request.userAttributes.sub });

  try {
    const { userAttributes } = event.request;
    const { userPoolId } = event;
    
    // ユーザー情報を取得
    const userId = userAttributes.sub;
    const email = userAttributes.email;
    // フォームで入力された名前を使用、なければメールアドレスから生成
    const name = userAttributes.name || userAttributes.given_name || email.split('@')[0];

    // 1. ユーザーをCLIENTグループに追加
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: userId,
      GroupName: 'CLIENT',
    });

    await cognitoClient.send(addToGroupCommand);
    console.log('User added to CLIENT group', { userId, email });

    // 2. データベースにユーザーレコードを作成
    const userRecord = await client.models.User.create({
      id: userId,
      email,
      name,
      role: 'CLIENT',
      isActive: true,
      pcStatus: 'OFFLINE',
    });

    console.log('User record created', { userId, email, userRecord });

    return event;
  } catch (error) {
    console.error('Post-confirmation handler error:', error);
    
    // エラーが発生してもユーザー登録は完了させる
    // ただし、後で手動でデータを修正する必要がある場合がある
    console.error('User registration completed but post-confirmation processing failed', {
      userId: event.request.userAttributes.sub,
      email: event.request.userAttributes.email,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return event;
  }
};