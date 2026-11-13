import { winRatePercent } from '../../utils/winRate';
import { winRate } from '../../services/analyticsService';

/** Regression (e2e F): KPI "Win Rate" widgets used won/all deals (17%) while the gauge used won/(won+lost) (100%). */
describe('winRatePercent', () => {
  it('ignores open deals', () => { expect(winRatePercent(1, 0)).toBe(100); expect(winRatePercent(1, 3)).toBe(25); });
  it('is 0 when nothing closed', () => { expect(winRatePercent(0, 0)).toBe(0); });
  it('matches analyticsService.winRate', () => {
    const stages: any[] = [{ key: 'w', isWon: true, isLost: false, position: 0 }, { key: 'l', isWon: false, isLost: true, position: 1 }, { key: 'o', isWon: false, isLost: false, position: 2 }];
    const deals: any[] = [{ id: 1, stage: 'w', value: 1 }, { id: 2, stage: 'l', value: 1 }, { id: 3, stage: 'o', value: 1 }, { id: 4, stage: 'w', value: 1 }];
    const r = winRate(deals, stages);
    expect(winRatePercent(r.won, r.lost)).toBeCloseTo(r.rate * 100);
  });
});
