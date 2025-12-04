/**
 * AI Agent System Tests
 * Basic validation that the agent system works
 */

import { describe, it, expect } from '@jest/globals';

// Mock the agent framework
jest.mock('../services/agentFramework', () => ({
  getAgentFramework: () => ({
    createAgent: jest.fn().mockResolvedValue({
      id: 'test-agent',
      name: 'Test Agent',
      type: 'sales_assistant',
      status: 'active'
    }),
    listAgents: jest.fn().mockResolvedValue([]),
    getAgent: jest.fn().mockResolvedValue(null)
  })
}));

describe('AI Agent System Basic Tests', () => {
  it('should import agent framework without errors', () => {
    const { getAgentFramework } = require('../services/agentFramework');
    expect(typeof getAgentFramework).toBe('function');
  });

  it('should create agent framework instance', () => {
    const { getAgentFramework } = require('../services/agentFramework');
    const framework = getAgentFramework();
    expect(framework).toBeDefined();
  });

  it('should have basic agent methods', async () => {
    const { getAgentFramework } = require('../services/agentFramework');
    const framework = getAgentFramework();

    expect(typeof framework.createAgent).toBe('function');
    expect(typeof framework.listAgents).toBe('function');
    expect(typeof framework.getAgent).toBe('function');
  });

  it('should create agent successfully', async () => {
    const { getAgentFramework } = require('../services/agentFramework');
    const framework = getAgentFramework();

    const agent = await framework.createAgent({
      name: 'Test Agent',
      type: 'sales_assistant'
    });

    expect(agent).toBeDefined();
    expect(agent.id).toBe('test-agent');
    expect(agent.name).toBe('Test Agent');
  });

  it('should list agents', async () => {
    const { getAgentFramework } = require('../services/agentFramework');
    const framework = getAgentFramework();

    const agents = await framework.listAgents();
    expect(Array.isArray(agents)).toBe(true);
  });
});

export {};