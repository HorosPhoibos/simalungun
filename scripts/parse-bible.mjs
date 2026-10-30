// Parses the raw text of a Bible PDF (from extract-pdf-text.mjs) into verses.
// Both PDFs share the same layout: one book per title page, a running header with
// the page number on every other page, and verse numbers at the start of a line.
//   Simalungun : chapter start = chapter number glued to verse 1 ("21 Sonai ...")
//   Terj. Baru : chapter start = "2 1 Demikianlah ..."

// 66 books of the Protestant canon in order, with chapter counts (used for validation).
export const BOOKS = [
  ['GEN', 'Kejadian', 50], ['EXO', 'Keluaran', 40], ['LEV', 'Imamat', 27], ['NUM', 'Bilangan', 36],
  ['DEU', 'Ulangan', 34], ['JOS', 'Yosua', 24], ['JDG', 'Hakim-hakim', 21], ['RUT', 'Rut', 4],
  ['1SA', '1 Samuel', 31], ['2SA', '2 Samuel', 24], ['1KI', '1 Raja-raja', 22], ['2KI', '2 Raja-raja', 25],
  ['1CH', '1 Tawarikh', 29], ['2CH', '2 Tawarikh', 36], ['EZR', 'Ezra', 10], ['NEH', 'Nehemia', 13],
  ['EST', 'Ester', 10], ['JOB', 'Ayub', 42], ['PSA', 'Mazmur', 150], ['PRO', 'Amsal', 31],
  ['ECC', 'Pengkhotbah', 12], ['SNG', 'Kidung Agung', 8], ['ISA', 'Yesaya', 66], ['JER', 'Yeremia', 52],
  ['LAM', 'Ratapan', 5], ['EZK', 'Yehezkiel', 48], ['DAN', 'Daniel', 12], ['HOS', 'Hosea', 14],
  ['JOL', 'Yoel', 3], ['AMO', 'Amos', 9], ['OBA', 'Obaja', 1], ['JON', 'Yunus', 4],
  ['MIC', 'Mikha', 7], ['NAM', 'Nahum', 3], ['HAB', 'Habakuk', 3], ['ZEP', 'Zefanya', 3],
  ['HAG', 'Hagai', 2], ['ZEC', 'Zakharia', 14], ['MAL', 'Maleakhi', 4],
  ['MAT', 'Matius', 28], ['MRK', 'Markus', 16], ['LUK', 'Lukas', 24], ['JHN', 'Yohanes', 21],
  ['ACT', 'Kisah Para Rasul', 28], ['ROM', 'Roma', 16], ['1CO', '1 Korintus', 16], ['2CO', '2 Korintus', 13],
  ['GAL', 'Galatia', 6], ['EPH', 'Efesus', 6], ['PHP', 'Filipi', 4], ['COL', 'Kolose', 4],
  ['1TH', '1 Tesalonika', 5], ['2TH', '2 Tesalonika', 3], ['1TI', '1 Timotius', 6], ['2TI', '2 Timotius', 4],
  ['TIT', 'Titus', 3], ['PHM', 'Filemon', 1], ['HEB', 'Ibrani', 13], ['JAS', 'Yakobus', 5],
  ['1PE', '1 Petrus', 5], ['2PE', '2 Petrus', 3], ['1JN', '1 Yohanes', 5], ['2JN', '2 Yohanes', 1],
  ['3JN', '3 Yohanes', 1], ['JUD', 'Yudas', 1], ['REV', 'Wahyu', 22],
];

// Broken font ligatures in the Simalungun PDF.
const LIGATURES = { 'Ɵ': 'ti', 'Ʃ': 'tt', 'ƫ': 'tt', 'Ō': 'ft', 'Ņ': 'fk', 'ʻ': '‘', 'ʼ': '’' };

export function normalizeText(text) {
  return text.replace(/[ƟƩƫŌŅʻʼ]/g, (ch) => LIGATURES[ch]);
}

const HEADER_RE = /\s\d+$/; // running header ends with the page number

/**
 * @param {string} raw text produced by extract-pdf-text.mjs
 * @param {'smg'|'tb'} style chapter-marker style
 * @returns {{title: string, verses: Map<string, string>}[]} one entry per book, verse key "c:v"
 */
export function parseBible(raw, style) {
  const pages = normalizeText(raw).split(/\n<<<PAGE \d+>>>\n/).slice(1);

  // 1. Group lines into books using title pages (first line without a page number).
  const books = [];
  for (const page of pages) {
    const lines = page.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (HEADER_RE.test(lines[0])) {
      if (books.length) books[books.length - 1].lines.push(...lines.slice(1));
    } else {
      books.push({ title: lines[0], lines: lines.slice(1) });
    }
  }

  // 2. Walk each book's lines with a verse state machine.
  const parsed = [];
  for (const book of books) {
    const verses = parseBookLines(book.lines, style);
    if (verses.size > 0) parsed.push({ title: book.title, verses });
  }
  return parsed;
}

function parseBookLines(lines, style) {
  // Tokenize: each line becomes either a verse start candidate or plain text.
  const tokens = lines.map((line) => {
    const m = line.match(/^(\d+)(?:\s+(\d+))?\s+(.*)$/);
    return m ? { line, first: m[1], second: m[2], rest: m[3] } : { line };
  });

  const verses = new Map();
  let chapter = 0;
  let verse = 0;
  let current = null; // key of the verse being filled

  // Returns the verse number of the next numbered token (for disambiguation).
  const nextVerseNumber = (from) => {
    for (let j = from; j < tokens.length && j < from + 12; j++) {
      if (tokens[j].first) return Number(tokens[j].first);
    }
    return null;
  };

  const startVerse = (c, v, text) => {
    chapter = c;
    verse = v;
    current = `${c}:${v}`;
    verses.set(current, text);
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.first) {
      const n = Number(t.first);
      const nextChapterMarker = String(chapter + 1) + '1';

      if (style === 'tb' && t.second === '1' && n === chapter + 1) {
        startVerse(n, 1, t.rest);
        continue;
      }
      if (style === 'smg' && t.first === nextChapterMarker) {
        // "41" may be verse 41 or chapter 4 verse 1: chapter start is followed by verse 2.
        const isVerse = n === verse + 1 && chapter > 0 && nextVerseNumber(i + 1) !== 2;
        if (!isVerse) {
          startVerse(chapter + 1, 1, (t.second ? t.second + ' ' : '') + t.rest);
          continue;
        }
      }
      // Single-chapter books may start with a plain "1".
      if (chapter === 0 && n === 1) {
        startVerse(1, 1, (t.second ? t.second + ' ' : '') + t.rest);
        continue;
      }
      if (chapter > 0 && n > verse && n <= verse + 2) {
        startVerse(chapter, n, (t.second ? t.second + ' ' : '') + t.rest);
        continue;
      }
    }
    // Plain text: continuation of the current verse, or a section heading.
    if (!current) continue;
    if (isHeading(tokens, i, verses.get(current))) {
      continue; // dropped; headings are not part of the verse text
    }
    verses.set(current, joinLine(verses.get(current), t.line));
  }
  return verses;
}

// A section heading sits between a finished sentence and the next verse number,
// and has no sentence punctuation of its own.
function isHeading(tokens, i, currentText) {
  const line = tokens[i].line;
  if (/[.,;:!?”"’)]$/.test(line)) return false;
  if (!/^[A-Z“"(]/.test(line)) return false;
  const prevLine = i > 0 ? tokens[i - 1].line : '';
  const prevEndsSentence = /[.!?”"’):;]$/.test(prevLine) || /[.!?”"’):;]$/.test(currentText || '');
  if (!prevEndsSentence && !isHeadingLine(tokens, i - 1)) return false;
  // Next line must be a numbered verse, or another heading line.
  const next = tokens[i + 1];
  if (!next) return true;
  return Boolean(next.first) || (!/[.,;:!?”"’]$/.test(next.line) && /^[A-Z(]/.test(next.line) && Boolean(tokens[i + 2]?.first));
}

function isHeadingLine(tokens, i) {
  return i >= 0 && !tokens[i].first && /^[A-Z(]/.test(tokens[i].line) && !/[.,;:!?”"’]$/.test(tokens[i].line);
}

function joinLine(text, line) {
  // Re-join words hyphenated across a line break ("suan-\nsuanan" keeps its hyphen).
  return text.endsWith('-') ? text + line : text + ' ' + line;
}
