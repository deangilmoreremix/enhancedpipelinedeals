import type { CustomFieldValue, DealFieldDefinition } from '../types/customFields';

export const RATING_MAX = 5;

export const isEmptyValue = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()\-.]{5,}$/;

export type ValidateResult = { ok: true; value: CustomFieldValue } | { ok: false; error: string };

/** Normalise + validate an edited value for a definition. Empty clears (null). */
export function validateCustomValue(def: Pick<DealFieldDefinition, 'type' | 'label'> & { options?: string[] }, raw: unknown): ValidateResult {
  if (isEmptyValue(raw)) return { ok: true, value: null };
  switch (def.type) {
    case 'text': return { ok: true, value: String(raw).trim() };
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[,\s]/g, ''));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `${def.label} must be a number` };
    }
    case 'rating': {
      const n = Number(raw);
      return Number.isInteger(n) && n >= 0 && n <= RATING_MAX
        ? { ok: true, value: n === 0 ? null : n }
        : { ok: false, error: `${def.label} must be 0-${RATING_MAX}` };
    }
    case 'select': {
      const s = String(raw);
      return (def.options ?? []).includes(s) ? { ok: true, value: s } : { ok: false, error: `${def.label}: unknown option` };
    }
    case 'multi_select': {
      const arr = (Array.isArray(raw) ? raw : [raw]).map(String);
      return arr.every(o => (def.options ?? []).includes(o)) ? { ok: true, value: [...new Set(arr)] } : { ok: false, error: `${def.label}: unknown option` };
    }
    case 'email': {
      const s = String(raw).trim();
      return EMAIL_RE.test(s) ? { ok: true, value: s } : { ok: false, error: 'Enter a valid email address' };
    }
    case 'phone': {
      const s = String(raw).trim();
      return PHONE_RE.test(s) ? { ok: true, value: s } : { ok: false, error: 'Enter a valid phone number' };
    }
    case 'link': {
      const s = String(raw).trim();
      const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
      try {
        const u = new URL(withProto);
        if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('bad');
        return { ok: true, value: withProto };
      } catch { return { ok: false, error: 'Enter a valid URL' }; }
    }
    case 'date': {
      const s = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw);
      return /^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(new Date(s).getTime()) ? { ok: true, value: s.slice(0, 10) } : { ok: false, error: 'Enter a valid date' };
    }
    case 'formula': case 'rollup': return { ok: false, error: `${def.label} is calculated and cannot be edited` };
    default: return { ok: true, value: raw as CustomFieldValue };
  }
}

