// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.

function escapePdfText(input: string): string {
  return (input || '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text: string, maxChars = 84): string[] {
  const clean = (text || '').trim();
  if (!clean) return [''];
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (w.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let i = 0; i < w.length; i += maxChars) {
        lines.push(w.slice(i, i + maxChars));
      }
      continue;
    }
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

export interface PdfBrandingOptions {
  firmName?: string;
  logoUrl?: string;
  accentColor?: string;
}

function hexToPdfRgb(hex?: string, fallback = '0.83 0.69 0.22'): string {
  const clean = String(hex || '').trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  const r = (parseInt(clean.slice(0, 2), 16) / 255).toFixed(2);
  const g = (parseInt(clean.slice(2, 4), 16) / 255).toFixed(2);
  const b = (parseInt(clean.slice(4, 6), 16) / 255).toFixed(2);
  return `${r} ${g} ${b}`;
}

export interface PdfBuildOptions {
  title: string;
  subtitle?: string;
  lines: string[];
  watermark: string;
  footer: string;
  isWatermarked?: boolean;
  branding?: PdfBrandingOptions | null;
}

export interface InstitutionalPdfKpi {
  label: string;
  value: string;
}

export interface InstitutionalPdfKeyValue {
  label: string;
  value: string;
  note?: string;
}

export interface InstitutionalPdfBarItem {
  label: string;
  value: number; // relative or percentage
  displayValue: string;
}

export interface InstitutionalPdfTable {
  headers: string[];
  rows: string[][];
}

export interface InstitutionalPdfSection {
  heading: string;
  subtitle?: string;
  callout?: {
    tone?: 'gold' | 'warning';
    text: string;
  };
  paragraphs?: string[];
  keyValues?: InstitutionalPdfKeyValue[];
  table?: InstitutionalPdfTable;
  bars?: {
    title?: string;
    items: InstitutionalPdfBarItem[];
  };
}

export interface InstitutionalPdfOptions {
  docTitle: string;
  docSubtitle: string;
  watermark: string;
  footer: string;
  virtualBanner?: string | null;
  isWatermarked?: boolean;
  branding?: PdfBrandingOptions | null;
  cover: {
    eyebrow: string;
    title: string;
    subtitle: string;
    preparedFor: string;
    dateStr: string;
    highlights: InstitutionalPdfKpi[];
    contactLines?: string[];
  };
  sections: InstitutionalPdfSection[];
}

function finalizePdfFromPageStreams(pageStreams: string[]): Uint8Array {
  const objects: string[] = [];
  const pageObjNums: number[] = [];
  let nextObjNum = 5;

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

/**
 * Generates a valid multi-page PDF 1.4 binary using built-in Helvetica / Helvetica-Bold fonts.
 * Backwards-compatible line-based builder.
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

  const accentRgb = hexToPdfRgb(opts.branding?.accentColor, '0.83 0.69 0.22');
  const pageStreams: string[] = pages.map((pageLines, pageIdx) => {
    const ops: string[] = [];
    ops.push('0.06 0.06 0.09 rg');
    ops.push('36 728 540 50 re f');
    ops.push(`${accentRgb} rg`);
    ops.push('36 726 540 2 re f');

    ops.push('BT');
    ops.push('/F2 13 Tf');
    ops.push(`${accentRgb} rg`);
    ops.push(`48 756 Td (${escapePdfText(opts.title)}) Tj`);
    ops.push('ET');

    if (opts.subtitle) {
      ops.push('BT');
      ops.push('/F1 9 Tf');
      ops.push('0.85 0.85 0.88 rg');
      ops.push(`48 740 Td (${escapePdfText(opts.subtitle)}) Tj`);
      ops.push('ET');
    }

    if (opts.isWatermarked) {
      ops.push('0.96 0.90 0.86 rg');
      ops.push('36 706 540 16 re f');
      ops.push('BT');
      ops.push('/F2 8.5 Tf');
      ops.push('0.68 0.22 0.14 rg');
      ops.push(`44 711 Td (${escapePdfText('FREE TIER WATERMARK - AQARI TERMINAL SAMPLE - UPGRADE TO REMOVE WATERMARK')}) Tj`);
      ops.push('ET');
    } else {
      ops.push('BT');
      ops.push('/F1 8 Tf');
      ops.push('0.55 0.45 0.15 rg');
      ops.push(`36 710 Td (${escapePdfText(opts.watermark)}) Tj`);
      ops.push('ET');
    }

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

  return finalizePdfFromPageStreams(pageStreams);
}

/**
 * Institutional Black & Gold Multi-Page PDF Builder
 * Renders an executive black-and-gold cover page followed by uncrowded, well-spaced sections,
 * KPI grids, tables, and embedded vector bar charts.
 */
export function buildInstitutionalPdfDocument(opts: InstitutionalPdfOptions): Uint8Array {
  const pagesOps: string[][] = [];
  const accentRgb = hexToPdfRgb(opts.branding?.accentColor, '0.83 0.69 0.22');
  const firmName = String(opts.branding?.firmName || '').trim();

  // ---- COVER PAGE (Page 1 - Black & Gold / White-Label Theme) ----
  const coverOps: string[] = [];
  // Deep Obsidian Background
  coverOps.push('0.05 0.05 0.07 rg');
  coverOps.push('0 0 612 792 re f');
  // Subtle Top & Left Accent Frame
  coverOps.push(`${accentRgb} rg`);
  coverOps.push('42 742 528 3 re f');
  coverOps.push('42 56 528 1.5 re f');
  coverOps.push('42 680 4 64 re f');

  if (opts.isWatermarked) {
    coverOps.push('0.36 0.10 0.08 rg');
    coverOps.push('42 752 528 22 re f');
    coverOps.push('BT');
    coverOps.push('/F2 8.5 Tf');
    coverOps.push('0.98 0.82 0.78 rg');
    coverOps.push(`56 760 Td (${escapePdfText('FREE TIER WATERMARK - AQARI TERMINAL SAMPLE - UPGRADE FOR CLEAN CLIENT PDF')}) Tj`);
    coverOps.push('ET');
  }

  // Brand Eyebrow
  coverOps.push('BT');
  coverOps.push('/F2 9.5 Tf');
  coverOps.push(`${accentRgb} rg`);
  coverOps.push(`56 716 Td (${escapePdfText((firmName ? `${firmName} | ${opts.cover.eyebrow}` : opts.cover.eyebrow).toUpperCase())}) Tj`);
  coverOps.push('ET');

  // Main Cover Title (wrapped cleanly)
  const titleLines = wrapLine(opts.cover.title, 34).slice(0, 3);
  let cy = 668;
  for (const tl of titleLines) {
    coverOps.push('BT');
    coverOps.push('/F2 22 Tf');
    coverOps.push('0.98 0.98 0.99 rg');
    coverOps.push(`56 ${cy} Td (${escapePdfText(tl)}) Tj`);
    coverOps.push('ET');
    cy -= 28;
  }

  // Subtitle
  const subLines = wrapLine(opts.cover.subtitle, 66).slice(0, 3);
  cy -= 8;
  for (const sl of subLines) {
    coverOps.push('BT');
    coverOps.push('/F1 11.5 Tf');
    coverOps.push('0.72 0.72 0.78 rg');
    coverOps.push(`56 ${cy} Td (${escapePdfText(sl)}) Tj`);
    coverOps.push('ET');
    cy -= 16;
  }

  // Optional Virtual Concept Prominent Warning Banner
  if (opts.virtualBanner) {
    cy -= 14;
    coverOps.push('0.32 0.19 0.04 rg');
    coverOps.push(`56 ${cy - 22} 500 32 re f`);
    coverOps.push('0.94 0.65 0.14 RG');
    coverOps.push('1.2 w');
    coverOps.push(`56 ${cy - 22} 500 32 re S`);
    coverOps.push('BT');
    coverOps.push('/F2 10.5 Tf');
    coverOps.push('0.99 0.84 0.42 rg');
    coverOps.push(`68 ${cy - 10} Td (${escapePdfText(opts.virtualBanner)}) Tj`);
    coverOps.push('ET');
    cy -= 44;
  } else {
    cy -= 24;
  }

  // Horizontal accent divider
  coverOps.push(`${accentRgb} rg`);
  coverOps.push(`56 ${cy} 120 2 re f`);
  cy -= 30;

  // Highlight KPI Cards (up to 4 cards in 2x2 grid)
  const highlights = (opts.cover.highlights || []).slice(0, 4);
  const cardW = 242;
  const cardH = 66;
  highlights.forEach((kpi, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const kx = 56 + col * (cardW + 16);
    const ky = cy - row * (cardH + 14) - cardH;
    coverOps.push('0.09 0.09 0.12 rg');
    coverOps.push(`${kx} ${ky} ${cardW} ${cardH} re f`);
    coverOps.push('0.35 0.29 0.10 RG');
    coverOps.push('0.8 w');
    coverOps.push(`${kx} ${ky} ${cardW} ${cardH} re S`);

    coverOps.push('BT');
    coverOps.push('/F1 8.5 Tf');
    coverOps.push('0.65 0.66 0.72 rg');
    coverOps.push(`${kx + 14} ${ky + 44} Td (${escapePdfText(kpi.label.toUpperCase())}) Tj`);
    coverOps.push('ET');

    coverOps.push('BT');
    coverOps.push('/F2 15 Tf');
    coverOps.push('0.89 0.75 0.30 rg');
    coverOps.push(`${kx + 14} ${ky + 18} Td (${escapePdfText(kpi.value)}) Tj`);
    coverOps.push('ET');
  });

  // Prepared For + Date + Contact at Bottom of Cover
  let metaY = 178;
  coverOps.push('0.11 0.11 0.15 rg');
  coverOps.push('56 80 500 112 re f');
  coverOps.push('0.28 0.28 0.34 RG');
  coverOps.push('0.6 w');
  coverOps.push('56 80 500 112 re S');

  const metaLines = [
    `PREPARED FOR: ${opts.cover.preparedFor}`,
    `ISSUE DATE: ${opts.cover.dateStr}`,
    ...(opts.cover.contactLines || []).slice(0, 3),
  ];
  for (const ml of metaLines) {
    coverOps.push('BT');
    coverOps.push('/F1 9.5 Tf');
    coverOps.push('0.84 0.85 0.90 rg');
    coverOps.push(`70 ${metaY} Td (${escapePdfText(ml)}) Tj`);
    coverOps.push('ET');
    metaY -= 17;
  }

  pagesOps.push(coverOps);

  // ---- INTERIOR PAGES (Light Editorial Paper with Black & Gold Header/Accents) ----
  let currentOps: string[] = [];
  let y = 690;

  const startInteriorPage = () => {
    currentOps = [];
    // Dark obsidian header bar
    currentOps.push('0.06 0.06 0.09 rg');
    currentOps.push('36 732 540 42 re f');
    currentOps.push(`${accentRgb} rg`);
    currentOps.push('36 730 540 2 re f');

    currentOps.push('BT');
    currentOps.push('/F2 11 Tf');
    currentOps.push(`${accentRgb} rg`);
    currentOps.push(`46 756 Td (${escapePdfText(opts.docTitle)}) Tj`);
    currentOps.push('ET');

    currentOps.push('BT');
    currentOps.push('/F1 8.5 Tf');
    currentOps.push('0.82 0.82 0.86 rg');
    currentOps.push(`46 741 Td (${escapePdfText(opts.docSubtitle)}) Tj`);
    currentOps.push('ET');

    if (opts.isWatermarked) {
      currentOps.push('0.98 0.90 0.88 rg');
      currentOps.push('36 708 540 16 re f');
      currentOps.push('BT');
      currentOps.push('/F2 8 Tf');
      currentOps.push('0.68 0.20 0.14 rg');
      currentOps.push(`44 713 Td (${escapePdfText('FREE TIER WATERMARK - AQARI TERMINAL SAMPLE - UPGRADE TO REMOVE')}) Tj`);
      currentOps.push('ET');
      y = 688;
    } else if (opts.virtualBanner) {
      currentOps.push('0.98 0.93 0.82 rg');
      currentOps.push('36 708 540 16 re f');
      currentOps.push('BT');
      currentOps.push('/F2 8 Tf');
      currentOps.push('0.62 0.36 0.04 rg');
      currentOps.push(`44 713 Td (${escapePdfText(opts.virtualBanner)}) Tj`);
      currentOps.push('ET');
      y = 688;
    } else {
      currentOps.push('BT');
      currentOps.push('/F1 7.5 Tf');
      currentOps.push('0.50 0.44 0.22 rg');
      currentOps.push(`36 715 Td (${escapePdfText(opts.watermark)}) Tj`);
      currentOps.push('ET');
      y = 694;
    }
  };

  const flushInteriorPage = () => {
    if (currentOps.length > 0) {
      pagesOps.push(currentOps);
    }
    startInteriorPage();
  };

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < 68) {
      flushInteriorPage();
    }
  };

  startInteriorPage();

  for (const sec of opts.sections) {
    // Section Header Block
    ensureSpace(56);
    y -= 6;
    currentOps.push('0.08 0.08 0.11 rg');
    currentOps.push(`36 ${y - 4} 4 18 re f`);
    currentOps.push(`${accentRgb} rg`);
    currentOps.push(`40 ${y - 6} 536 1 re f`);

    currentOps.push('BT');
    currentOps.push('/F2 12 Tf');
    currentOps.push('0.08 0.08 0.12 rg');
    currentOps.push(`46 ${y} Td (${escapePdfText(sec.heading)}) Tj`);
    currentOps.push('ET');
    y -= 18;

    if (sec.subtitle) {
      currentOps.push('BT');
      currentOps.push('/F1 8.5 Tf');
      currentOps.push('0.42 0.43 0.48 rg');
      currentOps.push(`46 ${y} Td (${escapePdfText(sec.subtitle)}) Tj`);
      currentOps.push('ET');
      y -= 14;
    } else {
      y -= 4;
    }

    // Optional Callout
    if (sec.callout && sec.callout.text) {
      const cLines = wrapLine(sec.callout.text, 82);
      const boxH = 16 + cLines.length * 13;
      ensureSpace(boxH + 10);
      const isWarn = sec.callout.tone === 'warning';
      currentOps.push(isWarn ? '0.99 0.95 0.88 rg' : '0.96 0.96 0.98 rg');
      currentOps.push(`40 ${y - boxH + 10} 532 ${boxH} re f`);
      currentOps.push(isWarn ? '0.85 0.52 0.10 RG' : '0.83 0.69 0.22 RG');
      currentOps.push('0.8 w');
      currentOps.push(`40 ${y - boxH + 10} 532 ${boxH} re S`);
      let cyBox = y - 4;
      for (const cl of cLines) {
        currentOps.push('BT');
        currentOps.push('/F2 8.5 Tf');
        currentOps.push(isWarn ? '0.55 0.30 0.04 rg' : '0.16 0.16 0.20 rg');
        currentOps.push(`50 ${cyBox} Td (${escapePdfText(cl)}) Tj`);
        currentOps.push('ET');
        cyBox -= 13;
      }
      y -= boxH + 8;
    }

    // Optional Paragraphs
    if (sec.paragraphs && sec.paragraphs.length > 0) {
      for (const p of sec.paragraphs) {
        const pLines = wrapLine(p, 88);
        for (const pl of pLines) {
          ensureSpace(16);
          currentOps.push('BT');
          currentOps.push('/F1 9.5 Tf');
          currentOps.push('0.18 0.19 0.23 rg');
          currentOps.push(`42 ${y} Td (${escapePdfText(pl)}) Tj`);
          currentOps.push('ET');
          y -= 14;
        }
        y -= 4;
      }
    }

    // Optional Key-Value Grid (2 columns, generous private-bank ivory cards)
    if (sec.keyValues && sec.keyValues.length > 0) {
      const colW = 260;
      const rowH = 34;
      for (let i = 0; i < sec.keyValues.length; i += 2) {
        ensureSpace(rowH + 6);
        for (let col = 0; col < 2; col++) {
          const item = sec.keyValues[i + col];
          if (!item) continue;
          const bx = 40 + col * (colW + 12);
          const by = y - rowH + 10;
          const isNoiOrHighlight =
            item.label.toLowerCase().includes('noi') ||
            item.label.toLowerCase().includes('effective gross');
          currentOps.push('0.985 0.980 0.965 rg');
          currentOps.push(`${bx} ${by} ${colW} ${rowH - 4} re f`);
          currentOps.push(isNoiOrHighlight ? '0.68 0.56 0.22 RG' : '0.86 0.84 0.78 RG');
          currentOps.push('0.5 w');
          currentOps.push(`${bx} ${by} ${colW} ${rowH - 4} re S`);

          currentOps.push('BT');
          currentOps.push('/F1 7.5 Tf');
          currentOps.push('0.42 0.41 0.39 rg');
          currentOps.push(`${bx + 8} ${by + 18} Td (${escapePdfText(item.label.slice(0, 42))}) Tj`);
          currentOps.push('ET');

          currentOps.push('BT');
          currentOps.push('/F2 9.5 Tf');
          currentOps.push(isNoiOrHighlight ? '0.08 0.42 0.26 rg' : '0.08 0.08 0.12 rg');
          currentOps.push(`${bx + 8} ${by + 6} Td (${escapePdfText(item.value.slice(0, 42))}) Tj`);
          currentOps.push('ET');
        }
        y -= rowH;
      }
      y -= 6;
    }

    // Optional Embedded Vector Bar Chart
    if (sec.bars && sec.bars.items.length > 0) {
      const barItems = sec.bars.items;
      const maxVal = Math.max(
        1,
        ...barItems.map((b) => (Number.isFinite(b.value) ? Math.abs(b.value) : 0))
      );
      const blockH = 22 + barItems.length * 22;
      ensureSpace(blockH + 10);
      if (sec.bars.title) {
        currentOps.push('BT');
        currentOps.push('/F2 9 Tf');
        currentOps.push('0.20 0.20 0.25 rg');
        currentOps.push(`42 ${y} Td (${escapePdfText(sec.bars.title)}) Tj`);
        currentOps.push('ET');
        y -= 16;
      }
      for (const bar of barItems) {
        ensureSpace(22);
        const ratio = Math.max(0.03, Math.min(1, Math.abs(bar.value) / maxVal));
        const trackX = 200;
        const trackW = 265;
        currentOps.push('BT');
        currentOps.push('/F1 8.5 Tf');
        currentOps.push('0.22 0.22 0.26 rg');
        currentOps.push(`42 ${y} Td (${escapePdfText(bar.label.slice(0, 30))}) Tj`);
        currentOps.push('ET');

        currentOps.push('0.93 0.93 0.95 rg');
        currentOps.push(`${trackX} ${y - 2} ${trackW} 10 re f`);
        currentOps.push(bar.value >= 0 ? '0.78 0.62 0.16 rg' : '0.76 0.22 0.25 rg');
        currentOps.push(`${trackX} ${y - 2} ${Math.round(trackW * ratio)} 10 re f`);

        currentOps.push('BT');
        currentOps.push('/F2 8.5 Tf');
        currentOps.push('0.10 0.10 0.14 rg');
        currentOps.push(`${trackX + trackW + 10} ${y} Td (${escapePdfText(bar.displayValue)}) Tj`);
        currentOps.push('ET');
        y -= 20;
      }
      y -= 8;
    }

    // Optional Table
    if (sec.table && sec.table.headers.length > 0) {
      const colCount = sec.table.headers.length;
      const tableW = 532;
      const colW = Math.floor(tableW / colCount);
      const maxCellChars = Math.max(10, Math.floor((colW - 10) / 4.8));

      const drawTableHeader = () => {
        ensureSpace(38);
        currentOps.push('0.10 0.10 0.14 rg');
        currentOps.push(`40 ${y - 14} ${tableW} 18 re f`);
        sec.table!.headers.forEach((h, cIdx) => {
          currentOps.push('BT');
          currentOps.push('/F2 8 Tf');
          currentOps.push('0.88 0.75 0.30 rg');
          currentOps.push(
            `${45 + cIdx * colW} ${y - 8} Td (${escapePdfText(String(h).slice(0, maxCellChars))}) Tj`
          );
          currentOps.push('ET');
        });
        y -= 20;
      };

      drawTableHeader();
      sec.table.rows.forEach((row, rIdx) => {
        if (y - 20 < 68) {
          flushInteriorPage();
          drawTableHeader();
        }
        if (rIdx % 2 === 1) {
          currentOps.push('0.96 0.96 0.97 rg');
          currentOps.push(`40 ${y - 11} ${tableW} 16 re f`);
        }
        row.slice(0, colCount).forEach((cell, cIdx) => {
          currentOps.push('BT');
          currentOps.push(cIdx === 0 ? '/F2 8 Tf' : '/F1 8 Tf');
          currentOps.push('0.18 0.18 0.22 rg');
          currentOps.push(
            `${45 + cIdx * colW} ${y - 6} Td (${escapePdfText(String(cell ?? '').slice(0, maxCellChars))}) Tj`
          );
          currentOps.push('ET');
        });
        y -= 17;
      });
      y -= 10;
    }

    y -= 8;
  }

  pagesOps.push(currentOps);

  const totalPages = pagesOps.length;
  const finalStreams = pagesOps.map((ops, idx) => {
    const isCover = idx === 0;
    const footerColor = isCover ? '0.62 0.63 0.70 rg' : '0.38 0.39 0.44 rg';
    const lineColor = isCover ? '0.28 0.25 0.14 RG' : '0.84 0.84 0.88 RG';
    const footerOps = [
      ...ops,
      lineColor,
      '0.5 w',
      '36 44 m 576 44 l S',
      'BT',
      '/F1 8 Tf',
      footerColor,
      `36 30 Td (${escapePdfText(`${opts.footer} | Page ${idx + 1} of ${totalPages}`)}) Tj`,
      'ET',
    ];
    return footerOps.join('\n');
  });

  return finalizePdfFromPageStreams(finalStreams);
}
