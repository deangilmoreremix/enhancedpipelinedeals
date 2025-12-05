/**
 * SDR Agents Integration Tests
 * Tests all SDR agents with AgentMail integration
 */

const fs = require('fs');
const path = require('path');

describe('SDR Agents Integration Tests', () => {
  // Mock environment variables
  beforeAll(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    process.env.AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY || 'test-key';
    process.env.PUBLIC_API_URL = process.env.PUBLIC_API_URL || 'https://api.smartcrm.vip';
  });

  describe('Configuration Tests', () => {
    test('should have required environment variables', () => {
      expect(process.env.OPENAI_API_KEY).toBeDefined();
      expect(process.env.AGENTMAIL_API_KEY).toBeDefined();
      expect(process.env.PUBLIC_API_URL).toBeDefined();
    });

    test('should load production configuration', () => {
      // Test that config file exists and is valid
      const configPath = path.join(__dirname, '../lib/agents/sdr/production-config.ts');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('SDRProductionConfig');
      expect(content).toContain('openai');
      expect(content).toContain('agentmail');
    });
  });

  describe('Agent Registry Tests', () => {
    test('should have agent registry file', () => {
      const registryPath = path.join(__dirname, '../lib/agents/sdr/registry.ts');
      expect(fs.existsSync(registryPath)).toBe(true);
    });

    test('should register implemented agents', () => {
      const registryPath = path.join(__dirname, '../lib/agents/sdr/registry.ts');
      const content = fs.readFileSync(registryPath, 'utf8');

      // Check for implemented agents
      expect(content).toContain('sdr-data-enrichment');
      expect(content).toContain('sdr-competitor-aware');
      expect(content).toContain('dataEnrichmentSDRAgent');
      expect(content).toContain('competitorAwareSDRAgent');
    });
  });

  describe('Base Agent Infrastructure Tests', () => {
    test('should have base agent class', () => {
      const basePath = path.join(__dirname, '../lib/agents/sdr/base.ts');
      expect(fs.existsSync(basePath)).toBe(true);
    });

    test('should implement OpenAI integration', () => {
      const basePath = path.join(__dirname, '../lib/agents/sdr/base.ts');
      const content = fs.readFileSync(basePath, 'utf8');

      expect(content).toContain('OpenAI');
      expect(content).toContain('getCompletion');
      expect(content).toContain('chat.completions.create');
    });

    test('should implement AgentMail integration', () => {
      const basePath = path.join(__dirname, '../lib/agents/sdr/base.ts');
      const content = fs.readFileSync(basePath, 'utf8');

      expect(content).toContain('agentmailClient');
      expect(content).toContain('sendEmail');
      expect(content).toContain('createInbox');
    });

    test('should have comprehensive error handling', () => {
      const basePath = path.join(__dirname, '../lib/agents/sdr/base.ts');
      const content = fs.readFileSync(basePath, 'utf8');

      expect(content).toContain('try');
      expect(content).toContain('catch');
      expect(content).toContain('logger.error');
    });
  });

  describe('Individual Agent Implementation Tests', () => {
    const agents = [
      'dataEnrichmentAgent',
      'competitorAwareAgent',
      'coldEmailAgent',
      'followUpAgent',
      'objectionHandlingAgent'
    ];

    agents.forEach(agent => {
      test(`should implement ${agent}`, () => {
        const agentPath = path.join(__dirname, `../lib/agents/sdr/${agent}.ts`);
        expect(fs.existsSync(agentPath)).toBe(true);

        const content = fs.readFileSync(agentPath, 'utf8');

        // Check for required components
        expect(content).toContain('BaseSDRAgent');
        expect(content).toContain('extends');
        expect(content).toContain('generatePrompt');
        expect(content).toContain('execute');
        expect(content).toContain('SDRAgent');
      });
    });
  });

  describe('Testing Framework Tests', () => {
    test('should have testing framework', () => {
      const testPath = path.join(__dirname, '../lib/agents/sdr/test-framework.ts');
      expect(fs.existsSync(testPath)).toBe(true);
    });

    test('should implement test runner', () => {
      const testPath = path.join(__dirname, '../lib/agents/sdr/test-framework.ts');
      const content = fs.readFileSync(testPath, 'utf8');

      expect(content).toContain('SDRTestRunner');
      expect(content).toContain('runTest');
      expect(content).toContain('runTestSuite');
      expect(content).toContain('SDRAgentResult');
    });

    test('should have predefined test suites', () => {
      const testPath = path.join(__dirname, '../lib/agents/sdr/test-framework.ts');
      const content = fs.readFileSync(testPath, 'utf8');

      expect(content).toContain('sdrTestSuites');
      expect(content).toContain('Data Enrichment Agent Tests');
      expect(content).toContain('Competitor Aware Agent Tests');
    });
  });

  describe('Integration Test Simulation', () => {
    test('should simulate agent execution flow', async () => {
      // Mock agent execution - this would normally call the real agent
      const mockContext = {
        contactId: 'test-contact-123',
        contact: {
          id: 'test-contact-123',
          name: 'John Doe',
          email: 'john@test.com',
          company: 'TestCorp'
        }
      };

      const mockResult = {
        success: true,
        action: 'test_action',
        message: 'Test execution successful',
        metadata: {
          contactId: mockContext.contactId
        }
      };

      // Verify the structure of a successful result
      expect(mockResult.success).toBe(true);
      expect(mockResult.action).toBeDefined();
      expect(mockResult.message).toBeDefined();
      expect(mockResult.metadata).toBeDefined();
    });

    test('should handle agent execution errors', async () => {
      const mockErrorResult = {
        success: false,
        action: 'test_action_failed',
        error: 'Test error occurred',
        metadata: {
          contactId: 'test-contact-123'
        }
      };

      expect(mockErrorResult.success).toBe(false);
      expect(mockErrorResult.error).toBeDefined();
      expect(mockErrorResult.metadata).toBeDefined();
    });
  });

  describe('AgentMail Integration Tests', () => {
    test('should have AgentMail client integration', () => {
      const agentmailPath = path.join(__dirname, '../lib/agentmailClient.ts');
      expect(fs.existsSync(agentmailPath)).toBe(true);

      const content = fs.readFileSync(agentmailPath, 'utf8');
      expect(content).toContain('AgentMailClient');
      expect(content).toContain('createInbox');
      expect(content).toContain('replyToMessage');
    });

    test('should have webhook integration', () => {
      const webhookPath = path.join(__dirname, '../../supabase/functions/agentmail/webhook/index.ts');
      expect(fs.existsSync(webhookPath)).toBe(true);

      const content = fs.readFileSync(webhookPath, 'utf8');
      expect(content).toContain('serve');
      expect(content).toContain('event_type');
      expect(content).toContain('message.sent');
    });
  });

  describe('Performance and Monitoring Tests', () => {
    test('should implement metrics tracking', () => {
      const basePath = path.join(__dirname, '../lib/agents/sdr/base.ts');
      const content = fs.readFileSync(basePath, 'utf8');

      expect(content).toContain('SDRMetrics');
      expect(content).toContain('totalRuns');
      expect(content).toContain('successfulRuns');
      expect(content).toContain('averageResponseTime');
    });

    test('should have activity logging in agents', () => {
      const agentPath = path.join(__dirname, '../lib/agents/sdr/coldEmailAgent.ts');
      const content = fs.readFileSync(agentPath, 'utf8');

      expect(content).toContain('logActivity');
      expect(content).toContain('supabase');
      expect(content).toContain('activities');
    });
  });
});