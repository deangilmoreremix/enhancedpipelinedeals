export const env = new Proxy({} as Record<string, string | undefined>, {
  get(_target, prop) {
    const key = String(prop);
    const viteVal = typeof import.meta !== 'undefined' ? import.meta.env?.[key] : undefined;
    if (typeof process !== 'undefined' && process.env && key in process.env) {
      const direct = (process.env as Record<string, string | undefined>)[key];
      if (direct !== undefined) return direct;
    }
    if (viteVal !== undefined) return viteVal;
    return undefined;
  },
  has(_target, prop) {
    const key = String(prop);
    if (typeof process !== 'undefined' && process.env && key in (process.env as Record<string, string | undefined>)) return true;
    if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) return true;
    return false;
  },
});

export const nodeEnv = (typeof process !== 'undefined' && (process as any).env?.NODE_ENV) || import.meta?.env?.MODE || 'development';
