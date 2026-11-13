import type { Deal, PipelineStage } from '../types';
import {
  atRiskDeals, conversionFunnel, cycleTime, forecastByMonth, groupAggregate, stageSummaries,
  timeInStage, weightedForecast, winRate, pipelineVelocity, filterDealsByRange, type HistoryRow
} from '../services/analyticsService';

const stage = (key: string, position: number, probability: number, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id: key, key, name: key.toUpperCase(), color: 'blue', position, visible: true, probability, isWon: false, isLost: false, ...extra
});
const STAGES: PipelineStage[] = [
  stage('lead', 0, 10),
  stage('proposal', 1, 50),
  stage('won', 2, 100, { isWon: true }),
  stage('lost', 3, 0, { isLost: true })
];
const NOW = new Date('2026-06-15T00:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const deal = (id: string, stageKey: string, value: number, extra: Partial<Deal> = {}): Deal => ({
  id, company: `Co ${id}`, contact: 'x', value, stage: stageKey, probability: 0, priority: 'medium',
  createdAt: day(-60), updatedAt: day(-1), ...extra
});

describe('analyticsService', () => {
  const deals = [
    deal('a', 'lead', 1000),
    deal('b', 'lead', 3000),
    deal('c', 'proposal', 10000, { closeDate: new Date('2026-07-10T00:00:00Z') }),
    deal('d', 'won', 5000, { updatedAt: day(-10) }),
    deal('e', 'won', 7000, { updatedAt: day(-20) }),
    deal('f', 'lost', 2000)
  ];

  it('summarises value/count/avg per stage in stage order', () => {
    const s = stageSummaries(deals, STAGES);
    expect(s.map(x => x.key)).toEqual(['lead', 'proposal', 'won', 'lost']);
    expect(s[0]).toMatchObject({ value: 4000, count: 2, avgDealSize: 2000 });
    expect(s[3]).toMatchObject({ value: 2000, count: 1 });
  });

  it('computes win rate from stage flags', () => {
    const r = winRate(deals, STAGES);
    expect(r).toMatchObject({ won: 2, lost: 1, wonValue: 12000, lostValue: 2000 });
    expect(r.rate).toBeCloseTo(2 / 3);
    expect(winRate([deals[0]], STAGES).rate).toBe(0);
  });

  it('weights only open deals by stage probability', () => {
    const f = weightedForecast(deals, STAGES);
    expect(f.count).toBe(3);
    expect(f.total).toBe(14000);
    expect(f.weighted).toBeCloseTo(4000 * 0.1 + 10000 * 0.5);
  });

  it('can prefer the deal probability and falls back when the stage is unknown', () => {
    const d = deal('x', 'mystery', 1000, { probability: 80 });
    expect(weightedForecast([d], STAGES).weighted).toBe(800);
    const p = deal('y', 'lead', 1000, { probability: 90 });
    expect(weightedForecast([p], STAGES, 'deal').weighted).toBe(900);
  });

  it('buckets the forecast by close month with an unscheduled bucket last', () => {
    const months = forecastByMonth(deals, STAGES);
    expect(months.map(m => m.month)).toEqual(['2026-07', 'unscheduled']);
    expect(months[0]).toMatchObject({ total: 10000, weighted: 5000, count: 1 });
    expect(months[1]).toMatchObject({ total: 4000, count: 2 });
  });

  describe('funnel', () => {
    it('falls back to stage order without history', () => {
      const f = conversionFunnel(deals, STAGES);
      expect(f.map(s => s.key)).toEqual(['lead', 'proposal', 'won']);
      expect(f.map(s => s.reached)).toEqual([5, 3, 2]);
      expect(f[1].conversionFromPrev).toBeCloseTo(3 / 5);
      expect(f[2].conversionFromFirst).toBeCloseTo(2 / 5);
      expect(f[0].source).toBe('stage-order');
    });

    it('uses history so lost deals count for the stages they reached', () => {
      const history: HistoryRow[] = [
        { deal_id: 'f', field: 'stage', old_value: 'lead', new_value: 'proposal', changed_at: day(-30).toISOString() },
        { deal_id: 'f', field: 'stage', old_value: 'proposal', new_value: 'lost', changed_at: day(-20).toISOString() }
      ];
      const f = conversionFunnel(deals, STAGES, history);
      expect(f.map(s => s.reached)).toEqual([6, 4, 2]);
      expect(f[0].source).toBe('history');
    });
  });

  describe('time in stage / cycle time', () => {
    const history: HistoryRow[] = [
      { deal_id: 'd', field: 'stage', old_value: 'lead', new_value: 'proposal', changed_at: day(-50).toISOString() },
      { deal_id: 'd', field: 'stage', old_value: 'proposal', new_value: 'won', changed_at: day(-30).toISOString() },
      { deal_id: 'noise', field: 'value', old_value: '1', new_value: '2', changed_at: day(-30).toISOString() }
    ];

    it('measures dwell per stage from history', () => {
      const rows = timeInStage([deals[3]], STAGES, history, NOW);
      expect(rows.find(r => r.key === 'lead')).toMatchObject({ avgDays: 10, samples: 1, source: 'history' });
      expect(rows.find(r => r.key === 'proposal')).toMatchObject({ avgDays: 20, samples: 1 });
    });

    it('estimates from updatedAt when no history exists', () => {
      const rows = timeInStage([deals[0]], STAGES, [], NOW);
      expect(rows.find(r => r.key === 'lead')).toMatchObject({ avgDays: 1, source: 'estimated' });
    });

    it('computes cycle time from the first won transition', () => {
      expect(cycleTime([deals[3]], STAGES, history)).toEqual({ avgDays: 30, samples: 1 });
      // fallback: createdAt (-60) -> updatedAt (-20) for deal e
      expect(cycleTime([deals[4]], STAGES, [])).toEqual({ avgDays: 40, samples: 1 });
    });

    it('derives velocity from open deals, win rate and cycle time', () => {
      const v = pipelineVelocity(deals, STAGES, []);
      // open=3 avg=14000/3, winRate=2/3, cycle=(50+40)/2=45 -> (3*4666.67*0.6667)/45
      expect(v).toBeCloseTo((3 * (14000 / 3) * (2 / 3)) / 45, 1);
    });
  });

  it('flags stale and overdue deals, worst first', () => {
    const stale = deal('s', 'lead', 5000, { updatedAt: day(-45) });
    const overdue = deal('o', 'proposal', 9000, { updatedAt: day(-2), closeDate: day(-10) });
    const fine = deal('ok', 'proposal', 9000, { updatedAt: day(-1) });
    const r = atRiskDeals([stale, overdue, fine, deals[3]], STAGES, { now: NOW });
    expect(r.map(x => x.deal.id)).toEqual(['s', 'o']);
    expect(r[0].reasons[0]).toMatch(/45 days/);
  });

  it('groups and aggregates by dimension', () => {
    const byStage = groupAggregate(deals, STAGES, 'stage', 'sum');
    expect(byStage.map(g => g.value)).toEqual([4000, 10000, 12000, 2000]);
    const count = groupAggregate(deals, STAGES, 'priority', 'count');
    expect(count).toEqual([{ key: 'medium', label: 'Medium', value: 6, count: 6 }]);
    const avg = groupAggregate(deals, STAGES, 'stage', 'avg');
    expect(avg[0].value).toBe(2000);
    const owner = groupAggregate([deal('z', 'lead', 1, { assignedTo: 'Sam' }), deal('y', 'lead', 3)], STAGES, 'owner', 'sum');
    expect(owner.map(o => o.label).sort()).toEqual(['Sam', 'Unassigned']);
  });

  it('filters deals by created date range', () => {
    const recent = deal('r', 'lead', 1, { createdAt: day(-3) });
    expect(filterDealsByRange([recent, deals[0]], '7d', NOW).map(d => d.id)).toEqual(['r']);
    expect(filterDealsByRange([recent, deals[0]], 'all', NOW)).toHaveLength(2);
  });
});
