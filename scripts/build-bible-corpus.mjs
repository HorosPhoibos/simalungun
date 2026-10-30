// Builds the Simalungun ↔ Indonesian parallel Bible corpus and a statistical word lexicon
// from the two Bible PDFs in public/assets/aistudio. Output goes to public/data/.
//
//   npm run build:corpus
//
// Steps: extract PDF text → parse verses → align by book:chapter:verse → learn word
// translations with IBM Model 1 in both directions → write compact JSON for the app.
import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { BOOKS, parseBible } from './parse-bible.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, 'scripts', '.cache');
const OUT = path.join(ROOT, 'public', 'data');
const SOURCES = {
  smg: path.join(ROOT, 'public/assets/aistudio/alkitab_simalungun_00d96e9c.pdf'),
  tb: path.join(ROOT, 'public/assets/aistudio/alkitab_terjemahan_baru_37df3eea.pdf'),
};

async function extractText(key) {
  const cached = path.join(CACHE, `${key}.txt`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
  console.log(`Extracting ${path.basename(SOURCES[key])} (takes a minute)...`);
  const parser = new PDFParse({ data: fs.readFileSync(SOURCES[key]) });
  const { text } = await parser.getText({ pageJoiner: '\n<<<PAGE page_number>>>\n' });
  await parser.destroy();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cached, text);
  return text;
}

// Editorial markers that are not part of the verse text.
function cleanVerse(text) {
  return text
    .replace(/\[\[EMPTY\]\]/g, '')
    .replace(/\(\d+-\d+[ab]?\)\s*/g, '') // "(2-1a)" alternative numbering
    .replace(/^\//, '')
    .replace(/[*/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- 1. Parallel verses -----------------------------------------------------------
const smgBooks = parseBible(await extractText('smg'), 'smg');
const tbBooks = parseBible(await extractText('tb'), 'tb');
if (smgBooks.length !== 66 || tbBooks.length !== 66) {
  throw new Error(`Expected 66 books, got ${smgBooks.length} / ${tbBooks.length}`);
}

const books = BOOKS.map(([code, idn], i) => [code, smgBooks[i].title.replace(/^(\d)(\S)/, '$1 $2'), idn]);
const verses = []; // [bookIndex, chapter, verse, smg, idn]
for (let b = 0; b < 66; b++) {
  for (const [key, smgRaw] of smgBooks[b].verses) {
    const idnRaw = tbBooks[b].verses.get(key);
    if (!idnRaw) continue;
    const smg = cleanVerse(smgRaw);
    const idn = cleanVerse(idnRaw);
    if (!smg || !idn) continue;
    const [c, v] = key.split(':').map(Number);
    verses.push([b, c, v, smg, idn]);
  }
}
console.log(`Aligned verses: ${verses.length}`);

// --- 2. Word alignment (IBM Model 1) ---------------------------------------------
// Pronoun clitics written with a capital after a hyphen ("rupa-Ni", "dibuat-Nya")
// are split off; other hyphenated words ("manuk-manuk") stay whole.
function tokenize(text) {
  return text
    .replace(/-(?=[A-Z])/g, ' ')
    .toLowerCase()
    .replace(/[^a-zà-ÿ\- ]+/g, ' ')
    .split(' ')
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter(Boolean);
}

function vocab() {
  const ids = new Map();
  const words = [];
  return {
    id(w) {
      let i = ids.get(w);
      if (i === undefined) {
        i = words.length;
        ids.set(w, i);
        words.push(w);
      }
      return i;
    },
    words,
  };
}

const smgVocab = vocab();
const idnVocab = vocab();
const pairs = []; // only clean pairs train the model
const smgFreq = new Map();
const smgVerseRefs = new Map(); // smg word id -> verse indexes (for examples)
// Indonesian particles/possessives ("datanglah", "kasihmu") are folded into the base word
// when that base word also occurs on its own, so the scores are not split across forms.
const idnWordSet = new Set(verses.flatMap(([, , , , idn]) => tokenize(idn)));
function idnBase(w) {
  const m = w.match(/^(.{3,}?)(lah|kah|nya|mu|ku)$/);
  return m && idnWordSet.has(m[1]) ? m[1] : w;
}

verses.forEach(([, , , smg, idn], index) => {
  const s = tokenize(smg).map((w) => smgVocab.id(w));
  const t = tokenize(idn).map((w) => idnVocab.id(idnBase(w)));
  for (const w of new Set(s)) {
    smgFreq.set(w, (smgFreq.get(w) || 0) + 1);
    const refs = smgVerseRefs.get(w) || [];
    if (refs.length < 400) refs.push(index);
    smgVerseRefs.set(w, refs);
  }
  const ratio = smg.length / idn.length;
  if (ratio > 0.4 && ratio < 2.5) pairs.push([s, t]);
});
console.log(`Vocabulary: ${smgVocab.words.length} Simalungun, ${idnVocab.words.length} Indonesian words`);

// t[f] = Map(e -> p(e | f)); NULL source word has id -1.
function trainModel1(sentencePairs, iterations) {
  const NULL = -1;
  const t = new Map();
  for (const [src, tgt] of sentencePairs) {
    for (const f of [NULL, ...src]) {
      let row = t.get(f);
      if (!row) t.set(f, (row = new Map()));
      for (const e of tgt) row.set(e, 1);
    }
  }
  for (let it = 0; it < iterations; it++) {
    const count = new Map();
    const total = new Map();
    for (const [src, tgt] of sentencePairs) {
      const sources = [NULL, ...src];
      for (const e of tgt) {
        let z = 0;
        for (const f of sources) z += t.get(f).get(e) || 1e-6;
        for (const f of sources) {
          const c = (t.get(f).get(e) || 1e-6) / z;
          let row = count.get(f);
          if (!row) count.set(f, (row = new Map()));
          row.set(e, (row.get(e) || 0) + c);
          total.set(f, (total.get(f) || 0) + c);
        }
      }
    }
    for (const [f, row] of count) {
      const tot = total.get(f);
      const next = new Map();
      for (const [e, c] of row) {
        const p = c / tot;
        if (p > 1e-4) next.set(e, p);
      }
      t.set(f, next);
    }
    console.log(`  IBM Model 1 iteration ${it + 1}/${iterations}`);
  }
  return t;
}

console.log('Training Simalungun → Indonesian...');
const smgToIdn = trainModel1(pairs.map(([s, t]) => [s, t]), 6); // p(idn | smg)
console.log('Training Indonesian → Simalungun...');
const idnToSmg = trainModel1(pairs.map(([s, t]) => [t, s]), 6); // p(smg | idn)

// Symmetric score: geometric mean of both directions keeps translations that agree.
function candidates(f, max) {
  const row = smgToIdn.get(f);
  if (!row) return [];
  const out = [];
  for (const [e, p] of row) {
    const back = idnToSmg.get(e)?.get(f) || 0;
    const score = Math.sqrt(p * back);
    if (score > 0.02) out.push([e, score]);
  }
  return out.sort((a, b) => b[1] - a[1]).slice(0, max);
}

// --- 3. Lexicon ---------------------------------------------------------------------
// entry: [word, frequency, [[indonesian, score], ...], [verseIndex, ...]]
const lexicon = [];
for (let f = 0; f < smgVocab.words.length; f++) {
  const word = smgVocab.words[f];
  if (word.length < 2 && !['i', 'a'].includes(word)) continue;
  const freq = smgFreq.get(f) || 0;
  const cands = candidates(f, 4).map(([e, s]) => [idnVocab.words[e], Math.round(s * 100) / 100]);
  // Examples: prefer short verses that also contain the best translation.
  const best = cands[0]?.[0];
  const refs = (smgVerseRefs.get(f) || [])
    .map((i) => [i, verses[i][3].length + (best && tokenize(verses[i][4]).map(idnBase).includes(best) ? 0 : 400)])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([i]) => i);
  lexicon.push([word, freq, cands, refs]);
}
lexicon.sort((a, b) => b[1] - a[1]);
console.log(`Lexicon entries: ${lexicon.length}`);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'bible-parallel.json'),
  JSON.stringify({ source: 'Bibel Simalungun 2007 (LAI) ↔ Alkitab Terjemahan Baru (LAI)', books, verses }),
);
fs.writeFileSync(path.join(OUT, 'smg-lexicon.json'), JSON.stringify({ lexicon }));
for (const f of ['bible-parallel.json', 'smg-lexicon.json']) {
  console.log(`  public/data/${f}: ${(fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(1)} MB`);
}

// Quick sanity check printed for review.
const byWord = new Map(lexicon.map((e) => [e[0], e]));
for (const w of ['naibata', 'tanoh', 'holong', 'jabu', 'mangan', 'anak', 'uhur', 'roh', 'dalan', 'bah']) {
  const e = byWord.get(w);
  if (e) console.log(`  ${w} (${e[1]}x): ${e[2].map(([x, s]) => `${x} ${s}`).join(', ')}`);
}
