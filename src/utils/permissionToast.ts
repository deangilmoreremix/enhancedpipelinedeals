import { isPermissionDenied, permissionMessage } from './rlsError';
import { pushToast } from '../store/dealRecordStore';

/**
 * If `error` is an RLS denial, toast "You don't have permission to <action> this <kind>" and return
 * that message; otherwise return null so the caller can use its generic failure text.
 */
let last = { msg: '', at: 0 };

export function notifyIfPermissionDenied(error: unknown, action: string, kind: string): string | null {
  if (!isPermissionDenied(error)) return null;
  const msg = permissionMessage(action, kind);
  // The store and the calling component can both report the same denial: toast it once
  const now = Date.now();
  if (!(last.msg === msg && now - last.at < 1500)) pushToast('error', msg);
  last = { msg, at: now };
  return msg;
}

/** Toast the permission message for RLS denials, else the supplied generic failure text. */
export function toastFailure(error: unknown, action: string, kind: string, generic: string): void {
  if (!notifyIfPermissionDenied(error, action, kind)) pushToast('error', generic);
}
