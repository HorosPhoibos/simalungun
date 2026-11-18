// Songbook data (private-data/songbooks.json, deployed only to the password-protected site),
// search, mood groups and playlists.

export interface Stanza {
  n: string;
  lines: string[];
}
export interface Song {
  number: string;
  title: string;
  key: string | null;
  time: string | null;
  credits: string | null;
  stanzas: Stanza[];
  refs?: SongRef[];
  category?: number;
}
export interface Book {
  id: string;
  name: string;
  lang: 'smg' | 'id';
  copyright: string;
  songs: Song[];
}
export interface SongRef {
  book: string;
  number: string;
}
export interface Songbooks {
  books: Book[];
  categories?: { id: number; name: string }[];
}

let loading: Promise<Songbooks> | null = null;

/** Thrown when the lyrics exist but need the password (Cloudflare site, not logged in). */
export class LoginRequiredError extends Error {}

export function loadSongbooks(): Promise<Songbooks> {
  if (!loading) {
    loading = fetch('data/songbooks.json')
      .then((r) => {
        if (r.status === 401) throw new LoginRequiredError('login required');
        if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('not available');
        return r.json();
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

// Indonesian labels for the GratiaNet categories (Simalungun names), where the meaning is clear.
export const CATEGORY_LABELS: Record<string, string> = {
  'Puji-pujian': 'Pujian',
  Tonggo: 'Doa',
  'Ari Minggu': 'Hari Minggu',
  'Partubuh ni Tuhan Jesus': 'Natal',
  'Tahun Baru': 'Tahun Baru',
  'Parmatei ni Tuhan Jesus': 'Sengsara & Kematian Yesus',
  'Parpuho ni Tuhan Jesus': 'Paskah',
  'Parnaik ni Tuhan Jesus': 'Kenaikan',
  'Parroh ni Tonduy Napansing': 'Pentakosta',
  Pandidion: 'Baptisan',
  'Manaksihon Haporsayaon': 'Pengakuan Iman / Sidi',
  Parunjukon: 'Pernikahan',
  Haporsayaon: 'Iman',
  'Harajaon ni Naibata': 'Kerajaan Allah',
  'Hasasapan ni Dousa': 'Pengampunan Dosa',
  Pangapohon: 'Penghiburan',
  Sogod: 'Pagi',
  'Laho Mangan': 'Sebelum Makan',
  Bodari: 'Malam',
  'Bodari ni Ari Sabtu': 'Sabtu Malam',
  'Bodari ni Ari Minggu': 'Minggu Malam',
  'Ajal ni Jolma': 'Kematian / Kedukaan',
  'Na Masa Magira': 'Akhir Zaman',
  Parujungan: 'Penutup',
  'Ni Dakdanak': 'Anak-anak',
  Psalmen: 'Mazmur',
};

// Mood shortcuts built from the categories (by name, so they survive id changes).
export const MOODS: { id: string; label: string; categories: string[] }[] = [
  {
    id: 'sukacita',
    label: 'Sukacita & Pujian',
    categories: ['Puji-pujian', 'Partubuh ni Tuhan Jesus', 'Parpuho ni Tuhan Jesus', 'Parnaik ni Tuhan Jesus', 'Tahun Baru'],
  },
  { id: 'duka', label: 'Kedukaan & Penghiburan', categories: ['Ajal ni Jolma', 'Pangapohon', 'Na Masa Magira'] },
  {
    id: 'doa',
    label: 'Doa & Renungan',
    categories: ['Tonggo', 'Sogod', 'Bodari', 'Bodari ni Ari Sabtu', 'Bodari ni Ari Minggu', 'Laho Mangan', 'Laho/dob Mangan'],
  },
  { id: 'minggu', label: 'Ibadah Minggu', categories: ['Ari Minggu', 'Pangarahon', 'Parujungan'] },
  {
    id: 'iman',
    label: 'Iman & Pertobatan',
    categories: ['Haporsayaon', 'Hasasapan ni Dousa', 'Harajaon ni Naibata', 'Manaksihon Haporsayaon', 'Paruntolon'],
  },
  {
    id: 'raya',
    label: 'Hari Raya Gereja',
    categories: [
      'Adventus',
      'Partubuh ni Tuhan Jesus',
      'Epiphanias',
      'Parmatei ni Tuhan Jesus',
      'Parpuho ni Tuhan Jesus',
      'Parnaik ni Tuhan Jesus',
      'Parroh ni Tonduy Napansing',
      'Trinitatis',
      'Horja Banggal Na Pansing',
    ],
  },
  {
    id: 'keluarga',
    label: 'Sakramen & Keluarga',
    categories: ['Pandidion', 'Parunjukon', 'Ni Dakdanak', 'Horja na Martohonan', 'Mangondoskon Tohonan'],
  },
];

export function categoryLabel(name: string): string {
  const id = CATEGORY_LABELS[name];
  return id && id !== name ? `${name} (${id})` : name;
}

// --- Search across all books -------------------------------------------------------

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// One typo (insert/delete/replace) is tolerated for words of 5+ letters.
function closeEnough(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

interface IndexedSong {
  book: Book;
  song: Song;
  title: string;
  titleWords: string[];
  text: string;
  words: Set<string>;
}

let index: IndexedSong[] | null = null;
let indexedFor: Songbooks | null = null;

function buildIndex(data: Songbooks): IndexedSong[] {
  if (index && indexedFor === data) return index;
  index = data.books.flatMap((book) =>
    book.songs.map((song) => {
      const title = norm(song.title);
      const text = norm(song.stanzas.map((s) => s.lines.join(' ')).join(' '));
      return { book, song, title, titleWords: title.split(' '), text, words: new Set(text.split(' ')) };
    })
  );
  indexedFor = data;
  return index;
}

export interface SearchHit {
  book: Book;
  song: Song;
  snippet: string | null;
}

/** "kj 92", "dh 39", "malam kudus", "porsaya", "sonang borngin" (typos tolerated). */
export function searchSongs(data: Songbooks, query: string, limit = 40): SearchHit[] {
  const q = norm(query);
  if (!q) return [];
  const all = buildIndex(data);

  // "KJ 92" / "dh 39" / "92"
  const numbered = q.match(/^(dh|kj|pkj|nkb)?\s*(\d+[a-z]?)$/);
  if (numbered) {
    const [, bookId, num] = numbered;
    return all
      .filter((s) => (!bookId || s.book.id.toLowerCase() === bookId) && s.song.number.toLowerCase().startsWith(num))
      .sort((a, b) => Number(a.song.number.toLowerCase() !== num) - Number(b.song.number.toLowerCase() !== num))
      .slice(0, limit)
      .map(({ book, song }) => ({ book, song, snippet: null }));
  }

  const terms = q.split(' ');
  const scored: { s: IndexedSong; score: number }[] = [];
  for (const s of all) {
    let score = 0;
    let ok = true;
    for (const t of terms) {
      if (s.title.includes(t)) score += 10;
      else if (s.text.includes(t)) score += 3;
      else if (s.titleWords.some((w) => closeEnough(t, w))) score += 6;
      else if (t.length >= 5 && [...s.words].some((w) => closeEnough(t, w))) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (s.title.startsWith(q)) score += 20;
    if (s.text.includes(q) && terms.length > 1) score += 8;
    scored.push({ s, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ s }) => ({ book: s.book, song: s.song, snippet: findSnippet(s.song, terms) }));
}

function findSnippet(song: Song, terms: string[]): string | null {
  for (const st of song.stanzas) {
    for (const line of st.lines) {
      const n = norm(line);
      if (terms.some((t) => n.includes(t))) return line;
    }
  }
  return null;
}

// --- Playlists (kept in this browser) --------------------------------------------------

export interface Playlist {
  id: string;
  name: string;
  items: SongRef[];
}

const PLAYLIST_KEY = 'pustaha_playlists';

export function readPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(PLAYLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writePlaylists(lists: Playlist[]) {
  try {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(lists));
  } catch {
    // storage may be unavailable (private mode)
  }
}

export function findSong(data: Songbooks, ref: SongRef): { book: Book; song: Song } | null {
  const book = data.books.find((b) => b.id === ref.book);
  const song = book?.songs.find((s) => s.number === ref.number);
  return book && song ? { book, song } : null;
}
