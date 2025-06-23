import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';

export const amplifyClient = generateClient();

export const getCurrentUserId = async (): Promise<string> => {
  try {
    const user = await getCurrentUser();
    return user.userId;
  } catch {
    throw new Error('User not authenticated');
  }
};