import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { DragDropContext } from '@hello-pangea/dnd';

let allowCreate = true;
jest.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ allowed: (a: string) => (a === 'create' ? allowCreate : true), can: () => ({ allowed: true }), canAll: () => ({ allowed: true }) }),
}));
jest.mock('../../components/pipeline/kanban/KanbanColumnHeader', () => ({ KanbanColumnHeader: () => <div /> }));
jest.mock('../../components/pipeline/kanban/WIPLimitIndicator', () => ({ WIPLimitIndicator: () => <div /> }));

import { BoardColumn } from '../../components/pipeline/BoardColumn';

const renderCol = () => render(
  <DragDropContext onDragEnd={() => {}}>
    <BoardColumn columnKey="proposal" title="Proposal" deals={[]} totalInStage={0} renderLimit={25} onShowMore={() => {}} isLoading={false}
      quickCreateOpen={false} onQuickCreateOpenChange={() => {}} onQuickCreate={async () => {}} renderCard={() => null} />
  </DragDropContext>
);

/** Regression (e2e G): viewers (workspace RLS mode) still saw the per-column "Add Deal" button. */
describe('BoardColumn add-deal permission', () => {
  it('shows Add Deal when creating is allowed', () => { allowCreate = true; renderCol(); expect(screen.getByRole('button', { name: /add deal/i })).toBeTruthy(); });
  it('hides Add Deal for users who cannot create deals', () => { allowCreate = false; renderCol(); expect(screen.queryByRole('button', { name: /add deal/i })).toBeNull(); });
});
