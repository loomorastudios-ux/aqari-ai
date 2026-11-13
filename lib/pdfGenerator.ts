// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.

function escapePdfText(input: string): string {
  return (input || '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text: string, maxChars = 88): string[] {
  const clean = (text || '').trim();
  if (!clean) return [''];
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface PdfBuildOptions {
  title: string;
  subtitle?: string;
  lines: string[];
  watermark: string;
  footer: string;
}

/**
 * Generates a valid multi-page PDF 1.4 binary using built-in Helvetica / Helvetica-Bold fonts.
 * Works identically in Node.js serverless handlers and browser environments with zero native deps.
 */
export function buildPdfDocument(opts: PdfBuildOptions): Uint8Array {
  const wrappedLines: string[] = [];
  for (const rawLine of opts.lines) {
    for (const seg of String(rawLine).split('\n')) {
      wrappedLines.push(...wrapLine(seg, 86));
    }
  }

  const linesPerPage = 44;
  const pages: string[][] = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) {
    pages.push(['']);
  }

  const objects: string[] = [];
  // 1 = Catalog, 2 = Pages, 3 = Font Helvetica, 4 = Font Helvetica-Bold
  const pageObjNums: number[] = [];
  let nextObjNum = 5;

  const pageStreams: string[] = pages.map((pageLines, pageIdx) => {
    const ops: string[] = [];
    // Dark slate top header bar
    ops.push('0.08 0.08 0.11 rg');
    ops.push('36 728 540 50 re f');
    // Gold rule under header
    ops.push('0.83 0.69 0.22 rg');
    ops.push('36 726 540 2 re f');

    // Header Title in white / gold
    ops.push('BT');
    ops.push('/F2 13 Tf');
    ops.push('0.83 0.69 0.22 rg');
    ops.push(`48 756 Td (${escapePdfText(opts.title)}) Tj`);
    ops.push('ET');

    if (opts.subtitle) {
      ops.push('BT');
      ops.push('/F1 9 Tf');
      ops.push('0.85 0.85 0.88 rg');
      ops.push(`48 740 Td (${escapePdfText(opts.subtitle)}) Tj`);
      ops.push('ET');
    }

    // Watermark strip
    ops.push('BT');
    ops.push('/F1 8 Tf');
    ops.push('0.55 0.45 0.15 rg');
    ops.push(`36 710 Td (${escapePdfText(opts.watermark)}) Tj`);
    ops.push('ET');

    // Body text lines
    let y = 688;
    for (const line of pageLines) {
      const isHeading =
        line.startsWith('===') ||
        line.endsWith(':') ||
        line.startsWith('SECTION') ||
        line.startsWith('REFUND POLICY');
      ops.push('BT');
      ops.push(isHeading ? '/F2 10 Tf' : '/F1 9.5 Tf');
      ops.push(isHeading ? '0.08 0.08 0.12 rg' : '0.18 0.18 0.22 rg');
      ops.push(`40 ${y} Td (${escapePdfText(line)}) Tj`);
      ops.push('ET');
      y -= 14;
    }

    // Footer separator & text
    ops.push('0.82 0.82 0.85 RG');
    ops.push('36 44 m 576 44 l S');
    ops.push('BT');
    ops.push('/F1 8 Tf');
    ops.push('0.35 0.35 0.40 rg');
    ops.push(
      `36 30 Td (${escapePdfText(`${opts.footer} | Page ${pageIdx + 1} of ${pages.length}`)}) Tj`
    );
    ops.push('ET');

    return ops.join('\n');
  });

  // Assign object numbers for each page + content stream
  for (let i = 0; i < pageStreams.length; i++) {
    const pageNum = nextObjNum++;
    const contentNum = nextObjNum++;
    pageObjNums.push(pageNum);
    objects[pageNum] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`;
    const stream = pageStreams[i];
    objects[contentNum] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 1; i < nextObjNum; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${nextObjNum}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < nextObjNum; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${nextObjNum} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}
