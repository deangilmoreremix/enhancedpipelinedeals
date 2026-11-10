import { Deal } from '../../types';

export type BoardExportFormat = 'csv' | 'xlsx' | 'json';

const MIME: Record<BoardExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

/** Export deals through exportService and trigger a browser download. Returns the filename. */
export async function downloadDeals(deals: Deal[], format: BoardExportFormat): Promise<string> {
  // Loaded on demand: exceljs/jspdf are heavy
  const { exportService } = await import('../../services/exportService');
  const content = await exportService.exportDeals(deals, { format, includeMetadata: true });
  const filename = `deals-${new Date().toISOString().slice(0, 10)}.${format}`;
  if (format === 'xlsx') {
    // exportService returns the workbook base64-encoded
    const bin = atob(content);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: MIME.xlsx });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    exportService.downloadFile(content, filename, MIME[format]);
  }
  return filename;
}
