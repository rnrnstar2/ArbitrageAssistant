import { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { 
  CreateEntryStrategyInput,
  CreateExitStrategyInput,
  CreateLegacyStrategyInput,
  UpdateStrategyInput
} from '@repo/shared-types';

export function useStrategyActions() {
  const [loading, setLoading] = useState(false);
  const client = generateClient();

  const createStrategy = async (input: CreateEntryStrategyInput | CreateExitStrategyInput | CreateLegacyStrategyInput) => {
    setLoading(true);
    try {
      // Determine strategy type from input
      const isEntryStrategy = 'targetAccounts' in input;
      const isExitStrategy = 'selectedPositions' in input;

      let mutation: string;
      
      if (isEntryStrategy) {
        mutation = /* GraphQL */ `
          mutation CreateEntryStrategy($input: CreateEntryStrategyInput!) {
            createEntryStrategy(input: $input) {
              strategyId
              name
              type
              status
              targetAccounts
              positions {
                symbol
                volume
                direction
                trailWidth
              }
              defaultTrailWidth
              createdAt
              updatedAt
            }
          }
        `;
      } else if (isExitStrategy) {
        mutation = /* GraphQL */ `
          mutation CreateExitStrategy($input: CreateExitStrategyInput!) {
            createExitStrategy(input: $input) {
              strategyId
              name
              type
              status
              selectedPositions
              primaryPositionId
              trailWidth
              createdAt
              updatedAt
            }
          }
        `;
      } else {
        // Legacy strategy
        mutation = /* GraphQL */ `
          mutation CreateLegacyStrategy($input: CreateLegacyStrategyInput!) {
            createLegacyStrategy(input: $input) {
              strategyId
              name
              trailWidth
              symbol
              maxRisk
              createdAt
              updatedAt
            }
          }
        `;
      }

      const result = await client.graphql({
        query: mutation,
        variables: { input }
      });

      return result.data.createEntryStrategy || result.data.createExitStrategy || result.data.createLegacyStrategy;
    } finally {
      setLoading(false);
    }
  };

  const updateStrategy = async (strategyId: string, input: UpdateStrategyInput) => {
    setLoading(true);
    try {
      const mutation = /* GraphQL */ `
        mutation UpdateStrategy($input: UpdateStrategyInput!) {
          updateStrategy(input: $input) {
            strategyId
            name
            trailWidth
            symbol
            maxRisk
            updatedAt
          }
        }
      `;

      const result = await client.graphql({
        query: mutation,
        variables: {
          input: {
            strategyId,
            ...input
          }
        }
      });

      return result.data.updateStrategy;
    } finally {
      setLoading(false);
    }
  };

  const deleteStrategy = async (strategyId: string) => {
    setLoading(true);
    try {
      const mutation = /* GraphQL */ `
        mutation DeleteStrategy($input: DeleteStrategyInput!) {
          deleteStrategy(input: $input) {
            strategyId
          }
        }
      `;

      await client.graphql({
        query: mutation,
        variables: {
          input: { strategyId }
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    createStrategy,
    updateStrategy,
    deleteStrategy,
    loading
  };
}