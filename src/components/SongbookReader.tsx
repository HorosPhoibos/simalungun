import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Loader2,
  Lock,
  X,
  Download,
  Minus,
  Plus,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Timer,
  ExternalLink,
  Languages,
  Play,
  Trash2,
  ArrowUp,
  ArrowDown,
  Youtube,
  ListPlus,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import { BibleCorpus, WordLookup, glossSimalungunLine, loadBibleCorpus, lookupSimalungunWord } from '../bibleCorpus';
import { Metronome, beatsPerBar, keyName, parseKey, writtenKeyFor } from '../music';
import {
  Book,
  MOODS,
  Playlist,
  Song,
  SongRef,
  Songbooks,
  Stanza,
  LoginRequiredError,
  categoryLabel,
  findSong,
  loadSongbooks,
  readPlaylists,
  searchSongs,
  writePlaylists,
} from '../songbooks';

type LoadState = 'loading' | 'ready' | 'locked' | 'unavailable';
type Panel = 'all' | 'moods' | 'playlists';

const FONT_SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];

function readPref(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) && v >= 0 ? v : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // preferences are optional
  }
}

function songAsText(book: Book, song: Song): string {
  const header = [
    `${book.name} No. ${song.number} — ${song.title}`,
    [song.key, song.time].filter(Boolean).join(' · '),
    song.credits ?? '',
  ].filter(Boolean);
  const body = song.stanzas.map((st) => (st.n ? `${st.n}${st.n === 'Reff' ? ':' : '.'}\n` : '') + st.lines.join('\n'));
  return [...header, '', ...body.flatMap((b) => [b, ''])].join('\n') + `© ${book.copyright} — untuk belajar pribadi.\n`;
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '');
  a.click();
  URL.revokeObjectURL(url);
}

/** Original-language title from credits, for a hymnary.org search ("Nun danket alle Gott / Now Thank We All Our God"). */
function originalTitle(credits: string | null): string | null {
  if (!credits) return null;
  const ing = credits.match(/Ing\.\s*([^;|·]+)/);
  if (ing) return ing[1].trim();
  const slash = credits.match(/([A-Z][^;|·,]*?)\s*\/\s*([A-Z][^;|·,]+)/);
  if (slash) return slash[2].trim();
  const syair = credits.match(/Syair:\s*([^,;|·]+(?:,[^,;|·]+)?)/);
  return syair ? syair[1].trim() : null;
}

const youtubeUrl = (book: Book, song: Song) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${book.name} ${song.number} ${song.title}`)}`;

const card = 'bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800';
const iconBtn =
  'min-h-[40px] min-w-[40px] px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer text-stone-700 dark:text-stone-300 bg-stone-100 hover:bg-[#F3EFE6] dark:bg-stone-900 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-default';
const pill = (active: boolean) =>
  `shrink-0 min-h-[36px] px-3.5 rounded-full text-xs font-semibold cursor-pointer border transition-colors ${
    active
      ? 'bg-[#9A3412] text-white border-[#9A3412]'
      : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-[#9A3412]/50'
  }`;

interface Presentation {
  queue: SongRef[];
  song: number;
  stanza: number;
}

export default function SongbookReader() {
  const [data, setData] = useState<Songbooks | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [bookId, setBookId] = useState('DH');
  const [panel, setPanel] = useState<Panel>('all');
  const [current, setCurrent] = useState<SongRef | null>(null);
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState<string>('sukacita');
  const [category, setCategory] = useState<number | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>(readPlaylists);
  const [openPlaylist, setOpenPlaylist] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(() => readPref('pustaha_song_font', 1));
  const [showGloss, setShowGloss] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [mobileSide, setMobileSide] = useState<'main' | 'pair'>('main');
  const [corpus, setCorpus] = useState<BibleCorpus | null>(null);
  const [wordInfo, setWordInfo] = useState<{ word: string; hit: WordLookup | null } | null>(null);
  const [present, setPresent] = useState<Presentation | null>(null);
  const [transpose, setTranspose] = useState(0);
  const [bpm, setBpm] = useState(80);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const metronome = useRef<Metronome | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadSongbooks()
      .then((d) => {
        setData(d);
        setState('ready');
      })
      .catch((err) => setState(err instanceof LoginRequiredError ? 'locked' : 'unavailable'));
  }, []);

  const book = data?.books.find((b) => b.id === bookId) ?? data?.books[0];
  // On desktop the first song is shown right away; on phones the list is shown until a song is tapped.
  const found = data && current ? findSong(data, current) : null;
  const shown = found ?? (data && book ? { book, song: book.songs[0] } : null);
  const songBook = shown?.book;
  const song = shown?.song;

  const categoryNames = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.id, c.name])), [data]);

  // DH ↔ KJ/PKJ/NKB links in both directions.
  const counterparts = useMemo(() => {
    if (!data || !song || !songBook) return [];
    const list: { book: Book; song: Song }[] = [];
    for (const ref of song.refs ?? []) {
      const f = findSong(data, ref);
      if (f) list.push(f);
    }
    for (const b of data.books) {
      for (const s of b.songs) {
        if (s.refs?.some((r) => r.book === songBook.id && r.number === song.number)) list.push({ book: b, song: s });
      }
    }
    return list;
  }, [data, songBook, song]);

  const searchHits = useMemo(() => (data && query.trim() ? searchSongs(data, query) : null), [data, query]);

  const dh = data?.books.find((b) => b.id === 'DH');
  const moodSongs = useMemo(() => {
    if (!dh) return [];
    if (category !== null) return dh.songs.filter((s) => s.category === category);
    const names = new Set(MOODS.find((m) => m.id === mood)?.categories ?? []);
    return dh.songs.filter((s) => s.category !== undefined && names.has(categoryNames.get(s.category) ?? ''));
  }, [dh, mood, category, categoryNames]);

  useEffect(() => {
    if (songBook?.lang === 'smg' && !corpus) loadBibleCorpus().then(setCorpus).catch(() => {});
  }, [songBook, corpus]);

  useEffect(() => {
    setTranspose(0);
    setWordInfo(null);
    setMobileSide('main');
  }, [songBook?.id, song?.number]);

  useEffect(() => () => metronome.current?.stop(), []);

  useEffect(() => {
    if (metronomeOn && metronome.current) metronome.current.start(bpm, beatsPerBar(song?.time));
  }, [bpm, song?.time, metronomeOn]);

  useEffect(() => writePlaylists(playlists), [playlists]);

  const scrollTop = () => setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);

  const openSong = (ref: SongRef) => {
    setCurrent(ref);
    scrollTop();
  };

  const closeSong = () => {
    setCurrent(null);
    scrollTop();
  };

  const stepSong = (delta: number) => {
    if (!songBook || !song) return;
    const i = songBook.songs.findIndex((s) => s.number === song.number);
    const next = songBook.songs[i + delta];
    if (next) openSong({ book: songBook.id, number: next.number });
  };

  const toggleMetronome = () => {
    if (!metronome.current) metronome.current = new Metronome(setBeat);
    if (metronomeOn) {
      metronome.current.stop();
      setBeat(-1);
    } else {
      metronome.current.start(bpm, beatsPerBar(song?.time));
    }
    setMetronomeOn(!metronomeOn);
  };

  const changeFont = (delta: number) => {
    const next = Math.min(FONT_SIZES.length - 1, Math.max(0, fontSize + delta));
    setFontSize(next);
    writePref('pustaha_song_font', next);
  };

  const explainWord = (raw: string) => {
    if (!corpus) return;
    const word = raw.replace(/[^A-Za-zÀ-ÿ-]/g, '');
    if (word) setWordInfo({ word, hit: lookupSimalungunWord(corpus, word) });
  };

  const addToPlaylist = (playlistId: string) => {
    if (!song || !songBook) return;
    let target = playlistId;
    let lists = playlists;
    if (playlistId === '__new') {
      const name = window.prompt('Nama daftar putar (misal: Ibadah Minggu 24 Nov):');
      if (!name?.trim()) return;
      target = `pl-${Date.now()}`;
      lists = [...lists, { id: target, name: name.trim(), items: [] }];
    }
    setPlaylists(
      lists.map((p) =>
        p.id === target && !p.items.some((i) => i.book === songBook.id && i.number === song.number)
          ? { ...p, items: [...p.items, { book: songBook.id, number: song.number }] }
          : p
      )
    );
    setOpenPlaylist(target);
  };

  const updatePlaylist = (id: string, fn: (p: Playlist) => Playlist | null) =>
    setPlaylists((lists) => lists.map((p) => (p.id === id ? fn(p) : p)).filter((p): p is Playlist => p !== null));

  if (state === 'locked' || state === 'unavailable') {
    return (
      <section className={`${card} p-6 sm:p-10 text-center space-y-4`}>
        <div className="mx-auto w-14 h-14 rounded-full bg-[#9A3412]/10 dark:bg-amber-400/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-[#9A3412] dark:text-amber-400" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">Lirik dilindungi kata sandi</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            Doding Haleluya (© GKPS), Kidung Jemaat dan PKJ (© YAMUGER), serta NKB (© GKI) berhak cipta, jadi liriknya hanya untuk pengguna yang
            masuk.
          </p>
        </div>
        {state === 'locked' ? (
          <a
            href={`/__login?next=${encodeURIComponent('/?tab=lagu')}`}
            className="inline-flex min-h-[48px] px-6 items-center justify-center gap-2 rounded-xl bg-[#9A3412] hover:bg-[#7C2D12] text-white font-semibold"
          >
            <Lock className="w-4 h-4" /> Masuk untuk membuka lirik
          </a>
        ) : (
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
            Buka di <a href="https://simalungunku.site/?tab=lagu" className="underline text-[#9A3412] dark:text-amber-400">simalungunku.site</a> untuk masuk.
          </p>
        )}
      </section>
    );
  }

  if (state === 'loading' || !data || !book || !songBook || !song) {
    return (
      <section className={`${card} p-5 sm:p-8`}>
        <p className="text-sm text-stone-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat buku nyanyian...
        </p>
      </section>
    );
  }

  const isSmg = songBook.lang === 'smg';
  const keyIndex = parseKey(song.key);
  const lyricSize = FONT_SIZES[fontSize];
  const english = originalTitle(song.credits);
  const catName = song.category !== undefined ? categoryNames.get(song.category) : undefined;
  const songIndex = songBook.songs.findIndex((s) => s.number === song.number);
  const pair = counterparts[0];

  // ----- pieces ---------------------------------------------------------------------

  const songRow = (b: Book, s: Song, sub?: React.ReactNode) => {
    const active = Boolean(found) && b.id === songBook.id && s.number === song.number;
    return (
      <button
        key={b.id + s.number}
        onClick={() => openSong({ book: b.id, number: s.number })}
        className={`w-full text-left px-3 py-2.5 rounded-xl cursor-pointer flex gap-3 items-center transition-colors ${
          active ? 'bg-[#9A3412] text-white' : 'hover:bg-[#F3EFE6] dark:hover:bg-stone-900 text-stone-800 dark:text-stone-200'
        }`}
      >
        <span
          className={`w-12 h-9 shrink-0 rounded-lg flex flex-col items-center justify-center font-mono leading-none ${
            active ? 'bg-white/15' : 'bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400'
          }`}
        >
          <span className="text-[9px] opacity-75">{b.id}</span>
          <span className="text-xs font-bold">{s.number}</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold truncate">{s.title}</span>
          {sub && <span className={`block text-xs truncate ${active ? 'opacity-80' : 'text-stone-500'}`}>{sub}</span>}
        </span>
        {s.refs && !active && (
          <span className="shrink-0 text-[10px] font-semibold text-[#9A3412] dark:text-amber-400 border border-[#9A3412]/30 rounded-md px-1.5 py-0.5">
            {s.refs[0].book} {s.refs[0].number}
          </span>
        )}
      </button>
    );
  };

  const renderLine = (line: string) =>
    isSmg && corpus
      ? line.split(/(\s+)/).map((tok, k) =>
          /\S/.test(tok) ? (
            <span key={k} onClick={() => explainWord(tok)} className="cursor-pointer rounded hover:bg-amber-200/60 dark:hover:bg-amber-500/25">
              {tok}
            </span>
          ) : (
            tok
          )
        )
      : line;

  const stanzas = (list: Stanza[], opts: { gloss?: boolean; muted?: boolean; clickable?: boolean } = {}) => (
    <div className="space-y-6">
      {list.map((st, i) => (
        <div key={i} className="flex gap-3 sm:gap-4">
          <span
            className={`shrink-0 mt-1 h-7 min-w-7 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
              st.n === 'Reff'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-[#9A3412]/10 text-[#9A3412] dark:bg-amber-400/10 dark:text-amber-400'
            }`}
          >
            {st.n || '•'}
          </span>
          <div className={`font-serif ${lyricSize} leading-relaxed min-w-0 ${opts.muted ? 'text-stone-700 dark:text-stone-300' : 'text-stone-900 dark:text-stone-100'}`}>
            {st.lines.map((line, j) => (
              <div key={j}>
                <p>{opts.clickable ? renderLine(line) : line}</p>
                {opts.gloss && corpus && (
                  <p className="font-sans text-sm text-stone-500 dark:text-stone-400 italic mb-1.5">{glossSimalungunLine(corpus, line)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // Presentation data
  const presFound = present ? findSong(data, present.queue[present.song]) : null;
  const presStanzas = presFound?.song.stanzas ?? [];
  const presNext = () => {
    if (!present) return;
    if (present.stanza < presStanzas.length - 1) setPresent({ ...present, stanza: present.stanza + 1 });
    else if (present.song < present.queue.length - 1) setPresent({ ...present, song: present.song + 1, stanza: 0 });
  };
  const presPrev = () => {
    if (!present) return;
    if (present.stanza > 0) setPresent({ ...present, stanza: present.stanza - 1 });
    else if (present.song > 0) {
      const prev = findSong(data, present.queue[present.song - 1]);
      setPresent({ ...present, song: present.song - 1, stanza: Math.max(0, (prev?.song.stanzas.length ?? 1) - 1) });
    }
  };

  // ----- layout ---------------------------------------------------------------------

  return (
    <div ref={topRef} className="scroll-mt-20 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
      {/* ================= Browse (list) ================= */}
      <aside className={`lg:col-span-4 lg:sticky lg:top-20 space-y-3 min-w-0 ${found ? 'hidden lg:block' : ''}`}>
        <div className={`${card} p-3 sm:p-4 space-y-3`}>
          {/* Book switcher */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-900">
            {data.books.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setBookId(b.id);
                  setPanel('all');
                  setQuery('');
                }}
                className={`min-h-[44px] rounded-lg cursor-pointer leading-tight ${
                  b.id === book.id && panel === 'all' && !query
                    ? 'bg-white dark:bg-stone-800 shadow-xs text-[#9A3412] dark:text-amber-400'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
                title={b.name}
              >
                <span className="block text-sm font-bold">{b.id}</span>
                <span className="block text-[10px] opacity-75">{b.songs.length} lagu</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul, lirik, atau nomor (KJ 92)"
              className="w-full min-h-[46px] pl-10 pr-10 text-[15px] bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-none focus:border-[#9A3412]"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-stone-500 cursor-pointer" aria-label="Hapus pencarian">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Views */}
          {!query && (
            <div className="flex gap-1.5">
              {(
                [
                  ['all', `Semua ${book.id}`],
                  ['moods', 'Suasana'],
                  ['playlists', `Daftar putar${playlists.length ? ` (${playlists.length})` : ''}`],
                ] as [Panel, string][]
              ).map(([id, label]) => (
                <button key={id} onClick={() => setPanel(id)} className={pill(panel === id)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`${card} p-2`}>
          {searchHits ? (
            <>
              <div className="px-3 pt-2 pb-1 text-xs font-semibold text-stone-500">
                {searchHits.length ? `${searchHits.length} lagu ditemukan di semua buku` : 'Tidak ada lagu yang cocok.'}
              </div>
              <div className="max-h-[65vh] overflow-y-auto">{searchHits.map((h) => songRow(h.book, h.song, h.snippet))}</div>
            </>
          ) : panel === 'all' ? (
            <>
              <div className="px-3 pt-2 pb-1 text-xs font-semibold text-stone-500">{book.name}</div>
              <div className="max-h-[65vh] overflow-y-auto">{book.songs.map((s) => songRow(book, s))}</div>
            </>
          ) : panel === 'moods' ? (
            <div className="space-y-2">
              <div className="flex gap-1.5 overflow-x-auto px-1 pt-1 pb-1 no-scrollbar">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMood(m.id);
                      setCategory(null);
                    }}
                    className={pill(category === null && mood === m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <select
                value={category ?? ''}
                onChange={(e) => setCategory(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full min-h-[42px] px-3 text-sm bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800"
                aria-label="Kategori Doding Haleluya"
              >
                <option value="">Semua kategori dalam suasana ini</option>
                {(data.categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(c.name)}
                  </option>
                ))}
              </select>
              <div className="px-3 text-xs font-semibold text-stone-500">{moodSongs.length} lagu Doding Haleluya</div>
              <div className="max-h-[55vh] overflow-y-auto">
                {dh && moodSongs.map((s) => songRow(dh, s, s.category !== undefined ? categoryLabel(categoryNames.get(s.category) ?? '') : null))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-1">
              {playlists.length === 0 && (
                <p className="text-sm text-stone-600 dark:text-stone-400 p-2 leading-relaxed">
                  Belum ada daftar putar. Buka sebuah lagu, lalu tekan <strong>＋ Daftar putar</strong> untuk menyusun lagu ibadah.
                </p>
              )}
              {playlists.map((p) => (
                <div key={p.id} className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                  <div className="flex items-center gap-2 p-2.5 bg-[#FAF8F5] dark:bg-stone-900">
                    <button
                      onClick={() => p.items.length && setPresent({ queue: p.items, song: 0, stanza: 0 })}
                      disabled={!p.items.length}
                      className="w-11 h-11 shrink-0 rounded-full bg-[#9A3412] text-white flex items-center justify-center cursor-pointer disabled:opacity-40"
                      aria-label={`Putar ${p.name}`}
                    >
                      <Play className="w-4 h-4 ml-0.5" />
                    </button>
                    <button onClick={() => setOpenPlaylist(openPlaylist === p.id ? null : p.id)} className="flex-1 text-left cursor-pointer min-w-0">
                      <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">{p.name}</div>
                      <div className="text-[11px] text-stone-500">{p.items.length} lagu · ketuk untuk {openPlaylist === p.id ? 'menutup' : 'mengatur'}</div>
                    </button>
                    <button
                      onClick={() => window.confirm(`Hapus daftar putar "${p.name}"?`) && updatePlaylist(p.id, () => null)}
                      className="p-2 text-stone-500 cursor-pointer"
                      aria-label={`Hapus ${p.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {openPlaylist === p.id && (
                    <div className="p-1.5">
                      {p.items.map((ref, i) => {
                        const f = findSong(data, ref);
                        if (!f) return null;
                        const move = (dir: number) =>
                          updatePlaylist(p.id, (pl) => {
                            const items = [...pl.items];
                            [items[i + dir], items[i]] = [items[i], items[i + dir]];
                            return { ...pl, items };
                          });
                        return (
                          <div key={ref.book + ref.number} className="flex items-center">
                            <div className="flex-1 min-w-0">{songRow(f.book, f.song)}</div>
                            <button onClick={() => move(-1)} disabled={i === 0} className="p-2 text-stone-500 cursor-pointer disabled:opacity-30" aria-label="Naikkan">
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => move(1)} disabled={i === p.items.length - 1} className="p-2 text-stone-500 cursor-pointer disabled:opacity-30" aria-label="Turunkan">
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updatePlaylist(p.id, (pl) => ({ ...pl, items: pl.items.filter((_, j) => j !== i) }))}
                              className="p-2 text-stone-500 cursor-pointer"
                              aria-label="Keluarkan dari daftar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      {p.items.length === 0 && <p className="text-xs text-stone-500 p-2">Daftar ini masih kosong.</p>}
                    </div>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-stone-500 px-2 pb-1">Daftar putar tersimpan di browser ini.</p>
            </div>
          )}
        </div>
      </aside>

      {/* ================= Song ================= */}
      <article className={`lg:col-span-8 min-w-0 space-y-4 ${found ? '' : 'hidden lg:block'}`}>
        {/* Back bar (phones) */}
        <div className="lg:hidden flex items-center justify-between gap-2">
          <button onClick={closeSong} className={`${iconBtn} px-3`}>
            <ChevronLeft className="w-4 h-4" /> Daftar lagu
          </button>
          <div className="flex gap-1.5">
            <button onClick={() => stepSong(-1)} disabled={songIndex <= 0} className={iconBtn} aria-label="Lagu sebelumnya">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => stepSong(1)} disabled={songIndex >= songBook.songs.length - 1} className={iconBtn} aria-label="Lagu berikutnya">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`${card} overflow-hidden`}>
          {/* Title */}
          <header className="p-5 sm:p-7 pb-4 sm:pb-5 border-b border-stone-100 dark:border-stone-800 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-white bg-[#9A3412] rounded-md px-2 py-1">
                {songBook.id} {song.number}
              </span>
              {song.key && <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-900 rounded-md px-2 py-1">{song.key}</span>}
              {song.time && <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-900 rounded-md px-2 py-1">{song.time}</span>}
              {catName && <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-md px-2 py-1">{categoryLabel(catName)}</span>}
            </div>
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 leading-tight">{song.title}</h3>
            <p className="text-xs text-stone-500">{songBook.name}</p>
            {song.credits && <p className="text-xs text-stone-500 leading-relaxed">{song.credits}</p>}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setPresent({ queue: [{ book: songBook.id, number: song.number }], song: 0, stanza: 0 })}
                className="min-h-[40px] px-4 rounded-xl text-sm font-semibold bg-[#9A3412] hover:bg-[#7C2D12] text-white cursor-pointer flex items-center gap-2"
              >
                <Maximize2 className="w-4 h-4" /> Tampilkan
              </button>
              <a href={youtubeUrl(songBook, song)} target="_blank" rel="noreferrer" className={iconBtn} title="Cari lagu ini di YouTube">
                <Youtube className="w-4 h-4 text-red-600" /> Cari di YouTube
              </a>
              <label className={`${iconBtn} relative`} title="Tambah ke daftar putar">
                <ListPlus className="w-4 h-4" /> <span className="hidden sm:inline">Daftar putar</span>
                <select
                  value=""
                  onChange={(e) => e.target.value && addToPlaylist(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Tambah ke daftar putar"
                >
                  <option value="">Tambah ke daftar putar</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="__new">＋ Daftar putar baru...</option>
                </select>
              </label>
              <button onClick={() => downloadText(`${songBook.id}-${song.number}-${song.title}.txt`, songAsText(songBook, song))} className={iconBtn} title="Unduh lagu (.txt)">
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Unduh</span>
              </button>
              <div className="flex">
                <button onClick={() => changeFont(-1)} className={`${iconBtn} rounded-r-none`} aria-label="Perkecil huruf">
                  <Type className="w-3 h-3" />
                </button>
                <button onClick={() => changeFont(1)} className={`${iconBtn} rounded-l-none border-l border-stone-200 dark:border-stone-800`} aria-label="Perbesar huruf">
                  <Type className="w-4.5 h-4.5" />
                </button>
              </div>
              <button onClick={() => setShowTools(!showTools)} className={`${iconBtn} ${showTools ? 'ring-1 ring-[#9A3412]/50' : ''}`} title="Alat pemusik">
                <SlidersHorizontal className="w-4 h-4" /> <span className="hidden sm:inline">Alat pemusik</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTools ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </header>

          {/* Musician tools */}
          {showTools && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 sm:px-7 bg-[#FAF8F5] dark:bg-stone-900/50 border-b border-stone-100 dark:border-stone-800">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Nada dasar</div>
                {keyIndex === null ? (
                  <p className="text-sm text-stone-600 dark:text-stone-400">Nada dasar tidak tercantum di buku.</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setTranspose(transpose - 1)} className={iconBtn} aria-label="Turun setengah nada">
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="flex-1 text-center">
                        <div className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">{keyName(keyIndex + transpose)}</div>
                        <div className="text-[11px] text-stone-500">
                          {transpose === 0 ? 'sesuai buku' : `${transpose > 0 ? '+' : ''}${transpose} semitone dari ${song.key}`}
                        </div>
                      </div>
                      <button onClick={() => setTranspose(transpose + 1)} className={iconBtn} aria-label="Naik setengah nada">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      B♭ (trompet, klarinet, sax tenor): {writtenKeyFor(keyIndex + transpose, 'Bb')} · E♭ (sax alto): {writtenKeyFor(keyIndex + transpose, 'Eb')} · Horn F:{' '}
                      {writtenKeyFor(keyIndex + transpose, 'F')}
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Metronom · {beatsPerBar(song.time)} ketuk</div>
                <div className="flex items-center gap-2">
                  <input type="range" min={40} max={160} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="flex-1 accent-[#9A3412]" aria-label="Tempo" />
                  <span className="w-16 text-right text-sm font-semibold text-stone-800 dark:text-stone-200">{bpm} bpm</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={toggleMetronome} className={iconBtn}>
                    <Timer className="w-4 h-4" /> {metronomeOn ? 'Berhenti' : 'Mulai'}
                  </button>
                  <div className="flex gap-1.5">
                    {Array.from({ length: beatsPerBar(song.time) }, (_, i) => (
                      <span key={i} className={`w-3 h-3 rounded-full ${beat === i ? (i === 0 ? 'bg-[#9A3412]' : 'bg-amber-500') : 'bg-stone-300 dark:bg-stone-700'}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-5 sm:p-7 space-y-5">
            {/* Language switch for paired songs on phones; side by side from xl */}
            {pair && (
              <div className="xl:hidden grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-900">
                {(
                  [
                    ['main', `${songBook.id} ${song.number} · ${isSmg ? 'Simalungun' : 'Indonesia'}`],
                    ['pair', `${pair.book.id} ${pair.song.number} · ${pair.book.lang === 'smg' ? 'Simalungun' : 'Indonesia'}`],
                  ] as ['main' | 'pair', string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setMobileSide(id)}
                    className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                      mobileSide === id ? 'bg-white dark:bg-stone-800 shadow-xs text-[#9A3412] dark:text-amber-400' : 'text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {isSmg && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setShowGloss(!showGloss)} className={`${pill(showGloss)} flex items-center gap-1.5`}>
                  <Languages className="w-3.5 h-3.5" /> Arti per baris
                </button>
                <span className="text-[11px] text-stone-500">Ketuk kata untuk melihat artinya.</span>
              </div>
            )}

            {wordInfo && (
              <div className="sticky top-20 z-10 p-4 rounded-xl bg-white dark:bg-stone-900 border border-[#9A3412]/30 shadow-lg space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">{wordInfo.hit?.matchedWord ?? wordInfo.word}</div>
                  <button onClick={() => setWordInfo(null)} className="p-1 cursor-pointer text-stone-500" aria-label="Tutup">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {!wordInfo.hit || wordInfo.hit.candidates.length === 0 ? (
                  <p className="text-sm text-stone-600 dark:text-stone-400">Kata ini tidak ditemukan di korpus Alkitab.</p>
                ) : (
                  <>
                    <p className="text-sm text-stone-800 dark:text-stone-200">
                      {wordInfo.hit.candidates.slice(0, 3).map((c) => `${c.indonesian} (${Math.round(c.score * 100)}%)`).join(', ')}
                    </p>
                    {wordInfo.hit.examples[0] && (
                      <p className="text-xs text-stone-500 leading-relaxed">
                        “{wordInfo.hit.examples[0][3]}” — “{wordInfo.hit.examples[0][4]}”
                      </p>
                    )}
                    <p className="text-[11px] text-stone-500">
                      Muncul di {wordInfo.hit.frequency}× ayat · keyakinan {wordInfo.hit.confidence}
                    </p>
                  </>
                )}
              </div>
            )}

            <div className={`grid grid-cols-1 ${pair ? 'xl:grid-cols-2 xl:gap-8' : ''}`}>
              <div className={`min-w-0 ${pair && mobileSide === 'pair' ? 'hidden xl:block' : ''}`}>
                {pair && <div className="hidden xl:block text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-4">{isSmg ? 'Simalungun' : 'Indonesia'}</div>}
                {stanzas(song.stanzas, { gloss: showGloss && isSmg, clickable: isSmg })}
              </div>
              {pair && (
                <div className={`min-w-0 xl:border-l xl:pl-8 border-stone-200 dark:border-stone-800 ${mobileSide === 'main' ? 'hidden xl:block' : ''}`}>
                  <button
                    onClick={() => openSong({ book: pair.book.id, number: pair.song.number })}
                    className="text-[11px] font-semibold uppercase tracking-wide text-[#9A3412] dark:text-amber-400 hover:underline cursor-pointer text-left mb-4 block"
                  >
                    Padanan resmi: {pair.book.id} {pair.song.number} — {pair.song.title} →
                  </button>
                  {stanzas(pair.song.stanzas, { muted: true })}
                </div>
              )}
            </div>

            {isSmg && !pair && (
              <p className="text-xs text-stone-500 leading-relaxed">
                Lagu ini tidak mencantumkan padanan resmi di KJ/PKJ/NKB. <strong>Arti per baris</strong> adalah terjemahan kata per kata otomatis dari korpus Alkitab, bukan
                lirik resmi. Tanda “?” berarti tebakan lemah, kata dalam [kurung] belum ditemukan.
              </p>
            )}
          </div>

          <footer className="px-5 sm:px-7 py-4 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-stone-500">
            <div className="hidden lg:flex gap-1.5">
              <button onClick={() => stepSong(-1)} disabled={songIndex <= 0} className={iconBtn}>
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <button onClick={() => stepSong(1)} disabled={songIndex >= songBook.songs.length - 1} className={iconBtn}>
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {english && (
              <a
                href={`https://hymnary.org/search?qu=${encodeURIComponent(english)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#9A3412] dark:text-amber-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Lirik asli / Inggris (Hymnary.org)
              </a>
            )}
            <button
              onClick={() =>
                downloadText(`${songBook.name}.txt`, songBook.songs.map((s) => songAsText(songBook, s)).join('\n----------------------------------------\n\n'))
              }
              className="inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer"
            >
              <Download className="w-3 h-3" /> Unduh seluruh {songBook.name}
            </button>
            <span>
              © {songBook.copyright} · untuk belajar pribadi ·{' '}
              <a href="/__logout" className="underline">
                Keluar
              </a>
            </span>
          </footer>
        </div>

        {/* Next/previous (phones) */}
        <div className="lg:hidden grid grid-cols-2 gap-2">
          <button onClick={() => stepSong(-1)} disabled={songIndex <= 0} className={`${iconBtn} min-h-[48px]`}>
            <ChevronLeft className="w-4 h-4" /> {songIndex > 0 ? `${songBook.id} ${songBook.songs[songIndex - 1].number}` : 'Awal'}
          </button>
          <button onClick={() => stepSong(1)} disabled={songIndex >= songBook.songs.length - 1} className={`${iconBtn} min-h-[48px]`}>
            {songIndex < songBook.songs.length - 1 ? `${songBook.id} ${songBook.songs[songIndex + 1].number}` : 'Akhir'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </article>

      {/* Presentation mode: one stanza at a time, song after song from the queue */}
      {present && presFound && (
        <div className="fixed inset-0 z-50 bg-[#FAF8F5] dark:bg-[#0f0e0d] flex flex-col" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-stone-200 dark:border-stone-800">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#9A3412] dark:text-amber-400">
                {present.queue.length > 1 ? `Lagu ${present.song + 1}/${present.queue.length} · ` : ''}
                {presFound.book.id} {presFound.song.number}
                {presFound.song.key ? ` · ${presFound.song.key}` : ''} · bait {present.stanza + 1}/{presStanzas.length}
              </div>
              <div className="font-serif font-bold text-lg truncate text-stone-900 dark:text-stone-100">{presFound.song.title}</div>
            </div>
            <button onClick={() => setPresent(null)} className={iconBtn} aria-label="Tutup">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto flex items-center justify-center p-6" onClick={presNext}>
            <div className="max-w-3xl text-center">
              <div className="text-sm font-bold text-[#9A3412] dark:text-amber-400 mb-4">{presStanzas[present.stanza]?.n}</div>
              {presStanzas[present.stanza]?.lines.map((l, i) => (
                <p key={i} className="font-serif text-2xl sm:text-4xl leading-snug text-stone-900 dark:text-stone-100 mb-2">
                  {l}
                </p>
              ))}
              <p className="mt-8 text-xs text-stone-400">Ketuk layar untuk bait berikutnya</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 border-t border-stone-200 dark:border-stone-800">
            <button onClick={presPrev} className={`${iconBtn} min-h-[48px]`} disabled={present.song === 0 && present.stanza === 0}>
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>
            <button
              onClick={presNext}
              className={`${iconBtn} min-h-[48px]`}
              disabled={present.song === present.queue.length - 1 && present.stanza === presStanzas.length - 1}
            >
              Berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
