import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: `ArbitrageAssistant-PostConfirm-${process.env.NODE_ENV || 'dev'}`,
  timeoutSeconds: 30, // Increase timeout from default 3s to 30s
  memoryMB: 512, // Increase memory for better performance
});
