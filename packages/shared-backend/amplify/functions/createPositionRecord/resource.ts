import { defineFunction } from '@aws-amplify/backend';

export const createPositionRecord = defineFunction({
  name: 'createPositionRecord',
  entry: './handler.ts'
});