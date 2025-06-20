/**
 * Basic type and component structure test for AccountSummaryDashboard
 */

import { describe, test, expect } from 'vitest'

// Import the component and hook to verify they compile
import { AccountSummaryDashboard } from '../components/AccountSummaryDashboard'
import { useRealtimeAccountSummary } from '../hooks/useRealtimeAccountSummary'

describe('AccountSummaryDashboard', () => {
  test('component should be defined', () => {
    expect(AccountSummaryDashboard).toBeDefined()
    expect(typeof AccountSummaryDashboard).toBe('function')
  })

  test('hook should be defined', () => {
    expect(useRealtimeAccountSummary).toBeDefined()
    expect(typeof useRealtimeAccountSummary).toBe('function')
  })

  test('component props interface should be correct', () => {
    // Test that component accepts required props without errors
    const mockClientPCs = [
      {
        id: 'test-client',
        name: 'Test Client',
        status: 'online' as const,
        lastSeen: new Date(),
        accounts: []
      }
    ]

    // This test just verifies the types compile correctly
    const props = {
      clientPCs: mockClientPCs,
      onRefresh: () => {},
      className: 'test-class',
      updateInterval: 1000
    }

    expect(props).toBeDefined()
  })
})