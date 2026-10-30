import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, Languages, Loader2 } from 'lucide-react';
import {
  BibleCorpus,
  ParallelVerse,
  WordLookup,
  countVerses,
  loadBibleCorpus,
  lookupIndonesianWord,
  lookupSimalungunWord,
  searchVerses,
  verseReference,
} from '../bibleCorpus';

type Tab = 'kata' | 'ayat' | 'baca';

const CONFIDENCE_STYLE: Record<WordLookup['confidence'], string> = {
  tinggi: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  sedang: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  rendah: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
};

function highlight(text: string, words: string[]) {
  const clean = words.filter((w) => w.length >= 2);
  if (clean.length === 0) return text;
  const escaped = clean.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-amber-200/70 dark:bg-amber-500/30 text-inherit rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function VerseCard({
  corpus,
  verse,
  smgWords = [],
  idnWords = [],
}: {
  corpus: BibleCorpus;
  verse: ParallelVerse;
  smgWords?: string[];
  idnWords?: string[];
}) {
  return (
    <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 space-y-2">
      <div className="text-xs font-semibold text-[#9A3412] dark:text-amber-400">
        {verseReference(corpus, verse)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <p className="text-sm font-serif text-stone-900 dark:text-stone-100 leading-relaxed">
          <span className="block text-[10px] uppercase tracking-wide text-stone-500 font-sans mb-0.5">
            Simalungun
          </span>
          {highlight(verse[3], smgWords)}
        </p>
        <p className="text-sm font-serif text-stone-700 dark:text-stone-300 leading-relaxed">
          <span className="block text-[10px] uppercase tracking-wide text-stone-500 font-sans mb-0.5">
            Indonesia (TB)
          </span>
          {highlight(verse[4], idnWords)}
        </p>
      </div>
    </div>
  );
}

export default function BibleCorpusExplorer() {
  const [corpus, setCorpus] = useState<BibleCorpus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('kata');

  const [wordQuery, setWordQuery] = useState('');
  const [submittedWord, setSubmittedWord] = useState('');
  const [verseQuery, setVerseQuery] = useState('');
  const [submittedVerse, setSubmittedVerse] = useState('');
  const [bookIndex, setBookIndex] = useState(42); // Yohanes
  const [chapter, setChapter] = useState(1);

  useEffect(() => {
    loadBibleCorpus()
      .then(setCorpus)
      .catch(() => setLoadError('Data korpus gagal dimuat. Periksa koneksi lalu muat ulang halaman.'));
  }, []);

  const wordResult = useMemo(() => {
    if (!corpus || !submittedWord) return null;
    const smg = lookupSimalungunWord(corpus, submittedWord);
    const idn = lookupIndonesianWord(corpus, submittedWord, 6);
    return { smg, idn };
  }, [corpus, submittedWord]);

  const verseResult = useMemo(() => {
    if (!corpus || !submittedVerse) return null;
    return { hits: searchVerses(corpus, submittedVerse, 30), total: countVerses(corpus, submittedVerse) };
  }, [corpus, submittedVerse]);

  const chapterCount = useMemo(() => {
    if (!corpus) return 0;
    let max = 0;
    for (const v of corpus.verses) if (v[0] === bookIndex && v[1] > max) max = v[1];
    return max;
  }, [corpus, bookIndex]);

  const chapterVerses = useMemo(
    () => (corpus ? corpus.verses.filter((v) => v[0] === bookIndex && v[1] === chapter) : []),
    [corpus, bookIndex, chapter]
  );

  const lookupWord = (w: string) => {
    setTab('kata');
    setWordQuery(w);
    setSubmittedWord(w.trim());
  };

  const tabButton = (id: Tab, label: string, Icon: typeof BookOpen) => (
    <button
      onClick={() => setTab(id)}
      className={`min-h-[40px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 cursor-pointer ${
        tab === id
          ? 'bg-[#9A3412] text-white'
          : 'bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-[#F3EFE6] dark:hover:bg-stone-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  const inputClass =
    'min-h-[44px] flex-1 px-4 py-2.5 text-sm bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-200/90 dark:border-stone-800 focus:outline-none focus:border-[#9A3412]';
  const submitClass =
    'min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-60';

  return (
    <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-8 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
            Korpus Paralel Alkitab Simalungun ↔ Indonesia
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-0.5 max-w-3xl">
            {corpus
              ? `${corpus.verses.length.toLocaleString('id-ID')} ayat disejajarkan otomatis dan ${corpus.lexicon.length.toLocaleString('id-ID')} kata Simalungun dengan arti yang dipelajari secara statistik dari kedua Alkitab.`
              : 'Seluruh Bibel Simalungun 2007 disejajarkan ayat demi ayat dengan Alkitab Terjemahan Baru.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabButton('kata', 'Arti Kata', Languages)}
          {tabButton('ayat', 'Cari Ayat', Search)}
          {tabButton('baca', 'Baca Paralel', BookOpen)}
        </div>
      </div>

      {loadError && <p className="text-sm text-red-700 dark:text-red-400">{loadError}</p>}
      {!corpus && !loadError && (
        <p className="text-sm text-stone-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat korpus Alkitab (±3 MB, sekali saja)...
        </p>
      )}

      {corpus && tab === 'kata' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedWord(wordQuery.trim());
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              value={wordQuery}
              onChange={(e) => setWordQuery(e.target.value)}
              placeholder="Ketik satu kata Simalungun atau Indonesia (misal: holong, porsaya, jalan)..."
              className={inputClass}
            />
            <button type="submit" className={submitClass}>
              <Search className="w-4 h-4" /> Cari Arti
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {['holong', 'porsaya', 'tonggo', 'uhur', 'pasu-pasu', 'jolma', 'doa', 'rumah'].map((w) => (
              <button
                key={w}
                onClick={() => lookupWord(w)}
                className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-900 hover:bg-[#F3EFE6] dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium cursor-pointer"
              >
                {w}
              </button>
            ))}
          </div>

          {wordResult && !wordResult.smg && wordResult.idn.length === 0 && (
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Kata &ldquo;{submittedWord}&rdquo; tidak ditemukan di korpus Alkitab. Coba bentuk dasarnya atau gunakan tab Cari Ayat.
            </p>
          )}

          {wordResult?.smg && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  {wordResult.smg.matchedWord}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CONFIDENCE_STYLE[wordResult.smg.confidence]}`}>
                  keyakinan {wordResult.smg.confidence}
                </span>
                <span className="text-xs text-stone-500">muncul di {wordResult.smg.frequency.toLocaleString('id-ID')} ayat</span>
              </div>
              {wordResult.smg.candidates.length > 0 ? (
                <div className="space-y-1.5 max-w-xl">
                  {wordResult.smg.candidates.map((c) => (
                    <div key={c.indonesian} className="flex items-center gap-3 text-sm">
                      <span className="w-36 font-semibold text-stone-800 dark:text-stone-200">{c.indonesian}</span>
                      <div className="flex-1 h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                        <div className="h-full bg-[#9A3412] dark:bg-amber-500" style={{ width: `${Math.round(c.score * 100)}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs text-stone-500">{Math.round(c.score * 100)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  Belum ada padanan yang meyakinkan. Baca maknanya langsung dari ayat-ayat di bawah.
                </p>
              )}
              <div className="space-y-3 pt-1">
                {wordResult.smg.examples.map((v, i) => (
                  <VerseCard
                    key={i}
                    corpus={corpus}
                    verse={v}
                    smgWords={[wordResult.smg!.matchedWord]}
                    idnWords={wordResult.smg!.candidates.slice(0, 2).map((c) => c.indonesian)}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  setTab('ayat');
                  setVerseQuery(wordResult.smg!.matchedWord);
                  setSubmittedVerse(wordResult.smg!.matchedWord);
                }}
                className="text-sm font-semibold text-[#9A3412] dark:text-amber-400 hover:underline cursor-pointer"
              >
                Lihat semua ayat yang memuat &ldquo;{wordResult.smg.matchedWord}&rdquo; →
              </button>
            </div>
          )}

          {wordResult && wordResult.idn.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-200/80 dark:border-stone-800">
              <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200 pt-3">
                Padanan Simalungun untuk &ldquo;{submittedWord}&rdquo; (Indonesia → Simalungun)
              </h3>
              <div className="flex flex-wrap gap-2">
                {wordResult.idn.map((s) => (
                  <button
                    key={s.simalungun}
                    onClick={() => lookupWord(s.simalungun)}
                    className="px-3 py-1.5 rounded-lg bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 text-sm cursor-pointer hover:border-[#9A3412]"
                  >
                    <span className="font-semibold text-stone-900 dark:text-stone-100">{s.simalungun}</span>
                    <span className="text-xs text-stone-500 ml-1.5">{s.frequency}×</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-stone-500">
            Arti dihitung otomatis dari kata yang sering muncul bersama di ayat yang sama (IBM Model 1, dua arah). Kata yang jarang muncul bisa meleset, jadi selalu cek contoh ayatnya.
          </p>
        </div>
      )}

      {corpus && tab === 'ayat' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedVerse(verseQuery.trim());
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              value={verseQuery}
              onChange={(e) => setVerseQuery(e.target.value)}
              placeholder="Kata, frasa, atau referensi (misal: Yohanes 3:16, 1 Musa 1:1, holong ni uhur)..."
              className={inputClass}
            />
            <button type="submit" className={submitClass}>
              <Search className="w-4 h-4" /> Cari Ayat
            </button>
          </form>
          {verseResult && (
            <>
              <p className="text-xs text-stone-500">
                {verseResult.hits.length === 0
                  ? 'Tidak ada ayat yang cocok.'
                  : verseResult.total > verseResult.hits.length
                    ? `Menampilkan ${verseResult.hits.length} dari ${verseResult.total.toLocaleString('id-ID')} ayat.`
                    : `${verseResult.hits.length} ayat ditemukan.`}
              </p>
              <div className="space-y-3">
                {verseResult.hits.map((v, i) => (
                  <VerseCard key={i} corpus={corpus} verse={v} smgWords={[submittedVerse]} idnWords={[submittedVerse]} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {corpus && tab === 'baca' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <select
              value={bookIndex}
              onChange={(e) => {
                setBookIndex(Number(e.target.value));
                setChapter(1);
              }}
              className={inputClass}
            >
              {corpus.books.map(([code, smg, idn], i) => (
                <option key={code} value={i}>
                  {idn} — {smg}
                </option>
              ))}
            </select>
            <select value={chapter} onChange={(e) => setChapter(Number(e.target.value))} className={`${inputClass} sm:max-w-[160px]`}>
              {Array.from({ length: chapterCount }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Pasal {i + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="divide-y divide-stone-200/80 dark:divide-stone-800 rounded-xl border border-stone-200/80 dark:border-stone-800">
            {chapterVerses.map((v) => (
              <div key={v[2]} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 p-3 sm:p-4">
                <p className="text-sm font-serif text-stone-900 dark:text-stone-100 leading-relaxed">
                  <sup className="text-[#9A3412] dark:text-amber-400 font-sans font-bold mr-1">{v[2]}</sup>
                  {v[3]}
                </p>
                <p className="text-sm font-serif text-stone-600 dark:text-stone-400 leading-relaxed">{v[4]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {corpus && (
        <p className="text-[11px] text-stone-500">Sumber: {corpus.source}.</p>
      )}
    </section>
  );
}
