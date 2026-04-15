import React, { useState } from 'react';
import { Copy, Download, Clock, Trash2 } from 'lucide-react';
import { SDRRunResponse } from './types';

function formatTimestamp(date?: Date) {
  if (!date) return '';
  return date.toLocaleString();
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
  }
}

function downloadAsJSON(data: Record<string, unknown>, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SDRResultsViewer({ response, resultHistory, error, onClearResults, onClearHistory, selectedAgent }: {
  response: SDRRunResponse | null;
  resultHistory: SDRRunResponse[];
  error: string | null;
  onClearResults: () => void;
  onClearHistory: () => void;
  selectedAgent?: { id: string; label?: string; } | null;
}) {
  const [viewMode, setViewMode] = useState<'formatted' | 'preview' | 'json'>('formatted');
  const [showHistory, setShowHistory] = useState(false);

  const renderResult = (result: Record<string, unknown>) => {
    if (!result) return null;
    const keys = Object.keys(result);
    return (
      <div style={{ padding: 16 }}>
        {keys.map(key => (
          <div key={key} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#374151',
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4
            }}>
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </div>
            <div style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.5 }}>
              {typeof result[key] === 'string' ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{result[key]}</div>
              ) : (
                <pre style={{
                  background: '#f8fafc', padding: 8, borderRadius: 4, fontSize: 12,
                  margin: 0, overflow: 'auto'
                }}>
                  {JSON.stringify(result[key], null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderJSONResult = (result: Record<string, unknown>) => (
    <pre style={{
      margin: 0, padding: 16, background: '#f8fafc', borderRadius: 8, fontSize: 12,
      lineHeight: 1.4, color: '#1f2937', overflow: 'auto', maxHeight: 400
    }}>
      {JSON.stringify(result, null, 2)}
    </pre>
  );

  const renderPreviewResult = (result: Record<string, unknown>) => {
    if (!result) return null;
    const extractMessage = (obj: Record<string, unknown>): string => {
      if (typeof obj === 'string') return obj;
      if (typeof obj.email === 'string') return obj.email;
      if (typeof obj.message === 'string') return obj.message;
      if (typeof obj.subject === 'string' && typeof obj.body === 'string')
        return `${obj.subject}\n\n${obj.body}`;
      if (typeof obj.content === 'string') return obj.content;
      return '';
    };
    const message = extractMessage(result);
    return (
      <div style={{ padding: 16 }}>
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8,
          padding: 16, fontSize: 14, lineHeight: 1.6, color: '#1f2937',
          whiteSpace: 'pre-wrap'
        }}>
          {message || 'No previewable content found in result'}
        </div>
      </div>
    );
  };

  const getViewModeButtons = () => (
    <div style={{ display: 'flex', gap: 8 }}>
      {['formatted', 'preview', 'json'].map(mode => (
        <button key={mode} onClick={() => setViewMode(mode as any)}
          style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db',
            background: viewMode === mode ? '#3b82f6' : '#ffffff',
            color: viewMode === mode ? '#ffffff' : '#6b7280', fontSize: 12,
            cursor: 'pointer'
          }}>
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );


  return (
    <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
      <div style={{
        padding: 16, borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1a202c' }}>
            Agent Output
            {selectedAgent && (
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                {selectedAgent.label}
              </span>
            )}
          </h3>
          {response?.timestamp && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              <Clock size={12} style={{ marginRight: 4, display: 'inline' }} />
              {formatTimestamp(response.timestamp)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {response && getViewModeButtons()}
          {response && (
            <>
              <button onClick={() => copyToClipboard(JSON.stringify(response.result, null, 2))}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                  background: '#ffffff', color: '#6b7280', fontSize: 12,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
                title="Copy result to clipboard">
                <Copy size={14} /> Copy
              </button>
              <button onClick={() => downloadAsJSON(response.result, `sdr-result-${response.agentId}-${Date.now()}.json`)}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                  background: '#ffffff', color: '#6b7280', fontSize: 12,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
                title="Download as JSON">
                <Download size={14} /> Export
              </button>
              <button onClick={onClearResults}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                  background: '#ffffff', color: '#6b7280', fontSize: 12,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
                title="Clear current result">
                <Trash2 size={14} /> Clear
              </button>
            </>
          )}
          {resultHistory.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                background: showHistory ? '#f3f4f6' : '#ffffff',
                color: '#6b7280', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4
              }}>
              <FileText size={14} /> History ({resultHistory.length})
            </button>
          )}
        </div>
      </div>
      <div>
        {error ? (
          <div style={{
            padding: 16, background: '#fef2f2', color: '#dc2626', fontSize: 14
          }}>
            ⚠️ {error}
          </div>
        ) : response ? (
          renderResult()
        ) : showHistory && resultHistory.length > 0 ? (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {resultHistory.map((item, index) => (
              <div key={`${item.timestamp?.getTime() || index}`}
                style={{
                  padding: 16, borderBottom: index < resultHistory.length - 1
                    ? '1px solid #e2e8f0' : 'none', cursor: 'pointer'
                }}
                onClick={() => { /* History selection */ }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  {item.agentLabel || item.agentId} • {formatTimestamp(item.timestamp)}
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>
                  {typeof item.result === 'string'
                    ? item.result.substring(0, 100) + '...'
                    : 'Object result'}
                </div>
              </div>
            ))}
            <div style={{ padding: 16, textAlign: 'center' }}>
              <button onClick={onClearHistory}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                  background: '#ffffff', color: '#6b7280', fontSize: 12,
                  cursor: 'pointer'
                }}>
                Clear History
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14
          }}>
            Run an agent to see the result here. You can switch between formatted,
            preview, and JSON views.
          </div>
        )}
      </div>
    </div>
  );
}

export default SDRResultsViewer;
