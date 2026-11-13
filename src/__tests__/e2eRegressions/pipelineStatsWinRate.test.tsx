import React from 'react';
import { render, screen } from '@testing-library/react';
import PipelineStats from '../../components/PipelineStats';

/** Regression (e2e B): headline Win Rate rendered as "16.666666666666664%". */
describe('PipelineStats win rate formatting', () => {
  it('rounds the win rate to one decimal', () => {
    render(<PipelineStats totalValue={1} totalDeals={6} averageDealSize={1} conversionRate={100 / 6} />);
    expect(screen.getByText('16.7%')).toBeTruthy();
    expect(screen.queryByText(/16\.6666/)).toBeNull();
  });
  it('drops a trailing .0', () => {
    render(<PipelineStats totalValue={1} totalDeals={2} averageDealSize={1} conversionRate={50} />);
    expect(screen.getByText('50%')).toBeTruthy();
  });
});
