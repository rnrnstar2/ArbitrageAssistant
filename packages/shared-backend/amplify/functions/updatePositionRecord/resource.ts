import { defineFunction } from '@aws-amplify/backend';

export const updatePositionRecord = defineFunction({
  name: 'updatePositionRecord',
  entry: './handler.ts'
});