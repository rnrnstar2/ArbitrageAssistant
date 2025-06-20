import { defineFunction } from '@aws-amplify/backend';

export const closePosition = defineFunction({
  name: 'closePosition',
  environment: {
    GRAPHQL_ENDPOINT: process.env.AMPLIFY_DATA_GRAPHQL_ENDPOINT || '',
  },
});