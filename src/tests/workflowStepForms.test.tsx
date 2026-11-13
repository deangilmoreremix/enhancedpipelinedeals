import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StepPicker } from '../components/workflows/StepPicker';
import { StepConfigForm } from '../components/workflows/StepConfigForm';
import { VariablePicker, buildVariableGroups } from '../components/workflows/VariablePicker';
import type { WorkflowStep } from '../types/workflow';

const step = (over: Partial<WorkflowStep>): WorkflowStep => ({ id: 's1', name: 'Step', type: 'action', position: { x: 0, y: 0 }, connections: [], isActive: true, ...over });

describe('StepPicker', () => {
  it('lists the catalog grouped by category and filters by search', () => {
    render(<StepPicker onSelect={jest.fn()} />);
    expect(screen.getByText('Records')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create task/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search steps'), { target: { value: 'email' } });
    expect(screen.getByRole('button', { name: /Send email/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create task/ })).not.toBeInTheDocument();
  });

  it('selects an entry on click', () => {
    const onSelect = jest.fn();
    render(<StepPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Send email/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'send_email' }));
  });

  it('disables steps the server cannot run, with a tooltip', () => {
    const onSelect = jest.fn();
    render(<StepPicker onSelect={onSelect} />);
    const code = screen.getByRole('button', { name: /Run code/ });
    expect(code).toBeDisabled();
    expect(code.getAttribute('title')).toMatch(/server runner/i);
    fireEvent.click(code);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('disables extra triggers when the workflow already has one', () => {
    render(<StepPicker onSelect={jest.fn()} hasTrigger />);
    const trig = screen.getByRole('button', { name: /Record created/ });
    expect(trig).toBeDisabled();
    expect(trig.getAttribute('title')).toMatch(/already has a trigger/i);
  });
});

describe('StepConfigForm', () => {
  const Harness: React.FC<{ initial: WorkflowStep; steps?: WorkflowStep[]; onChange?: (s: WorkflowStep) => void }> = ({ initial, steps, onChange }) => {
    const [s, setS] = useState(initial);
    return <StepConfigForm step={s} steps={steps ?? [s]} onChange={n => { setS(n); onChange?.(n); }} stageOptions={[{ value: 'proposal', label: 'Proposal' }, { value: 'won', label: 'Won' }]} />;
  };

  it('renders schema fields for an action and writes dotted config keys', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} initial={step({ action: { id: 'a', type: 'create_task', name: 'Create task', description: '', config: {} } })} />);
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Call back' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ action: expect.objectContaining({ config: { fields: { title: 'Call back' } } }) }));
    fireEvent.change(screen.getByLabelText(/Due in/), { target: { value: '3' } });
    expect(onChange.mock.calls.at(-1)?.[0].action.config.fields).toEqual({ title: 'Call back', dueInDays: 3 });
  });

  it('shows HTTP body only for body methods and parses JSON headers', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} initial={step({ action: { id: 'a', type: 'http_request', name: 'HTTP', description: '', config: { httpMethod: 'GET' } } })} />);
    expect(screen.queryByLabelText(/Body \(JSON\)/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'POST' } });
    expect(screen.getByLabelText(/Body \(JSON\)/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Headers \(JSON\)/), { target: { value: '{"X-Key": "1"}' } });
    expect(onChange.mock.calls.at(-1)?.[0].action.config.httpHeaders).toEqual({ 'X-Key': '1' });
    fireEvent.change(screen.getByLabelText(/Headers \(JSON\)/), { target: { value: '{bad' } });
    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
  });

  it('edits error handling (continue on error / retries)', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} initial={step({ action: { id: 'a', type: 'notification', name: 'N', description: '', config: {} } })} />);
    fireEvent.click(screen.getByLabelText(/Continue workflow if this step fails/));
    expect(onChange.mock.calls.at(-1)?.[0].action.errorHandling).toEqual({ continueOnError: true, retryCount: undefined });
    fireEvent.change(screen.getByLabelText('Retry count'), { target: { value: '2' } });
    expect(onChange.mock.calls.at(-1)?.[0].action.errorHandling).toEqual({ continueOnError: true, retryCount: 2 });
  });

  it('edits a condition (field / operator / value) and hides the value for is_empty', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} initial={step({ type: 'condition', condition: { id: 'c', field: '', operator: 'equals', value: '' } })} />);
    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'value' } });
    fireEvent.change(screen.getByLabelText('Operator'), { target: { value: 'greater_than' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '1000' } });
    expect(onChange.mock.calls.at(-1)?.[0].condition).toMatchObject({ field: 'value', operator: 'greater_than', value: '1000' });
    fireEvent.change(screen.getByLabelText('Operator'), { target: { value: 'is_empty' } });
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
  });

  it('configures a trigger (stage select) and an AND/OR trigger condition list', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} initial={step({ type: 'trigger', trigger: { id: 't', type: 'stage_changed', name: 'Stage changed', description: '', config: {}, isActive: true } })} />);
    fireEvent.change(screen.getByLabelText('To stage'), { target: { value: 'won' } });
    expect(onChange.mock.calls.at(-1)?.[0].trigger.config).toEqual({ toStage: 'won' });
    fireEvent.click(screen.getByRole('button', { name: /Add condition/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add condition/ }));
    const op = screen.getByLabelText('Logical operator');
    fireEvent.change(op, { target: { value: 'OR' } });
    expect(onChange.mock.calls.at(-1)?.[0].trigger.conditions[0].logicalOperator).toBe('OR');
  });

  it('edits delay minutes and the active toggle', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} initial={step({ type: 'delay', delay: 60 })} />);
    fireEvent.change(screen.getByLabelText(/Wait \(minutes\)/), { target: { value: '15' } });
    expect(onChange.mock.calls.at(-1)?.[0].delay).toBe(15);
    fireEvent.click(screen.getByLabelText('Active'));
    expect(onChange.mock.calls.at(-1)?.[0].isActive).toBe(false);
  });
});

describe('VariablePicker', () => {
  const steps: WorkflowStep[] = [
    step({ id: 'trig', type: 'trigger', name: 'Trigger', connections: ['ai'] }),
    step({ id: 'ai', name: 'Summarise', connections: ['mail'], action: { id: 'x', type: 'ai_agent', name: 'AI', description: '', config: {} } }),
    step({ id: 'mail', name: 'Mail', action: { id: 'y', type: 'send_email', name: 'Mail', description: '', config: {} } })
  ];

  it('builds record, trigger and previous-step tokens matching the executor syntax', () => {
    const groups = buildVariableGroups(steps, 'mail');
    const tokens = groups.flatMap(g => g.items.map(i => i.token));
    expect(tokens).toEqual(expect.arrayContaining(['{{record.title}}', '{{trigger.to}}', '{{recordId}}', '{{steps.ai.output.text}}', '{{aiResult}}']));
    expect(tokens).not.toContain('{{steps.mail.output}}'); // only ancestors
  });

  it('inserts a token via the popover', () => {
    const onInsert = jest.fn();
    render(<VariablePicker steps={steps} currentStepId="mail" onInsert={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert variable' }));
    const dialog = screen.getByRole('dialog', { name: 'Variables' });
    fireEvent.click(within(dialog).getByText('Summarise: text'));
    expect(onInsert).toHaveBeenCalledWith('{{steps.ai.output.text}}');
  });
});
