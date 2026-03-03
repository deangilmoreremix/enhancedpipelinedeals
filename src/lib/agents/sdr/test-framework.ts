/**
 * SDR Agent Testing Framework
 * Comprehensive testing for OpenAI Agents SDK
 */

import { SDRContext, SDRAgentResult } from './base';
import { sdrAgentRegistry } from './registry';
import { loadProductionConfig, validateProductionConfig } from './production-config';
import { logger } from '../../core/logger';

export interface SDRTestCase {
  id: string;
  description: string;
  agentId: string;
  context: SDRContext;
  expectedResult: Partial<SDRAgentResult>;
  timeoutMs?: number;
}

export interface SDRTestResult {
  testId: string;
  agentId: string;
  success: boolean;
  duration: number;
  result?: SDRAgentResult;
  error?: string;
  validationErrors: string[];
}

export interface SDRTestSuite {
  name: string;
  description: string;
  tests: SDRTestCase[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

/**
 * SDR Agent Test Runner
 */
export class SDRTestRunner {
  private config = loadProductionConfig();

  async runTest(test: SDRTestCase): Promise<SDRTestResult> {
    const startTime = Date.now();
    const agent = sdrAgentRegistry[test.agentId];

    if (!agent) {
      return {
        testId: test.id,
        agentId: test.agentId,
        success: false,
        duration: 0,
        validationErrors: [`Agent ${test.agentId} not found in registry`],
      };
    }

    try {
      // Set timeout for test execution
      const timeoutMs = test.timeoutMs || 30000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Test timeout after ${timeoutMs}ms`)), timeoutMs)
      );

      // Run agent
      const resultPromise = agent.run(test.context);
      const result = await Promise.race([resultPromise, timeoutPromise]);

      const duration = Date.now() - startTime;

      // Validate result
      const validationErrors = this.validateTestResult(test, result);

      return {
        testId: test.id,
        agentId: test.agentId,
        success: validationErrors.length === 0,
        duration,
        result,
        validationErrors,
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        testId: test.id,
        agentId: test.agentId,
        success: false,
        duration,
        error: error.message,
        validationErrors: [`Execution failed: ${error.message}`],
      };
    }
  }

  async runTestSuite(suite: SDRTestSuite): Promise<{
    suiteName: string;
    results: SDRTestResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      averageDuration: number;
    };
  }> {
    logger.info(`Running SDR test suite: ${suite.name}`);

    // Setup
    if (suite.setup) {
      await suite.setup();
    }

    // Run all tests
    const results: SDRTestResult[] = [];
    for (const test of suite.tests) {
      logger.info(`Running test: ${test.id}`);
      const result = await this.runTest(test);
      results.push(result);
      logger.info(`Test ${test.id}: ${result.success ? 'PASSED' : 'FAILED'}`);
    }

    // Teardown
    if (suite.teardown) {
      await suite.teardown();
    }

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    };

    logger.info(`Test suite ${suite.name} completed: ${summary.passed}/${summary.total} passed`);

    return {
      suiteName: suite.name,
      results,
      summary,
    };
  }

  private validateTestResult(test: SDRTestCase, result: SDRAgentResult): string[] {
    const errors: string[] = [];

    // Check expected success
    if (test.expectedResult.success !== undefined && result.success !== test.expectedResult.success) {
      errors.push(`Expected success: ${test.expectedResult.success}, got: ${result.success}`);
    }

    // Check expected action
    if (test.expectedResult.action && result.action !== test.expectedResult.action) {
      errors.push(`Expected action: ${test.expectedResult.action}, got: ${result.action}`);
    }

    // Check required fields
    if (result.success) {
      if (!result.message) {
        errors.push('Success result missing message');
      }
      if (test.expectedResult.emailData && !result.emailData) {
        errors.push('Expected email data but none returned');
      }
    } else {
      if (!result.error) {
        errors.push('Failed result missing error message');
      }
    }

    return errors;
  }
}

/**
 * Predefined test suites for SDR agents
 */
export const sdrTestSuites: SDRTestSuite[] = [
  {
    name: 'Data Enrichment Agent Tests',
    description: 'Test data enrichment SDR agent functionality',
    tests: [
      {
        id: 'data-enrichment-basic',
        description: 'Basic data enrichment with minimal contact info',
        agentId: 'sdr-data-enrichment',
        context: {
          contactId: 'test-contact-1',
          contact: {
            id: 'test-contact-1',
            name: 'John Doe',
            email: 'john@company.com',
            company: 'TechCorp',
            title: 'CTO',
          },
        },
        expectedResult: {
          success: true,
          action: 'data_enrichment_result',
        },
        timeoutMs: 15000,
      },
      {
        id: 'data-enrichment-with-deal',
        description: 'Data enrichment with associated deal',
        agentId: 'sdr-data-enrichment',
        context: {
          contactId: 'test-contact-2',
          dealId: 'test-deal-1',
          contact: {
            id: 'test-contact-2',
            name: 'Jane Smith',
            email: 'jane@startup.com',
            company: 'StartupXYZ',
            title: 'CEO',
          },
          deal: {
            id: 'test-deal-1',
            title: 'Enterprise Software Deal',
            value: 50000,
            stage: 'proposal',
          },
        },
        expectedResult: {
          success: true,
          action: 'data_enrichment_result',
        },
        timeoutMs: 15000,
      },
    ],
  },
  {
    name: 'Competitor Aware Agent Tests',
    description: 'Test competitor awareness SDR agent functionality',
    tests: [
      {
        id: 'competitor-aware-basic',
        description: 'Basic competitor analysis',
        agentId: 'sdr-competitor-aware',
        context: {
          contactId: 'test-contact-3',
          contact: {
            id: 'test-contact-3',
            name: 'Bob Johnson',
            email: 'bob@enterprise.com',
            company: 'EnterpriseInc',
            title: 'VP Sales',
          },
        },
        expectedResult: {
          success: true,
          action: 'competitor_analysis_result',
        },
        timeoutMs: 20000,
      },
    ],
  },
];

/**
 * Run all SDR agent tests
 */
export async function runAllSDRTests(): Promise<{
  suites: Array<{
    suiteName: string;
    results: SDRTestResult[];
    summary: any;
  }>;
  overall: {
    totalSuites: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    averageDuration: number;
  };
}> {
  // Validate configuration first
  const configValidation = validateProductionConfig(loadProductionConfig());
  if (!configValidation.valid) {
    throw new Error(`Invalid production config: ${configValidation.errors.join(', ')}`);
  }

  const runner = new SDRTestRunner();
  const suiteResults = [];

  for (const suite of sdrTestSuites) {
    const result = await runner.runTestSuite(suite);
    suiteResults.push(result);
  }

  // Calculate overall summary
  const overall = {
    totalSuites: suiteResults.length,
    totalTests: suiteResults.reduce((sum, s) => sum + s.summary.total, 0),
    totalPassed: suiteResults.reduce((sum, s) => sum + s.summary.passed, 0),
    totalFailed: suiteResults.reduce((sum, s) => sum + s.summary.failed, 0),
    averageDuration: suiteResults.reduce((sum, s) => sum + s.summary.averageDuration, 0) / suiteResults.length,
  };

  return {
    suites: suiteResults,
    overall,
  };
}

/**
 * Generate test report
 */
export function generateTestReport(results: Awaited<ReturnType<typeof runAllSDRTests>>): string {
  const { suites, overall } = results;

  let report = '# SDR Agent Test Report\n\n';
  report += `## Overall Summary\n\n`;
  report += `- **Total Test Suites:** ${overall.totalSuites}\n`;
  report += `- **Total Tests:** ${overall.totalTests}\n`;
  report += `- **Passed:** ${overall.totalPassed}\n`;
  report += `- **Failed:** ${overall.totalFailed}\n`;
  report += `- **Success Rate:** ${((overall.totalPassed / overall.totalTests) * 100).toFixed(1)}%\n`;
  report += `- **Average Duration:** ${overall.averageDuration.toFixed(0)}ms\n\n`;

  for (const suite of suites) {
    report += `## ${suite.suiteName}\n\n`;
    report += `${suite.summary.passed}/${suite.summary.total} tests passed\n\n`;

    for (const result of suite.results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      report += `### ${result.testId} - ${status}\n\n`;
      report += `- **Duration:** ${result.duration}ms\n`;

      if (result.error) {
        report += `- **Error:** ${result.error}\n`;
      }

      if (result.validationErrors.length > 0) {
        report += `- **Validation Errors:**\n`;
        for (const error of result.validationErrors) {
          report += `  - ${error}\n`;
        }
      }

      report += '\n';
    }
  }

  return report;
}