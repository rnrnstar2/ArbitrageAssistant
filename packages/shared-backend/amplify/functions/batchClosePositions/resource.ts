import { defineFunction } from '@aws-amplify/backend';

export const batchClosePositions = defineFunction({
  name: 'batchClosePositions',
  environment: {
    GRAPHQL_ENDPOINT: process.env.AMPLIFY_DATA_GRAPHQL_ENDPOINT || '',
  },
});