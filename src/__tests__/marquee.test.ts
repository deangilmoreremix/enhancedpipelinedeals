import {
  rectFromPoints, rectsIntersect, idsInMarquee, applyMarqueeSelection, exceedsThreshold, isMarqueeBlocked, MARQUEE_THRESHOLD
} from '../utils/marquee';

const card = (id: string, left: number, top: number, w = 100, h = 60) => ({ id, rect: { left, top, right: left + w, bottom: top + h } });

describe('marquee geometry', () => {
  it('normalises a rectangle drawn in any direction', () => {
    expect(rectFromPoints({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({ left: 10, top: 20, right: 50, bottom: 80 });
    expect(rectFromPoints({ x: 10, y: 20 }, { x: 50, y: 80 })).toEqual({ left: 10, top: 20, right: 50, bottom: 80 });
  });

  it('intersects overlapping rectangles but not touching or distant ones', () => {
    const a = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(rectsIntersect(a, { left: 50, top: 50, right: 150, bottom: 150 })).toBe(true);
    expect(rectsIntersect(a, { left: 100, top: 0, right: 200, bottom: 100 })).toBe(false); // edge only
    expect(rectsIntersect(a, { left: 200, top: 200, right: 300, bottom: 300 })).toBe(false);
    expect(rectsIntersect(a, { left: 10, top: 10, right: 20, bottom: 20 })).toBe(true); // fully inside
  });

  it('returns the ids of the cards the marquee touches, in input order', () => {
    const cards = [card('a', 0, 0), card('b', 0, 80), card('c', 120, 0), card('d', 120, 80)];
    // spans the first column and the top of the second column
    const hit = idsInMarquee({ left: 20, top: 20, right: 160, bottom: 50 }, cards);
    expect(hit).toEqual(['a', 'c']);
    expect(idsInMarquee({ left: 500, top: 500, right: 600, bottom: 600 }, cards)).toEqual([]);
    expect(idsInMarquee(rectFromPoints({ x: 0, y: 0 }, { x: 400, y: 400 }), cards)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('replaces the selection, or adds to it with Shift', () => {
    expect(applyMarqueeSelection(['x'], ['a', 'b'], false)).toEqual(['a', 'b']);
    expect(applyMarqueeSelection(['x', 'a'], ['a', 'b'], true)).toEqual(['x', 'a', 'b']);
  });

  it('only starts after the pointer travelled past the threshold', () => {
    expect(exceedsThreshold({ x: 0, y: 0 }, { x: MARQUEE_THRESHOLD - 1, y: 0 })).toBe(false);
    expect(exceedsThreshold({ x: 0, y: 0 }, { x: 0, y: MARQUEE_THRESHOLD })).toBe(true);
  });

  it('does not start on cards, buttons, inputs or drag handles', () => {
    document.body.innerHTML = `
      <div id="bg"><div data-deal-id="a"><span id="in-card">x</span></div>
      <button id="btn">b</button><input id="inp" />
      <div data-rfd-drag-handle-draggable-id="col:x"><i id="handle"></i></div></div>`;
    const el = (id: string) => document.getElementById(id);
    expect(isMarqueeBlocked(el('bg'))).toBe(false);
    expect(isMarqueeBlocked(el('in-card'))).toBe(true);
    expect(isMarqueeBlocked(el('btn'))).toBe(true);
    expect(isMarqueeBlocked(el('inp'))).toBe(true);
    expect(isMarqueeBlocked(el('handle'))).toBe(true);
    expect(isMarqueeBlocked(null)).toBe(true);
  });
});
