import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CurrencyField } from '../components/deals/fields/CurrencyField';
import { toMicros, fromMicros, parseAmountInput } from '../utils/currencyMicros';

describe('currency micros helpers', () => {
  it('converts between major units and micros', () => {
    expect(toMicros(1500.25)).toBe(1_500_250_000);
    expect(toMicros(0.1 + 0.2)).toBe(300_000);
    expect(fromMicros(1_500_250_000)).toBe(1500.25);
  });
  it('parses user input', () => {
    expect(parseAmountInput('$1,234.50')).toBe(1234.5);
    expect(parseAmountInput('1.234,5')).toBe(1234.5);
    expect(parseAmountInput('abc')).toBeNull();
  });
});

describe('CurrencyField', () => {
  it('displays the amount formatted in its currency', () => {
    render(<CurrencyField value={1500} currencyCode="USD" onSave={jest.fn()} />);
    expect(screen.getByRole('button', { name: '$1,500' })).toBeInTheDocument();
  });

  it('edits in major units and saves micros + currency on Enter', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<CurrencyField value={1500} currencyCode="USD" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: '$1,500' }));
    const input = screen.getByLabelText('Amount');
    expect(input).toHaveValue('1500');
    fireEvent.change(input, { target: { value: '2,500.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ value: 2500.5, amountMicros: 2_500_500_000, currencyCode: 'USD' });
  });

  it('saves a changed currency code', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<CurrencyField value={10} currencyCode="USD" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
    fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ value: 10, amountMicros: 10_000_000, currencyCode: 'EUR' }));
  });

  it('Escape cancels without saving', () => {
    const onSave = jest.fn();
    render(<CurrencyField value={1500} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: '$1,500' }));
    const input = screen.getByLabelText('Amount');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '$1,500' })).toBeInTheDocument();
  });

  it('rejects invalid input inline and stays in edit mode', () => {
    const onSave = jest.fn();
    render(<CurrencyField value={1500} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: '$1,500' }));
    const input = screen.getByLabelText('Amount');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid amount');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows the optimistic value then an inline error when saving fails', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('RLS denied'));
    render(<CurrencyField value={1500} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: '$1,500' }));
    const input = screen.getByLabelText('Amount');
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByRole('alert')).toHaveTextContent('RLS denied');
    expect(screen.getByRole('button', { name: '$1,500' })).toBeInTheDocument();
  });
});
