import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Music,
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
  Timer,
  ExternalLink,
  Languages,
  Play,
  Trash2,
  ArrowUp,
  ArrowDown,
  Youtube,
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
  categoryLabel,
  findSong,
  loadSongbooks,
  readPlaylists,
  searchSongs,
  writePlaylists,
} from '../songbooks';

type LoadState = 'loading' | 'ready' | 'unavailable';
type Panel = 'songs' | 'moods' | 'playlists';

const FONT_SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];

function readPref(key: string, fallback: number) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v >= 0 && localStorage.getItem(key) !== null ? v : fallback;
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

const smallBtn =
  'min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-[#F3EFE6] dark:hover:bg-stone-800 cursor-pointer flex items-center gap-1.5 disabled:opacity-40';
const chip = (active: boolean) =>
  `min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border ${
    active
      ? 'bg-[#9A3412] text-white border-[#9A3412]'
      : 'bg-[#FAF8F5] dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-[#9A3412]/50'
  }`;

interface Presentation {
  queue: SongRef[];
  song: number;
  stanza: number;
}

export default function SongbookReader() {
  const [data, setData] = useState<Songbooks | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [panel, setPanel] = useState<Panel>('songs');
  const [current, setCurrent] = useState<SongRef>({ book: 'DH', number: '1' });
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState<string>('sukacita');
  const [category, setCategory] = useState<number | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>(readPlaylists);
  const [openPlaylist, setOpenPlaylist] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(() => readPref('pustaha_song_font', 1));
  const [showGloss, setShowGloss] = useState(false);
  const [corpus, setCorpus] = useState<BibleCorpus | null>(null);
  const [wordInfo, setWordInfo] = useState<{ word: string; hit: WordLookup | null } | null>(null);
  const [present, setPresent] = useState<Presentation | null>(null);
  const [transpose, setTranspose] = useState(0);
  const [bpm, setBpm] = useState(80);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const metronome = useRef<Metronome | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    loadSongbooks()
      .then((d) => {
        setData(d);
        setState('ready');
      })
      .catch(() => setState('unavailable'));
  }, []);

  const found = data ? findSong(data, current) ?? findSong(data, { book: 'DH', number: '1' }) : null;
  const book = found?.book;
  const song = found?.song;

  const categoryNames = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.id, c.name])), [data]);

  // DH ↔ KJ/PKJ/NKB links in both directions.
  const counterparts = useMemo(() => {
    if (!data || !song || !book) return [];
    const list: { book: Book; song: Song }[] = [];
    for (const ref of song.refs ?? []) {
      const f = findSong(data, ref);
      if (f) list.push(f);
    }
    for (const b of data.books) {
      for (const s of b.songs) {
        if (s.refs?.some((r) => r.book === book.id && r.number === song.number)) list.push({ book: b, song: s });
      }
    }
    return list;
  }, [data, book, song]);

  const searchHits = useMemo(() => (data && query.trim() ? searchSongs(data, query) : null), [data, query]);

  const dh = data?.books.find((b) => b.id === 'DH');
  const moodSongs = useMemo(() => {
    if (!dh) return [];
    if (category !== null) return dh.songs.filter((s) => s.category === category);
    const names = new Set(MOODS.find((m) => m.id === mood)?.categories ?? []);
    return dh.songs.filter((s) => s.category !== undefined && names.has(categoryNames.get(s.category) ?? ''));
  }, [dh, mood, category, categoryNames]);

  useEffect(() => {
    if (book?.lang === 'smg' && !corpus) loadBibleCorpus().then(setCorpus).catch(() => {});
  }, [book, corpus]);

  useEffect(() => {
    setTranspose(0);
    setWordInfo(null);
  }, [current.book, current.number]);

  useEffect(() => () => metronome.current?.stop(), []);

  useEffect(() => {
    if (metronomeOn && metronome.current) metronome.current.start(bpm, beatsPerBar(song?.time));
  }, [bpm, song?.time, metronomeOn]);

  useEffect(() => writePlaylists(playlists), [playlists]);

  const openSong = (ref: SongRef) => {
    setCurrent(ref);
    // On phones the lyrics are below the list: bring them into view.
    if (window.innerWidth < 1024) setTimeout(() => articleRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
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
    if (!song || !book) return;
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
        p.id === target && !p.items.some((i) => i.book === book.id && i.number === song.number)
          ? { ...p, items: [...p.items, { book: book.id, number: song.number }] }
          : p
      )
    );
    setOpenPlaylist(target);
  };

  const updatePlaylist = (id: string, fn: (p: Playlist) => Playlist | null) =>
    setPlaylists((lists) => lists.map((p) => (p.id === id ? fn(p) : p)).filter((p): p is Playlist => p !== null));

  if (state === 'unavailable') {
    return (
      <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-8 flex items-start gap-3">
        <Lock className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">Buku Nyanyian</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Doding Haleluya, Kidung Jemaat, PKJ, dan NKB (berhak cipta) hanya tersedia di versi situs yang dilindungi kata sandi.
          </p>
        </div>
      </section>
    );
  }

  if (state === 'loading' || !data || !book || !song) {
    return (
      <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-8">
        <p className="text-sm text-stone-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat buku nyanyian...
        </p>
      </section>
    );
  }

  const isSmg = book.lang === 'smg';
  const keyIndex = parseKey(song.key);
  const lyricSize = FONT_SIZES[fontSize];
  const english = originalTitle(song.credits);
  const catName = song.category !== undefined ? categoryNames.get(song.category) : undefined;

  const songRow = (b: Book, s: Song, extra?: React.ReactNode) => {
    const active = b.id === book.id && s.number === song.number;
    return (
      <button
        key={b.id + s.number}
        onClick={() => openSong({ book: b.id, number: s.number })}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer flex gap-2 items-start ${
          active ? 'bg-[#9A3412] text-white' : 'hover:bg-[#F3EFE6] dark:hover:bg-stone-900 text-stone-800 dark:text-stone-200'
        }`}
      >
        <span className={`w-14 shrink-0 font-mono text-[11px] pt-0.5 ${active ? 'opacity-90' : 'text-stone-500'}`}>
          {b.id} {s.number}
        </span>
        <span className="flex-1 min-w-0">
          <span className="font-medium block">{s.title}</span>
          {extra}
        </span>
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

  const stanzaBlock = (st: Stanza, i: number, withGloss: boolean) => (
    <div key={i} className="flex gap-3">
      <span className="w-10 shrink-0 text-right text-sm font-bold text-[#9A3412] dark:text-amber-400 pt-1">{st.n}</span>
      <div className={`font-serif ${lyricSize} leading-relaxed text-stone-900 dark:text-stone-100 min-w-0`}>
        {st.lines.map((line, j) => (
          <div key={j} className="mb-0.5">
            <p>{renderLine(line)}</p>
            {withGloss && corpus && (
              <p className="font-sans text-sm text-stone-500 dark:text-stone-400 italic mb-1.5">{glossSimalungunLine(corpus, line)}</p>
            )}
          </div>
        ))}
      </div>
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

  return (
    <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Search across all books */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Music className="w-5 h-5 text-[#9A3412] dark:text-amber-400" /> Buku Nyanyian
          </h2>
          <p className="text-xs text-stone-500">
            {data.books.map((b) => `${b.id} ${b.songs.length}`).join(' · ')}
          </p>
        </div>
        <div className="relative">
          <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari lagu di semua buku: judul, lirik, atau nomor (KJ 92, DH 39)..."
            className="w-full min-h-[52px] pl-12 pr-10 py-3 text-base bg-[#FAF8F5] dark:bg-stone-900 rounded-2xl border border-stone-300/80 dark:border-stone-700 focus:outline-none focus:border-[#9A3412]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-500 cursor-pointer" aria-label="Hapus pencarian">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: search results / browse */}
        <aside className="lg:col-span-4 space-y-3 min-w-0">
          {searchHits ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-stone-500 px-1">
                {searchHits.length ? `${searchHits.length} lagu ditemukan` : 'Tidak ada lagu yang cocok.'}
              </div>
              <div className="max-h-[60vh] lg:max-h-[70vh] overflow-y-auto space-y-0.5 pr-1">
                {searchHits.map((h) =>
                  songRow(h.book, h.song, h.snippet ? <span className="block text-xs opacity-70 truncate">{h.snippet}</span> : null)
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-900">
                {(
                  [
                    ['songs', 'Buku'],
                    ['moods', 'Suasana'],
                    ['playlists', 'Daftar putar'],
                  ] as [Panel, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setPanel(id)}
                    className={`min-h-[36px] rounded-lg text-xs font-semibold cursor-pointer ${
                      panel === id ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs' : 'text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {panel === 'songs' && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {data.books.map((b) => (
                      <button key={b.id} onClick={() => openSong({ book: b.id, number: b.songs[0].number })} className={chip(b.id === book.id)} title={b.name}>
                        {b.id}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-stone-500 px-1">{book.name}</div>
                  <div className="max-h-[50vh] lg:max-h-[62vh] overflow-y-auto space-y-0.5 pr-1">
                    {book.songs.map((s) => songRow(book, s))}
                  </div>
                </>
              )}

              {panel === 'moods' && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {MOODS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setMood(m.id);
                          setCategory(null);
                        }}
                        className={chip(category === null && mood === m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <select
                    value={category ?? ''}
                    onChange={(e) => setCategory(e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full min-h-[40px] px-3 text-sm bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800"
                    aria-label="Kategori Doding Haleluya"
                  >
                    <option value="">Semua kategori dalam suasana ini</option>
                    {(data.categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {categoryLabel(c.name)}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-stone-500 px-1">{moodSongs.length} lagu Doding Haleluya</div>
                  <div className="max-h-[50vh] lg:max-h-[55vh] overflow-y-auto space-y-0.5 pr-1">
                    {dh &&
                      moodSongs.map((s) =>
                        songRow(dh, s, s.category !== undefined ? <span className="block text-[11px] opacity-70">{categoryLabel(categoryNames.get(s.category) ?? '')}</span> : null)
                      )}
                  </div>
                </>
              )}

              {panel === 'playlists' && (
                <div className="space-y-2">
                  {playlists.length === 0 && (
                    <p className="text-sm text-stone-600 dark:text-stone-400 px-1">
                      Belum ada daftar putar. Buka lagu, lalu pilih <strong>Tambah ke daftar putar</strong> untuk menyusun lagu ibadah.
                    </p>
                  )}
                  {playlists.map((p) => (
                    <div key={p.id} className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                      <div className="flex items-center gap-2 p-2.5 bg-[#FAF8F5] dark:bg-stone-900">
                        <button onClick={() => setOpenPlaylist(openPlaylist === p.id ? null : p.id)} className="flex-1 text-left cursor-pointer min-w-0">
                          <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">{p.name}</div>
                          <div className="text-[11px] text-stone-500">{p.items.length} lagu</div>
                        </button>
                        <button
                          onClick={() => p.items.length && setPresent({ queue: p.items, song: 0, stanza: 0 })}
                          disabled={!p.items.length}
                          className="w-9 h-9 rounded-full bg-[#9A3412] text-white flex items-center justify-center cursor-pointer disabled:opacity-40"
                          aria-label={`Putar ${p.name}`}
                        >
                          <Play className="w-4 h-4" />
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
                        <div className="p-1.5 space-y-0.5">
                          {p.items.map((ref, i) => {
                            const f = findSong(data, ref);
                            if (!f) return null;
                            return (
                              <div key={ref.book + ref.number} className="flex items-center gap-1">
                                <div className="flex-1 min-w-0">{songRow(f.book, f.song)}</div>
                                <button
                                  onClick={() =>
                                    updatePlaylist(p.id, (pl) => {
                                      const items = [...pl.items];
                                      [items[i - 1], items[i]] = [items[i], items[i - 1]];
                                      return { ...pl, items };
                                    })
                                  }
                                  disabled={i === 0}
                                  className="p-1.5 text-stone-500 cursor-pointer disabled:opacity-30"
                                  aria-label="Naikkan"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    updatePlaylist(p.id, (pl) => {
                                      const items = [...pl.items];
                                      [items[i + 1], items[i]] = [items[i], items[i + 1]];
                                      return { ...pl, items };
                                    })
                                  }
                                  disabled={i === p.items.length - 1}
                                  className="p-1.5 text-stone-500 cursor-pointer disabled:opacity-30"
                                  aria-label="Turunkan"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => updatePlaylist(p.id, (pl) => ({ ...pl, items: pl.items.filter((_, j) => j !== i) }))}
                                  className="p-1.5 text-stone-500 cursor-pointer"
                                  aria-label="Keluarkan dari daftar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                          {p.items.length === 0 && <p className="text-xs text-stone-500 p-2">Daftar ini masih kosong.</p>}
                        </div>
                      )}
                    </div>
                  ))}
                  <p className="text-[11px] text-stone-500 px-1">Daftar putar tersimpan di browser ini.</p>
                </div>
              )}
            </>
          )}
        </aside>

        {/* Right: the song */}
        <article ref={articleRef} className="lg:col-span-8 space-y-5 min-w-0 scroll-mt-4">
          <header className="space-y-2">
            <div className="text-xs font-semibold text-[#9A3412] dark:text-amber-400">
              {book.name} No. {song.number}
              {song.key ? ` · ${song.key}` : ''}
              {song.time ? ` · ${song.time}` : ''}
              {catName ? ` · ${categoryLabel(catName)}` : ''}
            </div>
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 leading-tight">{song.title}</h3>
            {song.credits && <p className="text-xs text-stone-500 leading-relaxed">{song.credits}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setPresent({ queue: [{ book: book.id, number: song.number }], song: 0, stanza: 0 })}
                className="min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white cursor-pointer flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Mode tampil
              </button>
              <a href={youtubeUrl(book, song)} target="_blank" rel="noreferrer" className={smallBtn}>
                <Youtube className="w-3.5 h-3.5" /> Dengarkan di YouTube
              </a>
              <select
                value=""
                onChange={(e) => e.target.value && addToPlaylist(e.target.value)}
                className="min-h-[36px] px-2.5 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 cursor-pointer"
                aria-label="Tambah ke daftar putar"
              >
                <option value="">＋ Tambah ke daftar putar</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="__new">Daftar putar baru...</option>
              </select>
              <button onClick={() => changeFont(-1)} className={smallBtn} aria-label="Perkecil huruf">
                <Minus className="w-3.5 h-3.5" /> A
              </button>
              <button onClick={() => changeFont(1)} className={smallBtn} aria-label="Perbesar huruf">
                <Plus className="w-3.5 h-3.5" /> A
              </button>
              {isSmg && (
                <button onClick={() => setShowGloss(!showGloss)} className={smallBtn}>
                  <Languages className="w-3.5 h-3.5" /> {showGloss ? 'Sembunyikan arti' : 'Arti per baris'}
                </button>
              )}
              <button onClick={() => downloadText(`${book.id}-${song.number}-${song.title}.txt`, songAsText(book, song))} className={smallBtn}>
                <Download className="w-3.5 h-3.5" /> Unduh lagu
              </button>
              <button
                onClick={() => downloadText(`${book.name}.txt`, book.songs.map((s) => songAsText(book, s)).join('\n----------------------------------------\n\n'))}
                className={smallBtn}
              >
                <Download className="w-3.5 h-3.5" /> Unduh buku
              </button>
            </div>
          </header>

          {/* Musician tools */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Nada dasar</div>
              {keyIndex === null ? (
                <p className="text-sm text-stone-600 dark:text-stone-400">Nada dasar tidak tercantum di buku.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setTranspose(transpose - 1)} className={smallBtn} aria-label="Turun setengah nada">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex-1 text-center">
                      <div className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">{keyName(keyIndex + transpose)}</div>
                      <div className="text-[11px] text-stone-500">
                        {transpose === 0 ? 'sesuai buku' : `${transpose > 0 ? '+' : ''}${transpose} semitone dari ${song.key}`}
                      </div>
                    </div>
                    <button onClick={() => setTranspose(transpose + 1)} className={smallBtn} aria-label="Naik setengah nada">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Alat B♭ (trompet, klarinet, sax tenor): {writtenKeyFor(keyIndex + transpose, 'Bb')} · Alat E♭ (sax alto):{' '}
                    {writtenKeyFor(keyIndex + transpose, 'Eb')} · Horn F: {writtenKeyFor(keyIndex + transpose, 'F')}
                  </p>
                </>
              )}
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Metronom · {beatsPerBar(song.time)} ketuk</div>
              <div className="flex items-center gap-2">
                <input type="range" min={40} max={160} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="flex-1 accent-[#9A3412]" aria-label="Tempo" />
                <span className="w-16 text-right text-sm font-semibold text-stone-800 dark:text-stone-200">{bpm} bpm</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleMetronome} className={smallBtn}>
                  <Timer className="w-3.5 h-3.5" /> {metronomeOn ? 'Berhenti' : 'Mulai'}
                </button>
                <div className="flex gap-1.5">
                  {Array.from({ length: beatsPerBar(song.time) }, (_, i) => (
                    <span key={i} className={`w-3 h-3 rounded-full ${beat === i ? (i === 0 ? 'bg-[#9A3412]' : 'bg-amber-500') : 'bg-stone-300 dark:bg-stone-700'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {wordInfo && (
            <div className="sticky top-2 z-10 p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#9A3412]/30 shadow-sm space-y-1.5">
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

          {/* Lyrics, side by side with the official counterpart when there is one */}
          {counterparts.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-4 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {book.id} {song.number} · {isSmg ? 'Simalungun' : 'Indonesia'}
                </div>
                {song.stanzas.map((st, i) => stanzaBlock(st, i, showGloss && isSmg))}
              </div>
              {counterparts.map(({ book: cb, song: cs }) => (
                <div key={cb.id + cs.number} className="space-y-4 min-w-0 xl:border-l xl:pl-6 border-stone-200 dark:border-stone-800">
                  <button
                    onClick={() => openSong({ book: cb.id, number: cs.number })}
                    className="text-xs font-semibold uppercase tracking-wide text-[#9A3412] dark:text-amber-400 hover:underline cursor-pointer text-left"
                  >
                    Padanan resmi: {cb.id} {cs.number} — {cs.title} →
                  </button>
                  {cs.stanzas.map((st, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-10 shrink-0 text-right text-sm font-bold text-stone-400 pt-1">{st.n}</span>
                      <div className={`font-serif ${lyricSize} leading-relaxed text-stone-700 dark:text-stone-300 min-w-0`}>
                        {st.lines.map((l, j) => (
                          <p key={j}>{l}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">{song.stanzas.map((st, i) => stanzaBlock(st, i, showGloss && isSmg))}</div>
          )}

          {isSmg && counterparts.length === 0 && (
            <p className="text-xs text-stone-500">
              Lagu ini tidak mencantumkan padanan resmi di KJ/PKJ/NKB. Pakai <strong>Arti per baris</strong> untuk terjemahan kata per kata
              otomatis dari korpus Alkitab (bukan lirik resmi). Kata dalam [kurung] belum ditemukan artinya.
            </p>
          )}

          <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-stone-200/80 dark:border-stone-800 text-[11px] text-stone-500">
            {english && (
              <a
                href={`https://hymnary.org/search?qu=${encodeURIComponent(english)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#9A3412] dark:text-amber-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Lirik asli / Inggris di Hymnary.org
              </a>
            )}
            <span>
              {book.name} © {book.copyright}. Untuk belajar pribadi. ·{' '}
              <a href="/__logout" className="underline">
                Keluar
              </a>
            </span>
          </footer>
        </article>
      </div>

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
            <button onClick={() => setPresent(null)} className={smallBtn} aria-label="Tutup mode tampil">
              <X className="w-4 h-4" />
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
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border-t border-stone-200 dark:border-stone-800">
            <button onClick={presPrev} className={smallBtn} disabled={present.song === 0 && present.stanza === 0}>
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>
            <button
              onClick={presNext}
              className={smallBtn}
              disabled={present.song === present.queue.length - 1 && present.stanza === presStanzas.length - 1}
            >
              Berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
