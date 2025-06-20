import { defineFunction } from '@aws-amplify/backend';

export const getCloseHistory = defineFunction({
  name: 'getCloseHistory',
  entry: './handler.ts',
});