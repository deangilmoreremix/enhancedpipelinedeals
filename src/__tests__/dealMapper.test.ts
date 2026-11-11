import { describe, it, expect } from '@jest/globals';
import { dealFromRow, dealToRow } from '../services/dealMapper';
import type { Deal } from '../types';

const row = {
  id: 'd1',
  title: 'Acme renewal',
  company: 'Acme',
  contact: 'Jane',
  contact_id: 'c1',
  value: '12500.5',
  stage: 'proposal',
  probability: 40,
  priority: 'high',
  due_date: '2026-09-01T00:00:00.000Z',
  notes: 'n',
  tags: ['a'],
  custom_fields: { x: 1 },
  next_follow_up: '2026-09-02',
  is_favorite: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  contact_avatar: 'ca',
  company_avatar: 'co',
  health_score: 80,
  win_probability: 55,
  ai_score: 90,
  position: 3,
  deleted_at: null,
  owner_id: 'u1',
  close_date: '2026-10-01T00:00:00.000Z',
  currency_code: 'EUR',
};

describe('dealMapper', () => {
  it('maps row to Deal with Dates and camelCase', () => {
    const d = dealFromRow(row);
    expect(d.contactId).toBe('c1');
    expect(d.value).toBe(12500.5);
    expect(d.dueDate).toBeInstanceOf(Date);
    expect(d.createdAt).toBeInstanceOf(Date);
    expect(d.updatedAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expect(d.customFields).toEqual({ x: 1 });
    expect(d.isFavorite).toBe(true);
    expect(d.contactAvatar).toBe('ca');
    expect(d.healthScore).toBe(80);
    expect(d.position).toBe(3);
    expect(d.deletedAt).toBeUndefined();
    expect(d.closeDate).toBeInstanceOf(Date);
    expect(d.currencyCode).toBe('EUR');
  });

  it('round-trips', () => {
    const d = dealFromRow(row);
    const back = dealToRow(d);
    expect(back.contact_id).toBe('c1');
    expect(back.value).toBe(12500.5);
    expect(back.amount_micros).toBe(12500500000);
    expect(back.due_date).toBe('2026-09-01T00:00:00.000Z');
    expect(back.deleted_at).toBeUndefined();
    expect(dealFromRow(back)).toEqual(d);
  });

  it('handles missing fields', () => {
    const d = dealFromRow({ id: 'x' });
    expect(d.stage).toBe('qualification');
    expect(d.value).toBe(0);
    expect(d.company).toBe('');
    expect(d.dueDate).toBeUndefined();
    expect(d.createdAt).toBeInstanceOf(Date);
  });

  it('falls back to amount_micros when value is absent', () => {
    expect(dealFromRow({ id: 'x', amount_micros: 2500000 }).value).toBe(2.5);
  });

  it('partial updates only emit provided keys', () => {
    const r = dealToRow({ stage: 'negotiation', position: 2 }, { partial: true });
    expect(r).toEqual({ stage: 'negotiation', position: 2 });
  });

  it('partial value update also emits amount_micros', () => {
    expect(dealToRow({ value: 10 }, { partial: true })).toEqual({ value: 10, amount_micros: 10000000 });
  });

  it('serializes Dates and clears deletedAt with null', () => {
    const r = dealToRow({ dueDate: new Date('2026-05-05T00:00:00.000Z'), deletedAt: null }, { partial: true });
    expect(r.due_date).toBe('2026-05-05T00:00:00.000Z');
    expect(r.deleted_at).toBeNull();
    expect(dealToRow({ deletedAt: new Date('2026-05-05T00:00:00.000Z') }, { partial: true }).deleted_at).toBe('2026-05-05T00:00:00.000Z');
  });

  it('full writes stamp timestamps', () => {
    const r = dealToRow({ company: 'A' } as Partial<Deal>);
    expect(typeof r.created_at).toBe('string');
    expect(typeof r.updated_at).toBe('string');
  });
});

describe('dealMapper company & owner', () => {
  it('maps company_id <-> companyId', () => {
    const d = dealFromRow({ id: 'x', company: 'Acme', company_id: 'co1' });
    expect(d.companyId).toBe('co1');
    expect(dealToRow(d, { partial: true }).company_id).toBe('co1');
    expect(dealFromRow({ id: 'y' }).companyId).toBeUndefined();
  });

  it('null companyId clears the column', () => {
    expect(dealToRow({ companyId: null as unknown as string }, { partial: true })).toEqual({ company_id: null });
  });

  it('ownerId reads owner_id first, then legacy assigned_to_id', () => {
    expect(dealFromRow({ id: 'x', owner_id: 'o', assigned_to_id: 'a' }).ownerId).toBe('o');
    expect(dealFromRow({ id: 'x', assigned_to_id: 'a' }).ownerId).toBe('a');
    expect(dealFromRow({ id: 'x', assigned_to: 'Ann' }).assignedTo).toBe('Ann');
  });

  it('writes owner_id plus assigned_to compatibility fields when provided', () => {
    const r = dealToRow({ ownerId: 'o', assignedTo: 'Ann', assignedToId: 'o' }, { partial: true });
    expect(r).toEqual({ owner_id: 'o', assigned_to: 'Ann', assigned_to_id: 'o' });
    expect(dealToRow({ ownerId: null as unknown as string, assignedTo: null as unknown as string }, { partial: true }))
      .toEqual({ owner_id: null, assigned_to: null });
  });
});
