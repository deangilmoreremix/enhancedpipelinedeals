import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PipelineSummaryBar from '../components/pipeline/PipelineSummaryBar';
import type { Deal, PipelineStage } from '../types';

const stages: PipelineStage[] = [
  { id: 'lead', key: 'lead', name: 'Lead', color: 'blue', position: 0, visible: true, probability: 10, isWon: false, isLost: false },
  { id: 'won', key: 'won', name: 'Won', color: 'green', position: 1, visible: true, probability: 100, isWon: true, isLost: false },
  { id: 'lost', key: 'lost', name: 'Lost', color: 'red', position: 2, visible: true, probability: 0, isWon: false, isLost: true }
];
const mk = (id: string, stage: string, value: number): Deal => ({
  id, company: id, contact: 'c', value, stage, probability: 0, priority: 'low', createdAt: new Date(), updatedAt: new Date()
});

describe('PipelineSummaryBar', () => {
  const deals = [mk('a', 'lead', 10000), mk('b', 'won', 5000), mk('c', 'lost', 1000)];

  it('shows totals, weighted forecast, count and win rate', () => {
    render(<PipelineSummaryBar deals={deals} stages={stages} />);
    const bar = screen.getByTestId('pipeline-summary-bar');
    expect(bar).toHaveTextContent('$16.0K');   // total
    expect(bar).toHaveTextContent('Weighted forecast$1.0K'); // weighted: 10000 * 10%
    expect(bar).toHaveTextContent('3');        // deals
    expect(bar).toHaveTextContent('50%');      // 1 won / (1 won + 1 lost)
    expect(screen.getByText(/Lead: 1/)).toBeInTheDocument();
  });

  it('collapses and expands the stage breakdown', () => {
    render(<PipelineSummaryBar deals={deals} stages={stages} />);
    expect(screen.getByTestId('pipeline-summary-stages')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /collapse pipeline summary/i }));
    expect(screen.queryByTestId('pipeline-summary-stages')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /expand pipeline summary/i }));
    expect(screen.getByTestId('pipeline-summary-stages')).toBeInTheDocument();
  });

  it('renders an empty pipeline without crashing', () => {
    render(<PipelineSummaryBar deals={[]} stages={stages} />);
    expect(screen.getByTestId('pipeline-summary-bar')).toHaveTextContent('—');
  });
});
