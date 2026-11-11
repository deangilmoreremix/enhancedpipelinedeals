import React, { useCallback, useEffect, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { ArrowLeft, Bot, Edit, Globe, Mail, Pause, Play, Plus, Settings, Trash2, AlertTriangle, BarChart3 } from 'lucide-react';
import { WorkflowBuilder } from './WorkflowBuilder';
import { WorkflowRunHistory } from './WorkflowRunHistory';
import type { AIAgentConfiguration, EmailTemplate, WebhookConfiguration, Workflow } from '../../types/workflow';
import { enhancedWorkflowService } from '../../services/enhancedWorkflowService';

type Tab = 'workflows' | 'executions' | 'templates' | 'integrations';

const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700';
const badge = (on: boolean) => `px-2 py-0.5 rounded-full text-xs font-medium ${on ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`;

const newWorkflowTemplate = (): Workflow => ({
  id: '',
  name: 'New Workflow',
  description: '',
  category: 'custom',
  steps: [],
  triggers: [],
  actions: [],
  settings: {
    isActive: false,
    priority: 'medium',
    maxExecutionTime: 3600,
    retryPolicy: { enabled: true, maxRetries: 3, retryDelay: 300 },
    notifications: { onSuccess: false, onFailure: true, onTimeout: true }
  },
  metadata: { version: 1, lastModified: new Date(), createdBy: 'current_user', usageCount: 0, successRate: 0, averageExecutionTime: 0 },
  createdAt: new Date(),
  updatedAt: new Date()
});

export const EnhancedWorkflowPanel: React.FC = () => {
  const { can } = usePermissions();
  const manage = can('manage_workflows', 'workflow');
  const canManage = manage.allowed;
  const denyTitle = canManage ? undefined : manage.reason;
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfiguration[]>([]);
  const [aiAgentConfigs, setAIAgentConfigs] = useState<AIAgentConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('workflows');
  const [showBuilder, setShowBuilder] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const loadWorkflows = useCallback(async () => {
    setWorkflows(await enhancedWorkflowService.getAllWorkflows());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadWorkflows();
        const [templates, webhooks, agents] = await Promise.all([
          enhancedWorkflowService.getEmailTemplates(),
          enhancedWorkflowService.getWebhookConfigs(),
          enhancedWorkflowService.getAIAgentConfigs()
        ]);
        if (!cancelled) { setEmailTemplates(templates); setWebhookConfigs(webhooks); setAIAgentConfigs(agents); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadWorkflows]);

  const openBuilder = (wf: Workflow) => { setSelectedWorkflow(wf); setShowBuilder(true); setNotice(null); setDirty(false); };

  const saveWorkflow = async () => {
    if (!selectedWorkflow) return;
    let saved: Workflow | null;
    if (selectedWorkflow.id) {
      saved = (await enhancedWorkflowService.updateWorkflow(selectedWorkflow.id, selectedWorkflow)) ? selectedWorkflow : null;
    } else {
      saved = await enhancedWorkflowService.createWorkflow(selectedWorkflow);
    }
    if (saved) {
      await loadWorkflows();
      setSelectedWorkflow(saved);
      setDirty(false);
      setNotice({ ok: true, text: 'Workflow saved.' });
    } else {
      setNotice({ ok: false, text: 'Could not save the workflow. Please try again.' });
    }
  };

  const executeWorkflow = async () => {
    if (!selectedWorkflow) return;
    if (!selectedWorkflow.id) { setNotice({ ok: false, text: 'Save the workflow before running it.' }); return; }
    if (dirty) { setNotice({ ok: false, text: 'Save your changes first: runs use the saved version.' }); return; }
    if (!selectedWorkflow.settings.isActive) { setNotice({ ok: false, text: 'Activate the workflow to run it.' }); return; }
    setIsExecuting(true);
    try {
      const run = await enhancedWorkflowService.executeWorkflow(selectedWorkflow.id, { userId: 'current_user', inputData: {} });
      setNotice(run
        ? { ok: run.status === 'completed', text: `Run ${run.status}${run.error ? `: ${run.error.message}` : ''}. See the Executions tab for details.` }
        : { ok: false, text: 'The workflow could not be started.' });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'Execution failed' });
    } finally {
      setIsExecuting(false);
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this workflow?')) return;
    if (await enhancedWorkflowService.deleteWorkflow(id)) {
      await loadWorkflows();
      if (selectedWorkflow?.id === id) { setSelectedWorkflow(null); setShowBuilder(false); }
    }
  };

  const toggleWorkflowStatus = async (wf: Workflow) => {
    const updated = { ...wf, settings: { ...wf.settings, isActive: !wf.settings.isActive } };
    if (await enhancedWorkflowService.updateWorkflow(wf.id, updated)) await loadWorkflows();
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse" aria-busy="true">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
        <div className="space-y-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" /><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" /></div>
      </div>
    );
  }

  if (showBuilder && selectedWorkflow) {
    return (
      <div className="space-y-3">
        <div className={`${card} p-3 flex flex-wrap items-center gap-3`}>
          <button
            type="button"
            onClick={() => { if (!dirty || window.confirm('Discard unsaved changes?')) setShowBuilder(false); }}
            className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Workflows
          </button>
          <input
            aria-label="Workflow name"
            value={selectedWorkflow.name}
            disabled={!canManage}
            onChange={e => { setSelectedWorkflow({ ...selectedWorkflow, name: e.target.value }); setDirty(true); }}
            className="flex-1 min-w-[10rem] px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={selectedWorkflow.settings.isActive}
              disabled={!canManage}
              onChange={e => { setSelectedWorkflow({ ...selectedWorkflow, settings: { ...selectedWorkflow.settings, isActive: e.target.checked } }); setDirty(true); }}
            /> Active
          </label>
          {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>}
        </div>
        {notice && (
          <p role="status" className={`text-sm rounded-lg px-3 py-2 ${notice.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>{notice.text}</p>
        )}
        <div className="h-[calc(100vh-15rem)] min-h-[560px]">
          <WorkflowBuilder
            workflow={selectedWorkflow}
            onWorkflowChange={wf => { setSelectedWorkflow(wf); setDirty(true); }}
            onSave={saveWorkflow}
            onExecute={executeWorkflow}
            isExecuting={isExecuting}
          />
        </div>
      </div>
    );
  }

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'workflows', label: 'Workflows', count: workflows.length },
    { key: 'executions', label: 'Executions' },
    { key: 'templates', label: 'Templates', count: emailTemplates.length + webhookConfigs.length + aiAgentConfigs.length },
    { key: 'integrations', label: 'Integrations' }
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Workflow sections">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === tab.key ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {tab.label}
              {tab.count !== undefined && <span className="ml-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">{tab.count}</span>}
            </button>
          ))}
        </div>
        <button type="button" disabled={!canManage} title={denyTitle} onClick={() => openBuilder(newWorkflowTemplate())} className="px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> New Workflow
        </button>
      </div>

      {activeTab === 'workflows' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map(workflow => (
            <div key={workflow.id} className={`${card} p-5 hover:shadow-md transition-shadow`}>
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{workflow.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{workflow.description}</p>
                </div>
                <span className={badge(workflow.settings.isActive)}>{workflow.settings.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <dl className="space-y-1.5 mb-4 text-sm">
                {[['Category', workflow.category.replace('_', ' ')], ['Steps', String(workflow.steps.length)], ['Triggers', String(workflow.triggers.length)], ['Success rate', `${workflow.metadata.successRate.toFixed(1)}%`]].map(([k, v]) => (
                  <div key={k} className="flex justify-between"><dt className="text-gray-600 dark:text-gray-400">{k}</dt><dd className="font-medium capitalize text-gray-900 dark:text-white">{v}</dd></div>
                ))}
              </dl>
              <div className="flex gap-2">
                <button type="button" onClick={() => openBuilder(workflow)} className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center justify-center gap-1"><Edit className="w-4 h-4" /> Edit</button>
                <button type="button" disabled={!canManage} title={denyTitle} onClick={() => toggleWorkflowStatus(workflow)} aria-label={workflow.settings.isActive ? 'Deactivate workflow' : 'Activate workflow'} className={`px-3 py-1.5 text-sm rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed ${workflow.settings.isActive ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}>
                  {workflow.settings.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button type="button" disabled={!canManage} title={denyTitle} onClick={() => deleteWorkflow(workflow.id)} aria-label="Delete workflow" className="px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 text-white rounded-lg hover:bg-red-700"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {workflows.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Settings className="w-14 h-14 mx-auto mb-3 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Workflows Yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first automated workflow to get started.</p>
              <button type="button" disabled={!canManage} title={denyTitle} onClick={() => openBuilder(newWorkflowTemplate())} className="px-4 py-2 disabled:opacity-50 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Workflow</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'executions' && <WorkflowRunHistory limit={50} />}

      {activeTab === 'templates' && (
        <div className="space-y-6">
          {([
            { title: 'Email Templates', icon: <Mail className="w-5 h-5 mr-2" />, items: emailTemplates.map(t => ({ id: t.id, name: t.name, active: t.isActive, desc: t.description, meta: `Subject: ${t.subject}` })) },
            { title: 'Webhook Configurations', icon: <Globe className="w-5 h-5 mr-2" />, items: webhookConfigs.map(c => ({ id: c.id, name: c.name, active: c.isActive, desc: c.url, meta: `Method: ${c.method} • Events: ${c.events.join(', ')}` })) },
            { title: 'AI Agent Configurations', icon: <Bot className="w-5 h-5 mr-2" />, items: aiAgentConfigs.map(c => ({ id: c.id, name: c.name, active: c.isActive, desc: c.description, meta: `Model: ${c.model} • Tools: ${c.tools.length}` })) }
          ]).map(section => (
            <div key={section.title}>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center">{section.icon}{section.title} ({section.items.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map(i => (
                  <div key={i.id} className={`${card} p-4`}>
                    <div className="flex justify-between items-start mb-2"><h4 className="font-medium text-gray-900 dark:text-white">{i.name}</h4><span className={badge(i.active)}>{i.active ? 'Active' : 'Inactive'}</span></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{i.desc}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{i.meta}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <div className={`${card} p-6`}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Workflow Integrations</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: <Mail className="w-10 h-10 mx-auto mb-3 text-blue-600" />, title: 'Email', text: 'Queue automated emails via connected accounts' },
                { icon: <Globe className="w-10 h-10 mx-auto mb-3 text-green-600" />, title: 'Webhooks & HTTP', text: 'Call external HTTPS APIs from any step' },
                { icon: <Bot className="w-10 h-10 mx-auto mb-3 text-purple-600" />, title: 'AI agent', text: 'Intelligent automation with AI prompts' }
              ].map(i => (
                <div key={i.title} className="text-center">{i.icon}<h4 className="font-medium text-gray-900 dark:text-white mb-1">{i.title}</h4><p className="text-sm text-gray-600 dark:text-gray-400">{i.text}</p></div>
              ))}
            </div>
          </div>
          <div className={`${card} p-6 grid grid-cols-1 md:grid-cols-2 gap-6`}>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">SLA monitoring</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Use the SLA breach trigger to react to stale or overdue deals.</p>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400"><AlertTriangle className="w-4 h-4 mr-1 text-amber-500" /> Runs server-side every 5 minutes</div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Run history</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Open any run in the Executions tab to see per-step results.</p>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400"><BarChart3 className="w-4 h-4 mr-1 text-blue-600" /> Live updates</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
