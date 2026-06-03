import React from 'react';
import { BarChart3, TrendingUp, Clock, CheckCircle, XCircle, Users, Target } from 'lucide-react';
import { SDRAgentAnalytics } from './types';

interface SDRAnalyticsDashboardProps {
  analytics: Record<string, SDRAgentAnalytics>;
  getAnalytics: () => {
    totalRuns: number;
    totalSuccessful: number;
    totalFailed: number;
    overallSuccessRate: number;
    averageResponseTime: number;
    agentAnalytics: SDRAgentAnalytics[];
  };
  getTopAgents: (limit?: number) => SDRAgentAnalytics[];
  getAgentsBySuccessRate: () => SDRAgentAnalytics[];
  onClose: () => void;
}

export const SDRAnalyticsDashboard: React.FC<SDRAnalyticsDashboardProps> = ({
  analytics,
  getAnalytics,
  getTopAgents,
  getAgentsBySuccessRate,
  onClose
}) => {
  const analyticsData = getAnalytics();
  const topAgents = getTopAgents(5);
  const agentsBySuccess = getAgentsBySuccessRate().slice(0, 5);

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatPercentage = (rate: number) => `${rate.toFixed(1)}%`;

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return '#10b981';
    if (rate >= 75) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        padding: 24,
        maxWidth: 1200,
        margin: '0 auto'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart3 size={24} color="#3b82f6" />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1a202c' }}>
            SDR Agents Analytics Dashboard
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#ffffff',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          Close
        </button>
      </div>

      {/* Overall Stats */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#374151' }}>
          Overall Performance
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <div style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Target size={16} color="#3b82f6" />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Total Runs</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1a202c' }}>
              {analyticsData.totalRuns}
            </div>
          </div>

          <div style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CheckCircle size={16} color="#10b981" />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Success Rate</span>
            </div>
            <div style={{
              fontSize: 24,
              fontWeight: 700,
              color: getSuccessRateColor(analyticsData.overallSuccessRate)
            }}>
              {formatPercentage(analyticsData.overallSuccessRate)}
            </div>
          </div>

          <div style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Clock size={16} color="#8b5cf6" />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Avg Response Time</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1a202c' }}>
              {formatResponseTime(analyticsData.averageResponseTime)}
            </div>
          </div>

          <div style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Users size={16} color="#f59e0b" />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Active Agents</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1a202c' }}>
              {Object.keys(analytics).length}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Top Agents by Usage */}
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#374151' }}>
            Top Agents by Usage
          </h3>
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            {topAgents.length > 0 ? (
              topAgents.map((agent, index) => (
                <div
                  key={agent.agentId}
                  style={{
                    padding: 12,
                    borderBottom: index < topAgents.length - 1 ? '1px solid #e2e8f0' : 'none',
                    background: index % 2 === 0 ? '#ffffff' : '#f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a202c' }}>
                        {agent.agentId.replace('sdr-', '').replace('-', ' ').toUpperCase()}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {agent.totalRuns} runs • {formatPercentage(agent.successRate)} success
                      </div>
                    </div>
                    <div style={{
                      width: 60,
                      height: 8,
                      background: '#e2e8f0',
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}>
                      <div
                        style={{
                          width: `${agent.successRate}%`,
                          height: '100%',
                          background: getSuccessRateColor(agent.successRate)
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                No agent usage data yet. Run some agents to see analytics.
              </div>
            )}
          </div>
        </div>

        {/* Success Rate Rankings */}
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#374151' }}>
            Success Rate Rankings
          </h3>
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            {agentsBySuccess.length > 0 ? (
              agentsBySuccess.map((agent, index) => (
                <div
                  key={agent.agentId}
                  style={{
                    padding: 12,
                    borderBottom: index < agentsBySuccess.length - 1 ? '1px solid #e2e8f0' : 'none',
                    background: index % 2 === 0 ? '#ffffff' : '#f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a202c' }}>
                        {agent.agentId.replace('sdr-', '').replace('-', ' ').toUpperCase()}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {agent.successfulRuns}/{agent.totalRuns} successful
                      </div>
                    </div>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: getSuccessRateColor(agent.successRate)
                    }}>
                      {formatPercentage(agent.successRate)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                No success rate data yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Agent Metrics */}
      {Object.keys(analytics).length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#374151' }}>
            Agent Performance Details
          </h3>
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              gap: 0,
              background: '#f8fafc',
              padding: '12px 16px',
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div>Agent</div>
              <div>Runs</div>
              <div>Success Rate</div>
              <div>Avg Time</div>
              <div>Last Used</div>
            </div>
            {analyticsData.agentAnalytics.map((agent, index) => (
              <div
                key={agent.agentId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  gap: 0,
                  padding: '12px 16px',
                  background: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                  borderBottom: index < analyticsData.agentAnalytics.length - 1 ? '1px solid #e2e8f0' : 'none'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a202c' }}>
                  {agent.agentId.replace('sdr-', '').replace('-', ' ').toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>
                  {agent.totalRuns}
                </div>
                <div style={{
                  fontSize: 13,
                  color: getSuccessRateColor(agent.successRate),
                  fontWeight: 500
                }}>
                  {formatPercentage(agent.successRate)}
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>
                  {formatResponseTime(agent.averageResponseTime)}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {agent.lastUsed ? agent.lastUsed.toLocaleDateString() : 'Never'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: '#f8fafc',
        borderRadius: 8,
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          Analytics data is updated in real-time as you run SDR agents.
          The dashboard shows the last 50 execution results and aggregated performance metrics.
        </p>
      </div>
    </div>
  );
};

export default SDRAnalyticsDashboard;