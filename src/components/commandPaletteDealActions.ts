import type { PermissionAction } from '../services/permissionService';
import type { DealRecordActionName } from './commandPaletteContext';

export type DealActionId =
  | 'change-stage' | 'add-note' | 'add-task' | 'toggle-favorite' | 'toggle-pin' | 'duplicate' | 'merge-duplicates'
  | 'find-duplicates' | 'run-workflow' | 'open-contact' | 'open-company' | 'delete' | 'copy-link';

export interface DealActionDef {
  id: DealActionId;
  label: string;
  keywords: string[];
  /** Permission required to see the action (checked against the deal); null = always. */
  permission: PermissionAction | null;
  /** Dispatched as a `deal-record:action` event instead of being performed by the palette. */
  event?: DealRecordActionName;
  /** Opens a second step (stage list / confirmation) instead of running immediately. */
  step?: 'stage' | 'confirm-delete';
}

/** Order here is the order in the "This deal" group. */
export const DEAL_ACTIONS: DealActionDef[] = [
  { id: 'change-stage', label: 'Change stage…', keywords: ['move', 'pipeline', 'status'], permission: 'edit', step: 'stage' },
  { id: 'add-note', label: 'Add note', keywords: ['comment', 'write'], permission: 'edit', event: 'add-note' },
  { id: 'add-task', label: 'Add task', keywords: ['todo', 'reminder', 'follow up'], permission: 'edit', event: 'add-task' },
  { id: 'toggle-favorite', label: 'Toggle favorite', keywords: ['star', 'favourite', 'unfavorite'], permission: 'edit' },
  { id: 'toggle-pin', label: 'Pin / unpin deal', keywords: ['pinned', 'keep'], permission: null },
  { id: 'duplicate', label: 'Duplicate deal', keywords: ['copy', 'clone'], permission: 'create' },
  { id: 'merge-duplicates', label: 'Merge duplicates', keywords: ['combine', 'dedupe'], permission: 'edit', event: 'merge-duplicates' },
  { id: 'find-duplicates', label: 'Find duplicates', keywords: ['dedupe', 'similar'], permission: 'view', event: 'find-duplicates' },
  { id: 'run-workflow', label: 'Run workflow…', keywords: ['automation', 'automate'], permission: 'edit', event: 'run-workflow' },
  { id: 'open-contact', label: 'Open contact', keywords: ['person', 'people'], permission: 'view' },
  { id: 'open-company', label: 'Open company', keywords: ['account', 'organization'], permission: 'view' },
  { id: 'delete', label: 'Delete deal…', keywords: ['remove', 'trash'], permission: 'delete', step: 'confirm-delete' },
  { id: 'copy-link', label: 'Copy link', keywords: ['url', 'share'], permission: null }
];
