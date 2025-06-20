import { defineFunction } from '@aws-amplify/backend';

export const createEntry = defineFunction({
  name: 'create-entry',
  environment: {
    GRAPHQL_ENDPOINT: process.env.AMPLIFY_DATA_GRAPHQL_ENDPOINT || '',
  },
});