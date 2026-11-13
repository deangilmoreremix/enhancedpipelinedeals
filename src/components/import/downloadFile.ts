/** Trigger a browser download for in-memory text (no-op outside a browser). */
export function downloadTextFile(content: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  // BOM so Excel opens UTF-8 CSV correctly
  const blob = new Blob([mime.startsWith('text/csv') ? '﻿' : '', content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
