import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  name: `ArbitrageAssistant-Auth-${process.env.NODE_ENV || 'dev'}`,
  loginWith: {
    email: {
      verificationEmailStyle: "CODE",
      verificationEmailSubject: "ArbitrageAssistant 認証コード",
      verificationEmailBody: (createCode) =>
        `ArbitrageAssistantへようこそ。アカウント認証を完了するために、以下の認証コードをご入力ください。\n\n認証コード: ${createCode()}\n\nこのコードは10分間有効です。`,
    },
  },
  userAttributes: {
    email: {
      required: true,
      mutable: false,
    },
    fullname: {
      required: true,
      mutable: true,
    },
  },
  groups: ['ADMIN', 'CLIENT'],
  accountRecovery: 'EMAIL_ONLY',
  triggers: {
    postConfirmation,
  },
  access: (allow) => [
    allow.resource(postConfirmation).to(['addUserToGroup']),
  ],
});
