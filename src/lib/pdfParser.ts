import * as pdfjsLib from 'pdfjs-dist';
// Bundle the worker locally — avoids loading untrusted code from a CDN
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const MAX_FILE_SIZE_MB = 50;
const MAX_PAGES = 200;

/** Validate the file is actually a PDF by checking its magic bytes (%PDF-). */
async function assertIsPDF(file: File): Promise<void> {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
  }
  const header = await file.slice(0, 5).arrayBuffer();
  const magic = new Uint8Array(header);
  const isPDF = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 &&
                magic[3] === 0x46 && magic[4] === 0x2D; // %PDF-
  if (!isPDF) {
    throw new Error('Invalid file: not a PDF (bad magic bytes).');
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawItem {
  str: string;
  transform: number[]; // [a, b, c, d, x, y]
  fontName: string;
  width: number;       // real advance width in page coords
  hasEOL: boolean;
}

interface FontMeta {
  bold: boolean;
  italic: boolean;
}

interface Item {
  str: string;
  x: number;
  y: number;
  right: number;    // x + actual width
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

interface Line {
  y: number;
  fontSize: number;
  hasBold: boolean;
  align: 'left' | 'center';
  isSectionHeader: boolean; // ALL CAPS short standalone line
  left: Item[];
  right: Item[];  // items in the right column (dates etc.)
}

// ─── Font metadata ────────────────────────────────────────────────────────────

/**
 * Primary: try PDF.js internal font objects which have .bold/.italic set from
 * the PDF FontDescriptor (FontWeight, ItalicAngle, Flags). These are loaded
 * into page.commonObjs after getTextContent() runs.
 * Fallback: keyword search in fontName / fontFamily strings.
 */
function buildFontMeta(
  fontNames: string[],
  styles: Record<string, { fontFamily?: string }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pageCommonObjs: any,
): Map<string, FontMeta> {
  const map = new Map<string, FontMeta>();

  for (const name of fontNames) {
    let bold = false;
    let italic = false;

    // ── Level 1: internal font object ─────────────────────────────────────────
    try {
      const font = pageCommonObjs?.get?.(name);
      if (font && typeof font === 'object') {
        if (typeof font.bold === 'boolean') bold = font.bold;
        if (typeof font.italic === 'boolean') italic = font.italic;
        // Also check the resolved name from the font object
        const resolvedName: string = (font.name ?? font.loadedName ?? '').toLowerCase();
        if (!bold) bold = nameContains(resolvedName, ['bold', 'heavy', 'black', 'demi']);
        if (!italic) italic = nameContains(resolvedName, ['italic', 'oblique', 'slant']);
      }
    } catch {
      // commonObjs access may fail for some font types
    }

    // ── Level 2: font name / family strings ───────────────────────────────────
    const rawName = name.toLowerCase();
    const bare = rawName.includes('+') ? rawName.split('+').slice(1).join('+') : rawName;
    const family = (styles[name]?.fontFamily ?? '').toLowerCase();

    if (!bold) bold = nameContains(bare, ['bold', 'heavy', 'black', 'demi']) ||
                       nameContains(family, ['bold', 'heavy', 'black', 'demi']);
    if (!italic) italic = nameContains(bare, ['italic', 'oblique', 'slant']) ||
                          nameContains(family, ['italic', 'oblique', 'slant']);

    map.set(name, { bold, italic });
  }

  return map;
}

function nameContains(s: string, keywords: string[]): boolean {
  return keywords.some(k => s.includes(k));
}

// ─── Line grouping ─────────────────────────────────────────────────────────────

function groupLines(items: Item[]): Item[][] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y); // top-to-bottom
  const groups: Item[][] = [];
  let cur: Item[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const tol = Math.max(2, cur[0].fontSize * 0.45);
    if (Math.abs(item.y - cur[0].y) <= tol) {
      cur.push(item);
    } else {
      groups.push(cur);
      cur = [item];
    }
  }
  groups.push(cur);
  return groups;
}

// ─── Column split ──────────────────────────────────────────────────────────────

/**
 * Splits items on one line into left/right columns based on the largest gap.
 * Threshold: gap must be > 5% of page width AND right column must start
 * in the rightmost 50% of the page.
 */
function splitAtGap(items: Item[], pageWidth: number): [Item[], Item[]] {
  if (items.length < 2) return [items, []];

  let maxGap = 0;
  let splitIdx = -1;

  for (let i = 1; i < items.length; i++) {
    const gap = items[i].x - items[i - 1].right;
    if (gap > maxGap) {
      maxGap = gap;
      splitIdx = i;
    }
  }

  const threshold = pageWidth * 0.05; // 5% of page width
  const rightStart = splitIdx >= 0 ? items[splitIdx].x : 0;

  if (maxGap < threshold || rightStart < pageWidth * 0.45) {
    return [items, []];
  }

  return [items.slice(0, splitIdx), items.slice(splitIdx)];
}

// ─── Alignment ────────────────────────────────────────────────────────────────

function detectAlign(items: Item[], pageWidth: number): 'left' | 'center' {
  if (items.length === 0) return 'left';
  const leftEdge = Math.min(...items.map(i => i.x));
  const rightEdge = Math.max(...items.map(i => i.right));
  const mid = (leftEdge + rightEdge) / 2;
  return Math.abs(mid - pageWidth / 2) < pageWidth * 0.07 ? 'center' : 'left';
}

// ─── HTML rendering ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render items to HTML, applying per-item bold/italic and inserting spaces
 * where there is a visible gap between adjacent items.
 */
function renderItems(items: Item[]): string {
  const parts: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (i > 0) {
      const prev = items[i - 1];
      const gap = item.x - prev.right;
      // Insert a space if there is a gap wider than ~¼ of a character
      if (gap > prev.fontSize * 0.25 && !item.str.startsWith(' ') && !prev.str.endsWith(' ')) {
        parts.push(' ');
      }
    }

    let text = esc(item.str);
    if (item.italic) text = `<em>${text}</em>`;
    if (item.bold) text = `<strong>${text}</strong>`;
    parts.push(text);
  }

  return parts.join('');
}

function plainText(items: Item[]): string {
  return items.map(i => i.str).join('').trim();
}

function getBodySize(lines: Line[]): number {
  const sizes = lines.map(l => l.fontSize).filter(s => s > 0);
  if (sizes.length === 0) return 10;
  const sorted = [...sizes].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function buildLineHtml(line: Line, bodySize: number): string {
  const leftHtml = renderItems(line.left);
  const rightHtml = line.right.length ? renderItems(line.right) : '';
  const leftText = plainText(line.left);

  if (!leftText && !plainText(line.right)) return '<p></p>';

  const ratio = line.fontSize / bodySize;
  const centerAttr = line.align === 'center' ? ' style="text-align:center;"' : '';

  // ── Heading level ──────────────────────────────────────────────────────────
  let tag: 'h1' | 'h2' | 'h3' | 'p';
  if (ratio >= 1.65) {
    tag = 'h1';
  } else if (ratio >= 1.25) {
    tag = 'h2';
  } else if (line.isSectionHeader) {
    tag = 'h3';
  } else {
    tag = 'p';
  }

  // ── Compose HTML ───────────────────────────────────────────────────────────
  if (rightHtml) {
    // Two-column line: left text + right-aligned date/location
    const flexStyle = 'display:flex;justify-content:space-between;align-items:baseline;gap:2rem;';
    if (tag !== 'p') {
      return `<${tag} style="${flexStyle}">${leftHtml}<span style="white-space:nowrap;font-weight:normal;font-size:0.9em;">${rightHtml}</span></${tag}>`;
    }
    return `<p style="${flexStyle}">${leftHtml}<span style="white-space:nowrap;">${rightHtml}</span></p>`;
  }

  if (tag !== 'p') {
    return `<${tag}${centerAttr}>${leftHtml}</${tag}>`;
  }

  return `<p${centerAttr}>${leftHtml}</p>`;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function parsePDF(file: File): Promise<string> {
  await assertIsPDF(file);

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const htmlParts: string[] = [];
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;

    // ── Extract text content ────────────────────────────────────────────────
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const styles = (content as any).styles as Record<string, { fontFamily?: string }> ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commonObjs = (page as any).commonObjs;

    const rawItems = (content.items as unknown[]).filter(
      (it): it is RawItem =>
        typeof it === 'object' && it !== null &&
        'str' in it && typeof (it as RawItem).str === 'string' &&
        (it as RawItem).str.trim() !== ''
    );

    // ── Build font metadata ─────────────────────────────────────────────────
    const fontNames = [...new Set(rawItems.map(it => it.fontName))];
    const fontMeta = buildFontMeta(fontNames, styles, commonObjs);

    // ── Enrich items ────────────────────────────────────────────────────────
    const items: Item[] = rawItems.map(it => {
      const meta = fontMeta.get(it.fontName) ?? { bold: false, italic: false };
      const x = it.transform[4];
      const fontSize = Math.abs(it.transform[3]);
      const w = it.width > 0 ? it.width : it.str.length * fontSize * 0.55;
      return {
        str: it.str,
        x,
        y: it.transform[5],
        right: x + w,
        fontSize,
        bold: meta.bold,
        italic: meta.italic,
      };
    });

    // ── Group into lines ────────────────────────────────────────────────────
    const lineGroups = groupLines(items);

    const lines: Line[] = lineGroups.map(group => {
      const byX = [...group].sort((a, b) => a.x - b.x);
      const [left, right] = splitAtGap(byX, pageWidth);
      const fontSize = Math.max(...byX.map(i => i.fontSize));
      const hasBold = byX.some(i => i.bold);
      const align = detectAlign(byX, pageWidth);
      const text = plainText(left);
      const isAllCaps = text.length >= 2 && text === text.toUpperCase() && /[A-Z]/.test(text);
      // Section headers: ALL CAPS, short, no digits, single column
      const isSectionHeader = isAllCaps && text.length <= 30 && right.length === 0;

      return { y: byX[0].y, fontSize, hasBold, align, isSectionHeader, left, right };
    });

    // ── Compute body font size ──────────────────────────────────────────────
    const bodySize = getBodySize(lines);

    // ── Emit HTML ────────────────────────────────────────────────────────────
    let prevY: number | null = null;
    let prevSize = bodySize;

    for (const line of lines) {
      // Insert blank paragraph on large vertical gaps between content
      if (prevY !== null) {
        const gap = Math.abs(prevY - line.y);
        if (gap > prevSize * 1.8) {
          htmlParts.push('<p></p>');
        }
      }

      const html = buildLineHtml(line, bodySize);
      htmlParts.push(html);

      // Section headers get a horizontal rule beneath them (mimics PDF divider lines)
      if (line.isSectionHeader) {
        htmlParts.push('<hr />');
      }

      prevY = line.y;
      prevSize = line.fontSize || prevSize;
    }

    if (pageNum < pdf.numPages) {
      htmlParts.push('<p></p><hr style="border-top:2px dashed #ccc;" /><p></p>');
    }
  }

  return htmlParts.join('\n') || '<p>No text content found in this PDF.</p>';
}
