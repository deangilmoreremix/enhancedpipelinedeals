/**
 * Tests for Embedded Agent Interface Component
 * Verifies that the embedded agent interface works correctly
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmbeddedAgentInterface } from '../components/agents/EmbeddedAgentInterface';
import { getAgentFramework } from '../services/agentFramework';

// Mock the agent framework
jest.mock('../services/agentFramework', () => ({
  getAgentFramework: jest.fn(() => ({
    listAgents: jest.fn(() => Promise.resolve([
      {
        id: 'deal-analyst',
        name: 'Deal Analyst',
        type: 'deal_analyst',
        description: 'Expert deal analysis and insights',
        capabilities: ['analysis', 'insights'],
        isActive: true
      },
      {
        id: 'risk-assessor',
        name: 'Risk Assessor',
        type: 'risk_assessor',
        description: 'Risk assessment for deals',
        capabilities: ['risk-analysis'],
        isActive: true
      }
    ]))
  }))
}));

describe('Embedded Agent Interface', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should render compact mode for deal context', async () => {
    const mockDealData = {
      id: 'deal-123',
      title: 'Test Deal',
      value: 50000,
      stage: 'proposal'
    };

    render(
      <EmbeddedAgentInterface
        contextType="deal"
        contextData={mockDealData}
        isCompact={true}
      />
    );

    // Should show agent buttons
    await waitFor(() => {
      expect(screen.getByText('AI Agents')).toBeInTheDocument();
    });
  });

  it('should render full mode for analytics context', async () => {
    const mockAnalyticsData = {
      deals: [],
      contacts: []
    };

    render(
      <EmbeddedAgentInterface
        contextType="analytics"
        contextData={mockAnalyticsData}
        isCompact={false}
      />
    );

    // Should show full interface
    await waitFor(() => {
      expect(screen.getByText('AI Agent Assistant')).toBeInTheDocument();
    });
  });

  it('should recommend relevant agents based on context', async () => {
    const mockDealData = {
      id: 'deal-123',
      title: 'Test Deal',
      value: 50000,
      stage: 'proposal'
    };

    render(
      <EmbeddedAgentInterface
        contextType="deal"
        contextData={mockDealData}
        isCompact={false}
      />
    );

    // Should show recommended agents
    await waitFor(() => {
      expect(screen.getByText('Deal Analyst')).toBeInTheDocument();
      expect(screen.getByText('Risk Assessor')).toBeInTheDocument();
    });
  });

  it('should handle agent selection and chat interface', async () => {
    const mockDealData = {
      id: 'deal-123',
      title: 'Test Deal',
      value: 50000,
      stage: 'proposal'
    };

    render(
      <EmbeddedAgentInterface
        contextType="deal"
        contextData={mockDealData}
        isCompact={false}
      />
    );

    // Wait for agents to load
    await waitFor(() => {
      expect(screen.getByText('Deal Analyst')).toBeInTheDocument();
    });

    // Click on an agent
    const dealAnalystButton = screen.getByText('Deal Analyst');
    fireEvent.click(dealAnalystButton);

    // Should show chat interface
    await waitFor(() => {
      expect(screen.getByText('Expert deal analysis and insights')).toBeInTheDocument();
    });
  });

  it('should handle compact mode agent buttons', async () => {
    const mockDealData = {
      id: 'deal-123',
      title: 'Test Deal',
      value: 50000,
      stage: 'proposal'
    };

    render(
      <EmbeddedAgentInterface
        contextType="deal"
        contextData={mockDealData}
        isCompact={true}
      />
    );

    // Should show compact interface
    await waitFor(() => {
      expect(screen.getByText('AI Agents')).toBeInTheDocument();
    });
  });

  it('should handle different context types', async () => {
    // Test contact context
    const mockContactData = {
      id: 'contact-123',
      name: 'John Doe',
      company: 'Test Corp'
    };

    const { rerender } = render(
      <EmbeddedAgentInterface
        contextType="contact"
        contextData={mockContactData}
        isCompact={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('AI Agents')).toBeInTheDocument();
    });

    // Test analytics context
    rerender(
      <EmbeddedAgentInterface
        contextType="analytics"
        contextData={{ deals: [], contacts: [] }}
        isCompact={true}
      />
    );

    expect(screen.getByText('AI Agents')).toBeInTheDocument();
  });

  it('should handle empty agent list gracefully', async () => {
    // Mock empty agent list
    const mockAgentFramework = {
      listAgents: jest.fn(() => Promise.resolve([]))
    };
    (getAgentFramework as jest.Mock).mockReturnValue(mockAgentFramework);

    render(
      <EmbeddedAgentInterface
        contextType="deal"
        contextData={{}}
        isCompact={true}
      />
    );

    // Should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('AI Agents')).toBeInTheDocument();
    });
  });
});