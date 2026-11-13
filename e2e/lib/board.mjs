// Shared board helpers for scenarios (selectors rely on data-deal-id / data-column-key / data-testid).
export const card = (page, id) => page.locator(`[data-deal-id="${id}"]`).first();
export const column = (page, key) => page.locator(`[data-column-key="${key}"]`).first();
export const stageCardsText = async (page, key) => column(page, key).locator('[data-deal-id]').evaluateAll(els => els.map(e => e.getAttribute('data-deal-id')));

/** Read a slice of store state from the dev-only window.__e2e hook. */
export const dealsState = (page) => page.evaluate(() => {
  const s = window.__e2e.deal.getState();
  return Object.values(s.deals).map(d => ({ id: d.id, title: d.title, stage: d.stage, position: d.position, priority: d.priority, value: d.value, assignedTo: d.assignedTo, ownerId: d.ownerId, tags: d.tags, isFavorite: d.isFavorite, company: d.company, deletedAt: d.deletedAt, nextFollowUp: d.nextFollowUp, dueDate: d.dueDate }));
});
export const stagesState = (page) => page.evaluate(() => window.__e2e.deal.getState().stages.map(s => ({ key: s.key, name: s.name, position: s.position, color: s.color, probability: s.probability, isWon: s.isWon, isLost: s.isLost, isHidden: s.isHidden, wipLimit: s.wipLimit })));
export const trashState = (page) => page.evaluate(() => Object.values(window.__e2e.deal.getState().trash).map(d => ({ id: d.id, title: d.title })));
export const selState = (page) => page.evaluate(() => ({ selected: window.__e2e.selection.getState().selectedIds, focused: window.__e2e.selection.getState().focusedId }));

export async function openBoard(page, ctx) {
  await page.goto('/');
  await page.waitForSelector('[data-deal-id]', { timeout: 15000 });
  await page.waitForFunction(() => !!window.__e2e, null, { timeout: 10000 });
  await page.waitForSelector('[data-deal-id]');
  await page.waitForTimeout(300);
}

/** Drag with explicit mouse steps so @hello-pangea/dnd registers (sloppy-click threshold + steps). */
export async function dragTo(page, fromLoc, toLoc, { shift = false, shiftEarly = false, toOffset } = {}) {
  const a = await fromLoc.boundingBox(); const b = await toLoc.boundingBox();
  if (!a || !b) throw new Error('dragTo: missing bounding box');
  const sx = a.x + a.width / 2, sy = a.y + 40;
  const tx = b.x + b.width / 2, ty = toOffset != null ? b.y + toOffset : b.y + Math.min(b.height / 2, 120);
  if (shiftEarly) await page.keyboard.down('Shift');
  await page.mouse.move(sx, sy); await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(sx + 12, sy + 12, { steps: 4 }); await page.waitForTimeout(120);
  const steps = 18;
  for (let i = 1; i <= steps; i++) { await page.mouse.move(sx + (tx - sx) * i / steps, sy + (ty - sy) * i / steps); await page.waitForTimeout(25); }
  await page.waitForTimeout(200);
  if (shift) { await page.keyboard.down('Shift'); await page.waitForTimeout(200); }
  await page.mouse.up();
  if (shift || shiftEarly) await page.keyboard.up('Shift');
  await page.waitForTimeout(500);
}
