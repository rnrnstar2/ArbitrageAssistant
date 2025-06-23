import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmation } from './auth/post-confirmation/resource';

const backend = defineBackend({
  auth,
  data,
  postConfirmation
});

// カスタムパスワードポリシーを設定
const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.addPropertyOverride('Policies', {
  PasswordPolicy: {
    MinimumLength: 8,
    RequireLowercase: true,
    RequireNumbers: true,
    RequireUppercase: false, // 大文字は任意
    RequireSymbols: false, // 記号は任意
  },
});

