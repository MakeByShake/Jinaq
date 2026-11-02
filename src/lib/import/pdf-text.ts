'use client';

/**
 * Extracts text lines from a PDF entirely in the browser (the file never leaves the device).
 * Items on the same visual row are joined left-to-right, rows are ordered top-to-bottom.
 */
export async function pdfToLines(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows: { y: number; items: { x: number; s: string }[] }[] = [];
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      // Items within ~3pt vertically belong to the same row.
      let row = rows.find((r) => Math.abs(r.y - y) < 3);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      lines.push(r.items.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim());
    }
  }
  return lines.filter(Boolean);
}
