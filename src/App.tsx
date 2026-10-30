import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  Mic,
  Camera,
  Volume2,
  Search,
  FileText,
  Upload,
  RefreshCw,
  Copy,
  Check,
  Plus,
  ExternalLink,
  Moon,
  Sun,
  Square,
  X,
  Users,
  Music,
  Zap,
  Sparkles,
  UserPlus,
  ChevronRight,
  ChevronDown,
  Trash2,
  SlidersHorizontal,
  MessageCircleHeart,
  HelpCircle,
  Globe,
  Save,
  Bookmark,
  ShieldCheck,
} from 'lucide-react';
import {
  SIMALUNGUN_LEXICON,
  VIDEO_REFERENCES,
  SAMPLE_CAMERA_DOCUMENTS,
  NATURAL_PHRASEBOOK,
  DictionaryEntry,
  LexiconCategory,
  PartOfSpeech,
  SampleCameraDocument,
} from './data/simalungunCorpus';
import {
  MARGA_SISADAPUR,
  POPULAR_TOBA_KARO_MARGAS,
  PARTUTURAN_DIRECTORY,
  HYMN_CONCORDANCE_LIST,
  EXTERNAL_REFERENCES,
  MargaUtama,
} from './data/partuturanAndHymns';
import {
  BibleCorpus,
  findVerseByReference,
  getLoadedBibleCorpus,
  loadBibleCorpus,
  lookupIndonesianWord,
  lookupSimalungunWord,
  searchVerses,
  verseReference,
} from './bibleCorpus';
import BibleCorpusExplorer from './components/BibleCorpusExplorer';

// On static hosts like GitHub Pages there is no /api server, so a request returns an HTML 404 page.
// Turn that into a readable message instead of a JSON parse error.
const STATIC_HOST_AI_MESSAGE =
  'Fitur AI ini membutuhkan server (npm run dev). Di versi statis (GitHub Pages) gunakan mode Instan/Offline.';

async function readApiJson(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(STATIC_HOST_AI_MESSAGE);
  }
  return response.json();
}

type DashboardMode =
  | 'text-lexicon'
  | 'partuturan-adat'
  | 'voice-translate'
  | 'camera-ocr'
  | 'doding-video';

interface TextTranslationResponse {
  detectedSourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  naturalCasualVersion?: string;
  politeFormalVersion?: string;
  phoneticGuide: string;
  dialectComparison: {
    raya: string;
    silimakuta: string;
    topiPasir: string;
    jaheJahe: string;
    linguisticNote: string;
  };
  wordBreakdown: {
    word: string;
    meaning: string;
    partOfSpeech: string;
    morphologyNote: string;
  }[];
  relatedBibleParallel: {
    reference: string;
    simalungunVerse: string;
    indonesianVerse: string;
  };
}

interface SavedTranslationCacheItem {
  id: string;
  sourceText: string;
  translatedText: string;
  direction: string;
  style: string;
  createdAt: string;
}

interface PdfSearchHit {
  docId: string;
  docTitle: string;
  snippet: string;
}

interface VoiceTranslationResponse {
  rawTranscript: string;
  correctedTranscript: string;
  detectedLanguage: string;
  translatedText: string;
  simalungunTextToSpeak: string;
  phoneticGuide: string;
  dialectNote: string;
  wordBreakdown: {
    word: string;
    meaning: string;
    partOfSpeech: string;
  }[];
}

interface VisionDetectedRegion {
  id: string;
  box_2d: [number, number, number, number];
  sourceText: string;
  translatedText: string;
  detectedLanguage: string;
}

interface VisionTranslationResponse {
  summaryTitle: string;
  fullSourceText: string;
  fullTranslatedText: string;
  detectedRegions: VisionDetectedRegion[];
  vocabularyBreakdown: {
    word: string;
    meaning: string;
    partOfSpeech: string;
    dialectNote: string;
  }[];
}

// Helper to get main Marga clan ('Sinaga' | 'Saragih' | 'Damanik' | 'Purba' | null)
// Supports both Simalungun SISADAPUR and plain-text Toba/Karo/Pakpak margas!
function getMainMarga(margaStr: string): MargaUtama | null {
  if (!margaStr || !margaStr.trim()) return null;
  const lower = margaStr.toLowerCase().trim();
  if (lower === 'tidak diketahui' || lower === '-') return null;

  if (
    lower.includes('sinaga') ||
    lower.includes('sipayung') ||
    lower.includes('haloho') ||
    lower.includes('silalahi') ||
    lower.includes('sitanggang') ||
    lower.includes('sigalingging') ||
    lower.includes('perangin')
  ) {
    return 'Sinaga';
  }
  if (
    lower.includes('saragih') ||
    lower.includes('sumbayak') ||
    lower.includes('garingging') ||
    lower.includes('dasalak') ||
    lower.includes('dajawak') ||
    lower.includes('simarmata') ||
    lower.includes('turnip') ||
    lower.includes('sitio') ||
    lower.includes('simanihuruk') ||
    lower.includes('sidabalok') ||
    lower.includes('munthe') ||
    lower.includes('ginting') ||
    lower.includes('tarigan')
  ) {
    return 'Saragih';
  }
  if (
    lower.includes('damanik') ||
    lower.includes('malau') ||
    lower.includes('manik') ||
    lower.includes('gurning') ||
    lower.includes('ambarita') ||
    lower.includes('lambe')
  ) {
    return 'Damanik';
  }
  if (
    lower.includes('purba') ||
    lower.includes('tambak') ||
    lower.includes('sigumonrong') ||
    lower.includes('siboro') ||
    lower.includes('sidagambir') ||
    lower.includes('manorsa') ||
    lower.includes('sidadolog') ||
    lower.includes('simamora') ||
    lower.includes('manalu') ||
    lower.includes('debatara') ||
    lower.includes('sembiring') ||
    lower.includes('karo-karo')
  ) {
    return 'Purba';
  }
  return null;
}

function formatMargaLabel(margaStr: string): string {
  if (!margaStr || !margaStr.trim() || margaStr === 'Tidak Diketahui') return '-';
  const main = getMainMarga(margaStr);
  if (main) {
    return margaStr.toLowerCase().includes(main.toLowerCase())
      ? margaStr.trim()
      : `${margaStr.trim()} (Jalur ${main})`;
  }
  return `${margaStr.trim()} (Marga Toba/Lainnya)`;
}

function areMargasSameOrAffiliated(m1: string, m2: string): boolean {
  const c1 = m1.trim().toLowerCase().replace(/^boru\s+/i, '');
  const c2 = m2.trim().toLowerCase().replace(/^boru\s+/i, '');
  if (!c1 || !c2 || c1 === 'tidak diketahui' || c2 === 'tidak diketahui') return false;
  if (c1 === c2) return true;
  const main1 = getMainMarga(c1);
  const main2 = getMainMarga(c2);
  if (main1 && main2 && main1 === main2) return true;
  // Check if first word of plain-text Toba marga matches (e.g. "Simanjuntak Sitombuk" vs "Simanjuntak")
  const first1 = c1.split(/\s+/)[0];
  const first2 = c2.split(/\s+/)[0];
  if (first1.length >= 4 && first1 === first2) return true;
  return false;
}

// Instant 0ms Smart Question Resolver for Partuturan
interface QuickKinshipAnswer {
  keywords: string[];
  questionLabel: string;
  sapaanLaki: string;
  sapaanPerempuan: string;
  balasan: string;
  posisiAdat: string;
  contohKalimat: string;
  artiKalimat: string;
  penjelasan: string;
}

const INSTANT_PARTUTURAN_QA: QuickKinshipAnswer[] = [
  {
    keywords: ['bapatua', 'bapa tua', 'inangtua', 'inang tua', 'abang bapak', 'pakde', 'uwa'],
    questionLabel: 'Bapa Tua (Bapatua) & Inang Tua — Abang Kandung/Semarga dari Bapak & Istrinya',
    sapaanLaki: 'Bapa Tua (Bapatua) & Inang Tua (Inangtua)',
    sapaanPerempuan: 'Bapa Tua (Bapatua) & Inang Tua (Inangtua)',
    balasan: 'Anak (Laki-laki) / Boru (Perempuan)',
    posisiAdat: 'Sanina (Orang Tua Se-Marga di Atas Ayah)',
    contohKalimat: 'Horas Bapatua, sehat-sehat do ham pakon Inangtua i rumah?',
    artiKalimat: 'Horas Bapa Tua (Pakde), sehat-sehatnya Bapak dan Ibu (Inang Tua) di rumah?',
    penjelasan:
      'Abang kandung atau abang semarga dari ayah kita disapa "Bapa Tua (Bapatua)" (Kamus Balai Bahasa hal. 22), dan istrinya disapa "Inang Tua (Inangtua)". Kakak perempuan dari ibu kandung juga disapa "Inang Tua" dan suaminya "Bapa Tua".',
  },
  {
    keywords: ['bapatongah', 'bapa tongah', 'inangtongah', 'inang tongah', 'saudara tengah bapak'],
    questionLabel: 'Bapa Tongah (Bapatongah) & Inang Tongah — Saudara Laki-laki Urutan Tengah dari Bapak',
    sapaanLaki: 'Bapa Tongah (Bapatongah) & Inang Tongah (Inangtongah)',
    sapaanPerempuan: 'Bapa Tongah (Bapatongah) & Inang Tongah (Inangtongah)',
    balasan: 'Anak (Laki-laki) / Boru (Perempuan)',
    posisiAdat: 'Sanina (Orang Tua Se-Marga Urutan Tengah)',
    contohKalimat: 'Horas Bapatongah, domma mangan ham pakon Inangtongah?',
    artiKalimat: 'Horas Bapa Tongah, sudah makan Bapak bersama Inang Tongah?',
    penjelasan:
      'Dalam keluarga Simalungun yang memiliki tiga atau lebih bersaudara, saudara laki-laki ayah yang berada di urutan tengah disapa "Bapa Tongah (Bapatongah)" (Kamus hal. 22) dan istrinya disapa "Inang Tongah (Inangtongah)".',
  },
  {
    keywords: ['bapanggi', 'bapa anggi', 'amburu', 'inanggi', 'inang anggi', 'adik bapak', 'om dari bapak', 'bapa uda'],
    questionLabel: 'Bapa Anggi (Bapanggi / Amburu) & Inang Anggi — Adik Laki-laki dari Bapak & Istrinya',
    sapaanLaki: 'Bapa Anggi (Bapanggi / Amburu) & Inang Anggi (Inanggi)',
    sapaanPerempuan: 'Bapa Anggi (Bapanggi / Amburu) & Inang Anggi (Inanggi)',
    balasan: 'Anak (Laki-laki) / Boru (Perempuan)',
    posisiAdat: 'Sanina (Orang Tua Se-Marga di Bawah Ayah)',
    contohKalimat: 'Horas Bapanggi, roh ma ham pakon Inanggi hu rumah nami!',
    artiKalimat: 'Horas Bapanggi (Pakcik), datanglah Bapak dan Inanggi ke rumah kami!',
    penjelasan:
      'Adik laki-laki dari ayah kandung/semarga disapa "Bapa Anggi (Bapanggi)" atau "Amburu" (Kamus Balai Bahasa hal. 8 & 22), sedangkan istrinya disapa "Inang Anggi (Inanggi)". Adik perempuan dari ibu kandung juga disapa "Inang Anggi".',
  },
  {
    keywords: ['mama istri', 'ibu istri', 'mama pacar', 'ibu pacar', 'ibu mertua', 'mama mertua', 'anturang'],
    questionLabel: 'Mama dari Istri / Pacar (Ibu Mertua bagi Laki-laki)',
    sapaanLaki: 'Anturang (Inang Simatua)',
    sapaanPerempuan: 'Amboru / Inang (Ibu dari Suami)',
    balasan: 'Hela (Menantu Laki-laki) / Parumaen (Menantu Perempuan)',
    posisiAdat: 'Tondong Jabu (Pihak yang Sangat Dihormati)',
    contohKalimat: 'Horas Anturang, sehat-sehat do ham i rumah, tene?',
    artiKalimat: 'Horas Anturang (Mama), sehat-sehatnya Ibu di rumah, ya kan?',
    penjelasan:
      'Bagi laki-laki Simalungun, ibu dari istri/pacar wajib disapa "Anturang" (karena beliau adalah istri dari Tulang). Gunakan kata ganti sopan "Ham".',
  },
  {
    keywords: ['bapak istri', 'ayah istri', 'bapak pacar', 'ayah pacar', 'bapak mertua', 'ayah mertua', 'tulang'],
    questionLabel: 'Bapak dari Istri / Pacar (Ayah Mertua bagi Laki-laki)',
    sapaanLaki: 'Tulang (Bapa Simatua)',
    sapaanPerempuan: 'Makkela / Amangboru (Ayah dari Suami)',
    balasan: 'Hela (Menantu Laki-laki) / Parumaen (Menantu Perempuan)',
    posisiAdat: 'Tondong Jabu (Pihak Pemberi Berkat)',
    contohKalimat: 'Horas Tulang, domma mangan ham, Tulang?',
    artiKalimat: 'Horas Tulang (Bapak), sudah makan Bapak?',
    penjelasan:
      'Ayah dari istri/pacar disapa "Tulang" karena dalam adat Simalungun pernikahan ideal adalah dengan boru ni tulang (pariban). Bagi perempuan, ayah dari suami disapa "Makkela".',
  },
  {
    keywords: ['opung istri', 'ompung istri', 'kakek istri', 'nenek istri', 'opung pacar', 'ompung dari mama istri', 'ompung mertua'],
    questionLabel: 'Ompung dari Istri / Pacar (Kakek/Nenek dari Istri atau dari Mama Istri — 2 Tingkat ke Atas)',
    sapaanLaki: 'Ompung (Ompung Tondong / Tulang Matua)',
    sapaanPerempuan: 'Ompung',
    balasan: 'Pahompu (Cucu) / Hela',
    posisiAdat: 'Tondong / Tondong ni Tondong (Leluhur Lapis Kedua)',
    contohKalimat: 'Horas Ompung, sai sehat-sehat ma ham anjaha ganjang umurmu, da Ompung!',
    artiKalimat: 'Horas Ompung, semoga sehat-sehat dan panjang umur Ompung, ya!',
    penjelasan:
      'Baik kakek/nenek kandung istri (dari pihak bapak istri) maupun orang tua dari mama istri (Tondong ni Tondong) disapa dengan penuh hormat sebagai "Ompung".',
  },
  {
    keywords: ['abang mama istri', 'adik mama istri', 'paman istri', 'tulang istri', 'saudara mama istri'],
    questionLabel: 'Abang / Adik Laki-laki dari Mama Istri (Tulang dari Istri Kita)',
    sapaanLaki: 'Tulang (Tondong ni Tondong)',
    sapaanPerempuan: 'Tulang',
    balasan: 'Hela / Bere',
    posisiAdat: 'Tondong ni Tondong (Pemberi Berkat Tertinggi dalam Lima Saodoran)',
    contohKalimat: 'Horas Tulang, diatei tupa ma bani pasu-pasu ni nasiam.',
    artiKalimat: 'Horas Tulang, terima kasih atas berkat dan doa dari Tulang sekalian.',
    penjelasan:
      'Saudara laki-laki dari Mama Mertua adalah Tulang kandung dari istri Anda (Tondong ni Tondong). Anda menyapa beliau "Tulang" dan istrinya disapa "Anturang".',
  },
  {
    keywords: ['abang istri', 'adik laki istri', 'ipar laki', 'abang pacar', 'adik pacar', 'suami kakak', 'suami adik', 'lawei', 'lae'],
    questionLabel: 'Abang / Adik Laki-laki dari Istri (Ipar) atau Suami dari Saudari Perempuan',
    sapaanLaki: 'Lawei (Lae)',
    sapaanPerempuan: 'Nasikaha (Abang Suami) / Nasianggi (Adik Laki-laki Suami)',
    balasan: 'Lawei / Nasianggi / Nasikaha',
    posisiAdat: 'Tondong (Jika Abang/Adik Istri) · Anak Boru (Jika Suami Saudari Kita)',
    contohKalimat: 'Horas Lawei, i ja do ham sonari? Eta mangopi lobei hita!',
    artiKalimat: 'Horas Lawei (Ipar), di mana posisi Anda sekarang? Ayo ngopi dulu kita!',
    penjelasan:
      'Sesama laki-laki yang beripar saling memanggil "Lawei". Ingat: abang/adik laki-laki istri berkedudukan sebagai Tondong (dihormati), sedangkan istri dari abang/adik istri disapa "Inang / Anturang Naposo"!',
  },
  {
    keywords: ['istri abang ipar', 'istri dari abang istri', 'istri lawei', 'anturang naposo'],
    questionLabel: 'Istri dari Abang / Adik Laki-laki Istri (Istri dari Lawei Pihak Istri)',
    sapaanLaki: 'Inang / Anturang Naposo',
    sapaanPerempuan: 'Eda / Gawei / Kakak',
    balasan: 'Hela / Amang / Eda',
    posisiAdat: 'Tondong (Penerus Peran Anturang)',
    contohKalimat: 'Horas Inang, sehat-sehat do Lawei pakon dakdanak i rumah?',
    artiKalimat: 'Horas Inang, sehat-sehatnya Lawei bersama anak-anak di rumah?',
    penjelasan:
      'Dalam adat Simalungun, istri dari saudara laki-laki istri Anda adalah calon penerus mertua perempuan (Tondong), sehingga wajib disapa sopan dengan "Inang" atau "Anturang" (pantang bercanda sembarangan).',
  },
  {
    keywords: ['kakak perempuan istri', 'adik perempuan istri', 'kakak pacar', 'adik perempuan pacar', 'eda', 'gawei', 'pariban'],
    questionLabel: 'Kakak / Adik Perempuan dari Istri atau Saudara Perempuan dari Suami',
    sapaanLaki: 'Kaha / Kakak (Kakak Istri) · Anggi (Adik Istri)',
    sapaanPerempuan: 'Eda / Gawei (Saudari Perempuan Suami)',
    balasan: 'Anggi / Kaha / Eda',
    posisiAdat: 'Sanina Sapanganonkon / Pariban',
    contohKalimat: 'Horas Kak/Eda, sonaha do kabar ni keluarga i huta?',
    artiKalimat: 'Horas Kak/Eda, bagaimana kabar keluarga di kampung?',
    penjelasan:
      'Bagi laki-laki, kakak perempuan istri disapa "Kaha / Kakak" dan adik perempuan istri disapa "Anggi" (suami mereka adalah Pariban Anda). Bagi perempuan, saudari suami disapa "Eda / Gawei".',
  },
  {
    keywords: ['istri abang', 'istri dari abang kandung', 'abang suami', 'nasikaha', 'nasianggi', 'istri adik'],
    questionLabel: 'Istri dari Abang Kandung (Bagi Laki-laki) atau Abang dari Suami (Bagi Perempuan)',
    sapaanLaki: 'Nasikaha / Kaha (Istri Abang) · Nasianggi (Istri Adik)',
    sapaanPerempuan: 'Nasikaha / Kaha (Abang dari Suami) · Nasianggi (Adik dari Suami)',
    balasan: 'Nasianggi / Nasikaha',
    posisiAdat: 'Sanina (Hubungan Marnasikaha — Wajib Sangat Sopan)',
    contohKalimat: 'Santabi Kaha, domma mangan nasiam?',
    artiKalimat: 'Permisi Kakak Ipar (Nasikaha), sudah makan kalian?',
    penjelasan:
      'Hubungan antara seorang laki-laki dengan istri abangnya (atau seorang istri dengan abang suaminya) disebut "Marnasikaha". Dalam adat Simalungun, hubungan ini memiliki tata krama kesopanan yang sangat tinggi.',
  },
  {
    keywords: ['kakak bapak', 'adik perempuan bapak', 'bibi', 'tante dari bapak', 'amboru', 'makkela', 'suami bibi'],
    questionLabel: 'Kakak / Adik Perempuan dari Bapak (Bibi) & Suaminya',
    sapaanLaki: 'Amboru (Bibi) & Makkela (Suaminya)',
    sapaanPerempuan: 'Amboru & Makkela',
    balasan: 'Anak / Boru / Parumaen',
    posisiAdat: 'Boru / Anak Boru Jabu (Pihak yang Diayomi)',
    contohKalimat: 'Horas Amboru pakon Makkela, roh ma nasiam hu rumah nami!',
    artiKalimat: 'Horas Bibi (Amboru) dan Paman (Makkela), datanglah kalian ke rumah kami!',
    penjelasan:
      'Saudara perempuan dari ayah kandung disapa "Amboru" (Kamus hal. 7) dan suaminya disapa "Makkela" (hal. 86). Putra/putri mereka adalah pariban/lawei kita.',
  },
  {
    keywords: ['orang tua menantu', 'besan', 'bajo'],
    questionLabel: 'Orang Tua dari Menantu (Hubungan Antar Orang Tua Suami & Istri)',
    sapaanLaki: 'Besan (Bajo / Nasibesan)',
    sapaanPerempuan: 'Besan (Bajo)',
    balasan: 'Besan',
    posisiAdat: 'Tondong (Orang Tua Pengantin Wanita) ↔ Anak Boru (Orang Tua Pengantin Pria)',
    contohKalimat: 'Horas Besan, hundul ma nasiam bani lobei on!',
    artiKalimat: 'Horas Besan, silakan duduk di bagian depan ini!',
    penjelasan:
      'Dalam adat Simalungun, orang tua dari menantu perempuan berkedudukan sebagai Tondong, sedangkan orang tua dari menantu laki-laki berkedudukan sebagai Anak Boru.',
  },
];

// Instant 0ms Local Offline Translator Engine (100% Verbatim Bibel Simalungun 2007 PDF)
function translateOfflineInstant(
  rawText: string,
  direction: 'auto' | 'id-to-smg' | 'smg-to-id',
  style: 'santai' | 'sopan' | 'alkitab',
  allLexicon: DictionaryEntry[]
): TextTranslationResponse {
  const cleanInput = rawText.trim().toLowerCase();
  const corpus = getLoadedBibleCorpus();

  // A Bible reference ("Yohanes 3:16", "1 Musa 1:1-3") returns the verbatim parallel verses.
  const refHits = corpus ? findVerseByReference(corpus, rawText) : null;
  if (corpus && refHits) {
    const reference = verseReference(corpus, refHits[0]) + (refHits.length > 1 ? ` – ${refHits[refHits.length - 1][2]}` : '');
    const smgText = refHits.map((v) => v[3]).join(' ');
    const idnText = refHits.map((v) => v[4]).join(' ');
    const isIdnTarget = direction !== 'id-to-smg';
    return {
      detectedSourceLanguage: 'Referensi Ayat',
      targetLanguage: isIdnTarget ? 'Indonesia (Alkitab TB)' : 'Simalungun (Bibel 2007)',
      translatedText: isIdnTarget ? idnText : smgText,
      naturalCasualVersion: smgText,
      politeFormalVersion: smgText,
      phoneticGuide: smgText.toLowerCase().replace(/[^a-zà-ÿ\s-]/g, '').replace(/\s+/g, ' · '),
      dialectComparison: {
        raya: smgText,
        silimakuta: smgText,
        topiPasir: smgText,
        jaheJahe: smgText,
        linguisticNote: `Kutipan verbatim dari korpus paralel Bibel Simalungun 2007 ↔ Alkitab TB — ${reference}.`,
      },
      wordBreakdown: smgText
        .split(/\s+/)
        .map((w) => lookupSimalungunWord(corpus, w))
        .filter((r): r is NonNullable<typeof r> => Boolean(r && r.candidates.length && r.confidence !== 'rendah'))
        .filter((r, i, arr) => arr.findIndex((x) => x.matchedWord === r.matchedWord) === i)
        .slice(0, 12)
        .map((r) => ({
          word: r.matchedWord,
          meaning: r.candidates.slice(0, 2).map((c) => c.indonesian).join(' / '),
          partOfSpeech: 'korpus',
          morphologyNote: `Statistik korpus Alkitab (${r.frequency}× , keyakinan ${r.confidence})`,
        })),
      relatedBibleParallel: { reference, simalungunVerse: smgText, indonesianVerse: idnText },
    };
  }

  // Check if user typed Genesis 1:1 / 1 Musa 1:1 / Kejadian 1:1
  if (
    cleanInput.includes('1 musa 1:1') ||
    cleanInput.includes('kejadian 1:1') ||
    cleanInput.includes('bani mula ni mulani') ||
    cleanInput.includes('pada mulanya allah menciptakan')
  ) {
    const isInputSmg = cleanInput.includes('bani mula ni mulani');
    return {
      detectedSourceLanguage: isInputSmg ? 'Simalungun (Verbatim Bibel PDF)' : 'Indonesia (Verbatim Alkitab TB)',
      targetLanguage: isInputSmg ? 'Indonesia (Alkitab TB)' : 'Simalungun (Verbatim Bibel PDF 2007)',
      translatedText: isInputSmg
        ? 'Pada mulanya Allah menciptakan langit dan bumi.'
        : 'Bani mula ni mulani itompa Naibata ma langit pakon tanoh.',
      naturalCasualVersion: 'Bani mula ni mulani itompa Naibata ma langit pakon tanoh.',
      politeFormalVersion: 'Bani mula ni mulani itompa Naibata ma langit pakon tanoh.',
      phoneticGuide: 'ba-ni · mu-la · ni · mu-la-ni · i-tom-pa · nai-ba-ta · ma · la-ngit · pa-kon · ta-noh',
      dialectComparison: {
        raya: 'Bani mula ni mulani itompa Naibata ma langit pakon tanoh.',
        silimakuta: 'Bani mula ni mulani itompa Naibata ma langit pakon tanoh.',
        topiPasir: 'Bani mula ni mulani itompa Naibata ma langit pakon tanoh.',
        jaheJahe: 'Bani mula ni mulani itompa Naibata ma langit pakon tanoh.',
        linguisticNote:
          'Kutipan 100% verbatim dari dokumen PDF Alkitab Bahasa Batak Simalungun (Lembaga Alkitab Indonesia, 2007) — 1 Musa (Kejadian) 1:1.',
      },
      wordBreakdown: [
        {
          word: 'Bani mula ni mulani',
          meaning: 'Pada mulanya',
          partOfSpeech: 'frasa',
          morphologyNote: 'Verbatim 1 Musa 1:1 (PDF Bibel Simalungun hal. 2)',
        },
        {
          word: 'itompa Naibata',
          meaning: 'diciptakan Allah (Naibata)',
          partOfSpeech: 'kk + kb',
          morphologyNote: 'i- (pasif) + tompa (cipta)',
        },
        {
          word: 'langit pakon tanoh',
          meaning: 'langit dan bumi',
          partOfSpeech: 'kb',
          morphologyNote: 'pakon = dan / beserta',
        },
      ],
      relatedBibleParallel: {
        reference: 'Kejadian 1:1 (1 Musa 1:1 — Verbatim PDF Bibel Simalungun)',
        simalungunVerse: 'Bani mula ni mulani itompa Naibata ma langit pakon tanoh.',
        indonesianVerse: 'Pada mulanya Allah menciptakan langit dan bumi.',
      },
    };
  }

  const matchedPhrase = NATURAL_PHRASEBOOK.find(
    (p) =>
      cleanInput === p.indonesian.toLowerCase() ||
      cleanInput.includes(p.indonesian.toLowerCase()) ||
      p.simalungunNatural.toLowerCase().includes(cleanInput)
  );

  if (matchedPhrase) {
    const isInputIndo = cleanInput.includes(matchedPhrase.indonesian.toLowerCase());
    const mainOutput = isInputIndo
      ? style === 'sopan'
        ? matchedPhrase.simalungunPolite
        : matchedPhrase.simalungunNatural
      : matchedPhrase.indonesian;

    return {
      detectedSourceLanguage: isInputIndo ? 'Indonesia (Instan 0ms)' : 'Simalungun (Instan 0ms)',
      targetLanguage: isInputIndo ? 'Simalungun Alami' : 'Indonesia',
      translatedText: mainOutput,
      naturalCasualVersion: matchedPhrase.simalungunNatural,
      politeFormalVersion: matchedPhrase.simalungunPolite,
      phoneticGuide: matchedPhrase.phonetic,
      dialectComparison: {
        raya: matchedPhrase.simalungunNatural,
        silimakuta: matchedPhrase.simalungunNatural
          .replace(/\bHam\b/gi, 'Kam')
          .replace(/\bDomma\b/gi, 'Enggo'),
        topiPasir: matchedPhrase.simalungunPolite,
        jaheJahe: matchedPhrase.simalungunNatural,
        linguisticNote: matchedPhrase.note,
      },
      wordBreakdown: [
        {
          word: matchedPhrase.simalungunNatural.split(' ')[0],
          meaning: matchedPhrase.indonesian,
          partOfSpeech: 'ungkapan',
          morphologyNote: matchedPhrase.note,
        },
      ],
      relatedBibleParallel: {
        reference: 'Amsal 15:1 (Podah 15:1 — Verbatim PDF Bibel Simalungun)',
        simalungunVerse: 'Balos na lamlam pahombun ringis, tapi hata na kasar mamuhoi gila.',
        indonesianVerse:
          'Jawaban yang lemah lembut meredakan kegeraman, tetapi perkataan yang pedas membangkitkan marah.',
      },
    };
  }

  const indoToSmgMap: Record<string, string> = {
    aku: 'au',
    saya: 'ahu',
    kamu: style === 'sopan' ? 'ham' : 'ho',
    anda: 'ham',
    kalian: 'nasiam',
    dia: 'ia',
    kita: 'hita',
    kami: 'hanami',
    mereka: 'sidea',
    sudah: 'domma',
    udah: 'domma',
    belum: 'lape',
    tidak: 'lang',
    gak: 'lang',
    nggak: 'seng',
    jangan: 'ulang',
    makan: 'mangan',
    minum: 'minum',
    tidur: 'modom',
    pergi: 'laho',
    pulang: 'mulak',
    datang: 'roh',
    kerja: 'marhorja',
    bekerja: 'marhorja',
    sayang: 'holong',
    cinta: 'holong',
    kangen: 'marsihol',
    rindu: 'marsihol',
    marah: 'manggila',
    ngambek: 'margoni',
    merajuk: 'mardandi',
    cantik: 'jenges',
    manis: 'jenges',
    bagus: 'dear',
    baik: 'bujur',
    enak: 'taboh',
    capek: 'loja',
    lelah: 'loja',
    lapar: 'loheian',
    haus: 'horahan',
    kenyang: 'bosur',
    pasar: 'tiga',
    rumah: 'jabu',
    air: 'bah',
    nasi: 'indahan',
    sayur: 'lompah',
    uang: 'duit',
    hati: 'uhur',
    sekali: 'tumang',
    banget: 'tumang',
    saja: 'mando',
    cuma: 'pitah',
    apa: 'aha',
    kenapa: 'mahua',
    bagaimana: 'sonaha',
    dimana: 'i ja',
    kemana: 'huja',
    besok: 'patar',
    kemarin: 'nantuari',
    sekarang: 'sonari',
    hari: 'ari',
    ini: 'on',
    itu: 'ai',
    ya: 'da',
    kan: 'tene',
    ayo: 'eta',
    mari: 'eta',
    terima: 'diatei',
    kasih: 'tupa',
    ayah: 'bapa',
    bapak: 'bapa',
    ibu: 'inang',
    mama: 'inang',
    adik: 'anggi',
    abang: 'abang',
    ipar: 'lawei',
    paman: 'tulang',
    bibi: 'amboru',
    kakek: 'ompung',
    nenek: 'ompung',
    pakde: 'bapatua',
    pakcik: 'bapanggi',
  };

  const smgToIndoMap: Record<string, string> = {};
  Object.entries(indoToSmgMap).forEach(([idn, smg]) => {
    smgToIndoMap[smg.toLowerCase()] = idn;
  });
  allLexicon.forEach((entry) => {
    const cleanSmg = entry.simalungun.toLowerCase().split('/')[0].trim();
    const cleanIdn = entry.indonesian.toLowerCase().split(';')[0].split('/')[0].trim();
    smgToIndoMap[cleanSmg] = entry.indonesian;
    indoToSmgMap[cleanIdn] = entry.simalungun.split('/')[0].trim();
  });

  const tokens = rawText.split(/\s+/);
  const breakdown: { word: string; meaning: string; partOfSpeech: string; morphologyNote: string }[] = [];

  let smgCount = 0;
  tokens.forEach((t) => {
    const w = t.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (smgToIndoMap[w]) smgCount++;
    else if (corpus && corpus.bySmgWord.has(w) && !corpus.byIdnWord.has(w)) smgCount++;
  });

  const resolvedDirection =
    direction === 'auto' ? (smgCount > tokens.length / 2 ? 'smg-to-id' : 'id-to-smg') : direction;

  const translatedTokens = tokens.map((tok) => {
    const clean = tok.replace(/[^a-zA-Z-]/g, '').toLowerCase();
    const punct = tok.replace(/[a-zA-Z-]/g, '');
    if (!clean) return tok;

    if (resolvedDirection === 'id-to-smg') {
      const mapped = indoToSmgMap[clean];
      if (mapped) {
        breakdown.push({
          word: mapped,
          meaning: clean,
          partOfSpeech: 'lema',
          morphologyNote: 'Kamus Balai Bahasa Simalungun (PDF)',
        });
        return mapped + punct;
      }
      // Fall back to the word lexicon learned from the parallel Bible.
      const fromCorpus = corpus ? lookupIndonesianWord(corpus, clean, 1)[0] : undefined;
      if (fromCorpus) {
        breakdown.push({
          word: fromCorpus.simalungun,
          meaning: clean,
          partOfSpeech: 'korpus',
          morphologyNote: `Korpus paralel Alkitab (${fromCorpus.frequency}× muncul)`,
        });
        return fromCorpus.simalungun + punct;
      }
      return tok;
    } else {
      const mapped = smgToIndoMap[clean];
      if (mapped) {
        breakdown.push({
          word: clean,
          meaning: mapped,
          partOfSpeech: 'lema',
          morphologyNote: 'Kamus Balai Bahasa Simalungun (PDF)',
        });
        return mapped + punct;
      }
      // Emphasis particles have no Indonesian equivalent ("Ulang ma mabiar ho" = "jangan takut").
      if (['ma', 'do', 'pe'].includes(clean)) return '';
      const fromCorpus = corpus ? lookupSimalungunWord(corpus, clean) : null;
      if (fromCorpus && fromCorpus.candidates.length > 0) {
        const best = fromCorpus.candidates[0].indonesian;
        breakdown.push({
          word: clean,
          meaning: fromCorpus.candidates.slice(0, 3).map((c) => c.indonesian).join(' / '),
          partOfSpeech: 'korpus',
          morphologyNote: `Korpus paralel Alkitab (${fromCorpus.frequency}×, keyakinan ${fromCorpus.confidence})`,
        });
        return best + punct;
      }
      return tok;
    }
  });

  let finalSentence = translatedTokens.filter(Boolean).join(' ');
  if (
    resolvedDirection === 'id-to-smg' &&
    style === 'santai' &&
    !finalSentence.toLowerCase().includes('da') &&
    !finalSentence.toLowerCase().includes('tene')
  ) {
    finalSentence = `${finalSentence}, da!`;
  }

  return {
    detectedSourceLanguage:
      resolvedDirection === 'id-to-smg' ? 'Indonesia (Instan 0ms)' : 'Simalungun (Instan 0ms)',
    targetLanguage: resolvedDirection === 'id-to-smg' ? 'Simalungun' : 'Indonesia',
    translatedText: finalSentence,
    naturalCasualVersion: resolvedDirection === 'id-to-smg' ? finalSentence : rawText,
    politeFormalVersion:
      resolvedDirection === 'id-to-smg' ? finalSentence.replace(/\bho\b/gi, 'ham') : rawText,
    phoneticGuide: finalSentence.toLowerCase().replace(/\s+/g, ' · '),
    dialectComparison: {
      raya: finalSentence,
      silimakuta: finalSentence.replace(/\bdomma\b/gi, 'enggo').replace(/\bham\b/gi, 'kam'),
      topiPasir: finalSentence.replace(/\blang\b/gi, 'seng'),
      jaheJahe: finalSentence,
      linguisticNote:
        'Diterjemahkan secara instan dari leksikon Kamus Balai Bahasa & Bibel Simalungun 2007. Klik "Perhalus Kalimat Panjang (AI)" untuk menyusun kalimat dengan grounding PDF asli.',
    },
    wordBreakdown:
      breakdown.length > 0
        ? breakdown
        : [
            {
              word: rawText,
              meaning: finalSentence,
              partOfSpeech: 'kalimat',
              morphologyNote: 'Hasil kamus instan lokal.',
            },
          ],
    relatedBibleParallel: findRelatedVerse(rawText, corpus) ?? {
      reference: 'Amsal 4:23 (Podah 4:23 — Verbatim PDF Bibel Simalungun)',
      simalungunVerse:
        'Tang siporlunan, jaga ma uhurmu, ai hunjai do luar hagoluhan.',
      indonesianVerse:
        'Jagalah hatimu dengan segala kewaspadaan, karena dari situlah terpancar kehidupan.',
    },
  };
}

// Picks a verse from the parallel corpus that uses the rarest (most specific) input word.
function findRelatedVerse(rawText: string, corpus: BibleCorpus | null) {
  if (!corpus) return null;
  const words = rawText
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zà-ÿ-]/g, ''))
    .filter((w) => w.length >= 3);
  let best: { word: string; freq: number } | null = null;
  for (const w of words) {
    const freq = corpus.bySmgWord.get(w)?.[1] ?? (corpus.byIdnWord.has(w) ? 50 : 0);
    if (freq > 0 && (!best || freq < best.freq)) best = { word: w, freq };
  }
  if (!best) return null;
  const verse = searchVerses(corpus, best.word, 1)[0];
  if (!verse) return null;
  return {
    reference: `${verseReference(corpus, verse)} — korpus paralel`,
    simalungunVerse: verse[3],
    indonesianVerse: verse[4],
  };
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeMode, setActiveMode] = useState<DashboardMode>('text-lexicon');

  // --- PERSISTENT LOCAL CACHE STATE ---
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveStatusMsg, setSaveStatusMsg] = useState<string | null>(null);

  // Saved translation history/cache (LocalStorage)
  const [savedTranslations, setSavedTranslations] = useState<SavedTranslationCacheItem[]>(() => {
    try {
      const cached = localStorage.getItem('pustaha_saved_translations');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Parallel Bible corpus powers the offline translator; load it in the background.
  useEffect(() => {
    loadBibleCorpus().catch(() => {
      // offline translator keeps working with the built-in lexicon
    });
  }, []);

  // Verbatim PDF Search State
  const [pdfSearchQuery, setPdfSearchQuery] = useState('');
  const [pdfSearchResults, setPdfSearchResults] = useState<PdfSearchHit[]>([]);
  const [isSearchingPdf, setIsSearchingPdf] = useState(false);

  // Drawer for 4 PDFs
  const [showPdfDrawer, setShowPdfDrawer] = useState(false);
  const [activePdfTab, setActivePdfTab] = useState<'kamus-2016' | 'bibel-parallel'>('kamus-2016');

  // Audio TTS state
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- 1. TEXT & LEXICON STATE ---
  const [customEntries, setCustomEntries] = useState<DictionaryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('pustaha_custom_lexicon');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const allLexicon = [...customEntries, ...SIMALUNGUN_LEXICON];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | LexiconCategory>('Semua');
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry>(SIMALUNGUN_LEXICON[0]);
  const [showAddWordModal, setShowAddWordModal] = useState(false);

  const [engineMode] = useState<'offline-instant' | 'ai-natural'>('offline-instant');
  const [speechStyle, setSpeechStyle] = useState<'santai' | 'sopan' | 'alkitab'>('santai');
  const [inputText, setInputText] = useState(
    'Jangan ngambek dong sayang, aku kangen banget sama kamu'
  );
  const [translateDirection, setTranslateDirection] = useState<'auto' | 'id-to-smg' | 'smg-to-id'>(
    'id-to-smg'
  );
  const [preferredDialect] = useState('Dialek Raya (Umum)');
  const [isTranslatingText, setIsTranslatingText] = useState(false);
  const [textTranslationResult, setTextTranslationResult] =
    useState<TextTranslationResponse | null>(null);
  const [textTranslateError, setTextTranslateError] = useState<string | null>(null);
  const [showTranslationDetails, setShowTranslationDetails] = useState(false);

  const [newWordSmg, setNewWordSmg] = useState('');
  const [newWordIdn, setNewWordIdn] = useState('');
  const [newWordPos, setNewWordPos] = useState<PartOfSpeech>('kb');
  const [newWordCat, setNewWordCat] = useState<LexiconCategory>('Percakapan Harian');
  const [newWordExampleSmg, setNewWordExampleSmg] = useState('');
  const [newWordExampleIdn, setNewWordExampleIdn] = useState('');

  // --- 2. PARTUTURAN FLEXIBLE & EXPANDABLE STATE (WITH SAVED NAMES & PLAIN-TEXT MARGA) ---
  const [partuturanMode, setPartuturanMode] = useState<
    'kenalan-baru' | 'jalur-keluarga' | 'kamus-tutur'
  >('kenalan-baru');

  // Load saved profile from localStorage so cache is never lost when reopening app!
  const initialSavedProfile = (() => {
    try {
      const raw = localStorage.getItem('pustaha_user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const [showProfileEditor, setShowProfileEditor] = useState(false);
  // Mode Bantu Orang Lain (Temporary calculation without overwriting my saved profile!)
  const [isHelpingFriendMode, setIsHelpingFriendMode] = useState(false);

  // Saved Profile Names & Plain-Text Margas
  const [myName, setMyName] = useState<string>(initialSavedProfile?.myName || '');
  const [myFatherName, setMyFatherName] = useState<string>(initialSavedProfile?.myFatherName || '');
  const [myMotherName, setMyMotherName] = useState<string>(initialSavedProfile?.myMotherName || '');
  const [mySpouseName, setMySpouseName] = useState<string>(initialSavedProfile?.mySpouseName || '');
  const [myFatherInLawName, setMyFatherInLawName] = useState<string>(
    initialSavedProfile?.myFatherInLawName || ''
  );
  const [myMotherInLawName, setMyMotherInLawName] = useState<string>(
    initialSavedProfile?.myMotherInLawName || ''
  );

  const [myGender, setMyGender] = useState<'Laki-laki' | 'Perempuan'>(
    initialSavedProfile?.myGender || 'Laki-laki'
  );
  const [myMarga, setMyMarga] = useState<string>(
    initialSavedProfile?.myMarga || 'Saragih Sumbayak'
  );
  const [myMotherMarga, setMyMotherMarga] = useState<string>(
    initialSavedProfile?.myMotherMarga || 'Purba Pakpak'
  );
  const [mySpouseMarga, setMySpouseMarga] = useState<string>(
    initialSavedProfile?.mySpouseMarga || 'Purba Tambak'
  );
  const [mySpouseMotherMarga, setMySpouseMotherMarga] = useState<string>(
    initialSavedProfile?.mySpouseMotherMarga || 'Damanik Tomok'
  );
  const [myFatherMotherMarga, setMyFatherMotherMarga] = useState<string>(
    initialSavedProfile?.myFatherMotherMarga || 'Sinaga Bonor'
  );
  const [myMotherMotherMarga, setMyMotherMotherMarga] = useState<string>(
    initialSavedProfile?.myMotherMotherMarga || 'Damanik Nagur'
  );

  // Temporary state when "Mode Bantu Orang Lain / Cek Tanpa Ubah Profilku" is active
  const [helperName, setHelperName] = useState('Teman Saya');
  const [helperGender, setHelperGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [helperMarga, setHelperMarga] = useState('Simanjuntak');
  const [helperMotherMarga, setHelperMotherMarga] = useState('Saragih Garingging');
  const [helperSpouseMarga, setHelperSpouseMarga] = useState('Purba Pakpak');
  const [helperSpouseMotherMarga, setHelperSpouseMotherMarga] = useState('Sinaga Bonor');

  // Instant Free-Text Kinship Question Search
  const [quickKinshipQuery, setQuickKinshipQuery] = useState('');

  // Mode A: Kenalan Baru (Martarombo — Supports Plain-Text Marga + Spouse Marga + Mother Marga)
  const [strangerName, setStrangerName] = useState('');
  const [strangerGender, setStrangerGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [strangerAgeGroup, setStrangerAgeGroup] = useState<
    'sebaya' | 'orang-tua' | 'ompung' | 'lebih-muda'
  >('sebaya');
  const [strangerMarga, setStrangerMarga] = useState('Purba Pakpak');
  const [strangerMotherMarga, setStrangerMotherMarga] = useState('');
  const [strangerSpouseMarga, setStrangerSpouseMarga] = useState('');
  const [strangerBirthOrder, setStrangerBirthOrder] = useState<'umum' | 'tua' | 'tongah' | 'anggi'>('umum');

  // Mode B: Penyusun Jalur Hubungan Fleksibel (Chain Builder: 1 to 4 steps, including Bapatua/Bapatongah/Bapanggi)
  type RelationStep =
    | 'pasangan'
    | 'ayah'
    | 'ibu'
    | 'abang'
    | 'saudara-tengah'
    | 'adik-laki'
    | 'kakak-perempuan'
    | 'adik-perempuan'
    | 'anak-laki'
    | 'anak-perempuan';

  const [relationChain, setRelationChain] = useState<RelationStep[]>(['pasangan', 'ibu', 'ayah']);
  const [partuturanSearch, setPartuturanSearch] = useState('');
  const [selectedMargaFilter, setSelectedMargaFilter] = useState<'Semua' | MargaUtama>('Semua');

  // --- 3. VOICE AUTO-TRANSLATE STATE ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceDirection, setVoiceDirection] = useState<'auto' | 'id-to-smg' | 'smg-to-id'>('auto');
  const [voiceDialect] = useState('Dialek Raya (Umum)');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceResult, setVoiceResult] = useState<VoiceTranslationResponse | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // --- 4. CAMERA & PHOTO OCR TRANSLATE STATE ---
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [visionResult, setVisionResult] = useState<VisionTranslationResponse | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [selectedSampleDoc, setSelectedSampleDoc] = useState<SampleCameraDocument>(
    SAMPLE_CAMERA_DOCUMENTS[0]
  );
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- 5. DODING HALELUYA <-> KJ <-> ENGLISH & CUSTOM SIMALUNGUN SONG AUTO-TRANSLATOR ---
  const [hymnSearch, setHymnSearch] = useState('');
  const [selectedHymn, setSelectedHymn] = useState(HYMN_CONCORDANCE_LIST[0]);
  const [customSongTitle, setCustomSongTitle] = useState('');
  const [customSongLyrics, setCustomSongLyrics] = useState('');
  const [customSongAutoTranslation, setCustomSongAutoTranslation] = useState<string | null>(null);
  const [isTranslatingSong, setIsTranslatingSong] = useState(false);
  const [verifyQuery, setVerifyQuery] = useState(
    'Bagaimana cara martarombo dan berbicara bahasa Simalungun santai sehari-hari?'
  );
  const [isVerifyingDialect, setIsVerifyingDialect] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    analysis: string;
    sources: { uri: string; title: string }[];
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Auto-save profile to localStorage whenever saved profile fields change
  useEffect(() => {
    const profilePayload = {
      myName,
      myFatherName,
      myMotherName,
      mySpouseName,
      myFatherInLawName,
      myMotherInLawName,
      myGender,
      myMarga,
      myMotherMarga,
      mySpouseMarga,
      mySpouseMotherMarga,
      myFatherMotherMarga,
      myMotherMotherMarga,
    };
    try {
      localStorage.setItem('pustaha_user_profile', JSON.stringify(profilePayload));
    } catch {
      // ignore storage quota errors
    }
  }, [
    myName,
    myFatherName,
    myMotherName,
    mySpouseName,
    myFatherInLawName,
    myMotherInLawName,
    myGender,
    myMarga,
    myMotherMarga,
    mySpouseMarga,
    mySpouseMotherMarga,
    myFatherMotherMarga,
    myMotherMotherMarga,
  ]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (activeMode !== 'camera-ocr' && cameraActive) {
      stopCameraStream();
    }
  }, [activeMode]);

  useEffect(() => {
    loadSampleDocumentIntoVision(SAMPLE_CAMERA_DOCUMENTS[0]);
    const initialRes = translateOfflineInstant(
      'Jangan ngambek dong sayang, aku kangen banget sama kamu',
      'id-to-smg',
      'santai',
      allLexicon
    );
    setTextTranslationResult(initialRes);
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // --- TTS PRONUNCIATION HANDLER ---
  const handlePlayPronunciation = async (textToSpeak: string) => {
    if (!textToSpeak.trim()) return;
    if (speakingText === textToSpeak) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingText(null);
      return;
    }

    setSpeakingText(textToSpeak);

    if (engineMode === 'offline-instant' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'id-ID';
      utterance.rate = 0.92;
      utterance.onend = () => setSpeakingText(null);
      utterance.onerror = () => setSpeakingText(null);
      window.speechSynthesis.speak(utterance);
      return;
    }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, voiceName: 'Kore' }),
      });
      const data = await response.json();
      if (!response.ok || !data.audioWavBase64) {
        throw new Error(data.error || 'Gagal memuat audio pelafalan');
      }

      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(`data:audio/wav;base64,${data.audioWavBase64}`);
      audioPlayerRef.current = audio;
      audio.onended = () => setSpeakingText(null);
      audio.onerror = () => setSpeakingText(null);
      await audio.play();
    } catch {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'id-ID';
        utterance.rate = 0.92;
        utterance.onend = () => setSpeakingText(null);
        utterance.onerror = () => setSpeakingText(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setSpeakingText(null);
      }
    }
  };

  // --- LOCAL CACHE HANDLERS ---
  const handleSaveProfileToCache = () => {
    setIsSavingProfile(true);
    const profileData = {
      myName,
      myFatherName,
      myMotherName,
      mySpouseName,
      myFatherInLawName,
      myMotherInLawName,
      myGender,
      myMarga,
      myMotherMarga,
      mySpouseMarga,
      mySpouseMotherMarga,
      myFatherMotherMarga,
      myMotherMotherMarga,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('pustaha_user_profile', JSON.stringify(profileData));
      setSaveStatusMsg('Data profil & keluarga tersimpan di Cache Browser!');
    } catch {
      // ignore
    } finally {
      setIsSavingProfile(false);
      setTimeout(() => setSaveStatusMsg(null), 3000);
    }
  };

  const handleSaveTranslationToCache = (sourceText: string, translatedText: string) => {
    if (!sourceText.trim() || !translatedText.trim()) return;
    const item: SavedTranslationCacheItem = {
      id: `tr-${Date.now()}`,
      sourceText: sourceText.trim(),
      translatedText: translatedText.trim(),
      direction: translateDirection,
      style: speechStyle,
      createdAt: new Date().toISOString(),
    };
    const nextList = [
      item,
      ...savedTranslations.filter((t) => t.sourceText !== item.sourceText),
    ].slice(0, 30);
    setSavedTranslations(nextList);
    try {
      localStorage.setItem('pustaha_saved_translations', JSON.stringify(nextList));
      setSaveStatusMsg('Terjemahan disimpan ke Cache Browser!');
      setTimeout(() => setSaveStatusMsg(null), 2500);
    } catch {
      // ignore
    }
  };

  const handleDeleteSavedTranslation = (id: string) => {
    const nextList = savedTranslations.filter((t) => t.id !== id);
    setSavedTranslations(nextList);
    try {
      localStorage.setItem('pustaha_saved_translations', JSON.stringify(nextList));
    } catch {
      // ignore
    }
  };

  const handleSearchVerbatimPdf = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const q = (customQuery !== undefined ? customQuery : pdfSearchQuery).trim();
    if (!q) return;
    setIsSearchingPdf(true);
    try {
      const res = await fetch('/api/pdf-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Static host fallback');
      setPdfSearchResults(data.results || []);
    } catch {
      // Client-side static fallback for GitHub Pages (searches corpus, Bible verses, and dictionary entries)
      const qLower = q.toLowerCase();
      const localHits: PdfSearchHit[] = [];
      const corpus = await loadBibleCorpus().catch(() => null);
      if (corpus) {
        for (const v of searchVerses(corpus, q, 8)) {
          localHits.push({
            docId: 'alkitab-smg',
            docTitle: `Bibel Simalungun ↔ Alkitab TB — ${verseReference(corpus, v)}`,
            snippet: `[Simalungun]: "${v[3]}" | [Terjemahan Baru]: "${v[4]}"`,
          });
        }
      }
      for (const item of allLexicon) {
        if (
          item.simalungun.toLowerCase().includes(qLower) ||
          item.indonesian.toLowerCase().includes(qLower)
        ) {
          localHits.push({
            docId: 'kamus-2016',
            docTitle: item.verifiedSource || 'Kamus Bahasa Simalungun–Indonesia (Balai Bahasa 2016)',
            snippet: `${item.simalungun} (${item.partOfSpeech}) — ${item.indonesian}. ${
              item.dailyExamples[0]
                ? `Contoh: "${item.dailyExamples[0].simalungun}" (${item.dailyExamples[0].indonesian})`
                : ''
            }`,
          });
        }
        for (const bib of item.biblicalReferences) {
          if (
            bib.reference.toLowerCase().includes(qLower) ||
            bib.simalungunVerse.toLowerCase().includes(qLower) ||
            bib.indonesianVerse.toLowerCase().includes(qLower)
          ) {
            localHits.push({
              docId: 'alkitab-smg',
              docTitle: `Bibel Bahasa Simalungun — ${bib.reference}`,
              snippet: `[Simalungun]: "${bib.simalungunVerse}" | [Terjemahan Baru]: "${bib.indonesianVerse}"`,
            });
          }
        }
      }
      setPdfSearchResults(localHits.slice(0, 12));
    } finally {
      setIsSearchingPdf(false);
    }
  };

  const handleTranslateCustomSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSongLyrics.trim()) return;
    setIsTranslatingSong(true);
    try {
      const instant = translateOfflineInstant(
        customSongLyrics,
        'smg-to-id',
        'alkitab',
        allLexicon
      );
      setCustomSongAutoTranslation(instant.translatedText);
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: customSongLyrics,
          direction: 'smg-to-id',
          dialect: 'Dialek Raya (Umum)',
          style: 'alkitab',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translatedText) {
          setCustomSongAutoTranslation(data.translatedText);
        }
      }
    } catch {
      // fallback already set via translateOfflineInstant
    } finally {
      setIsTranslatingSong(false);
    }
  };

  // --- 1. TEXT TRANSLATION HANDLER ---
  const handleTranslateText = async (
    overrideText?: string,
    forceMode?: 'offline-instant' | 'ai-natural'
  ) => {
    const targetText = overrideText !== undefined ? overrideText : inputText;
    if (!targetText.trim()) return;

    const currentEngine = forceMode || engineMode;
    setTextTranslateError(null);

    if (currentEngine === 'offline-instant') {
      const instantRes = translateOfflineInstant(
        targetText,
        translateDirection,
        speechStyle,
        allLexicon
      );
      setTextTranslationResult(instantRes);
      return;
    }

    setIsTranslatingText(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: targetText,
          direction: translateDirection,
          dialect: preferredDialect,
          style: speechStyle,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menerjemahkan teks.');
      }
      setTextTranslationResult(data);
      handleSaveTranslationToCache(targetText, data.translatedText);
    } catch {
      // Automatic fallback on static hosts like GitHub Pages where /api/translate is not running
      const fallbackRes = translateOfflineInstant(
        targetText,
        translateDirection,
        speechStyle,
        allLexicon
      );
      setTextTranslationResult(fallbackRes);
      handleSaveTranslationToCache(targetText, fallbackRes.translatedText);
    } finally {
      setIsTranslatingText(false);
    }
  };

  const handleSaveCustomWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWordSmg.trim() || !newWordIdn.trim()) return;

    const entry: DictionaryEntry = {
      id: `custom-${Date.now()}`,
      simalungun: newWordSmg.trim(),
      indonesian: newWordIdn.trim(),
      partOfSpeech: newWordPos,
      category: newWordCat,
      phonetic: newWordSmg.trim().toLowerCase().replace(/\s+/g, '-'),
      dialects: {
        raya: newWordSmg.trim(),
        silimakuta: newWordSmg.trim(),
        topiPasir: newWordSmg.trim(),
        jaheJahe: newWordSmg.trim(),
        notes: 'Entri kontribusi pengguna.',
      },
      dailyExamples: newWordExampleSmg.trim()
        ? [
            {
              simalungun: newWordExampleSmg.trim(),
              indonesian: newWordExampleIdn.trim() || '-',
              dialect: 'Umum / Raya',
            },
          ]
        : [],
      biblicalReferences: [],
      verifiedSource: 'Kontribusi Pengguna',
    };

    const updated = [entry, ...customEntries];
    setCustomEntries(updated);
    try {
      localStorage.setItem('pustaha_custom_lexicon', JSON.stringify(updated));
    } catch {
      // ignore
    }
    setSelectedEntry(entry);
    setShowAddWordModal(false);
    setNewWordSmg('');
    setNewWordIdn('');
    setNewWordExampleSmg('');
    setNewWordExampleIdn('');
  };

  // --- 2. PARTUTURAN ENGINE (SUPPORTS PLAIN-TEXT TOBA/SIMALUNGUN MARGAS & SPOUSE/PARENTS PATHS) ---
  const matchedQuickKinship = quickKinshipQuery.trim()
    ? INSTANT_PARTUTURAN_QA.find(
        (qa) =>
          qa.questionLabel.toLowerCase().includes(quickKinshipQuery.toLowerCase()) ||
          qa.keywords.some(
            (kw) =>
              quickKinshipQuery.toLowerCase().includes(kw) ||
              kw.includes(quickKinshipQuery.toLowerCase())
          )
      )
    : null;

  // Active person being calculated for: either My Saved Profile OR Mode Bantu Orang Lain
  const activePersonName = isHelpingFriendMode ? helperName || 'Teman' : myName || 'Saya';
  const activeGender = isHelpingFriendMode ? helperGender : myGender;
  const activeMarga = isHelpingFriendMode ? helperMarga : myMarga;
  const activeMotherMarga = isHelpingFriendMode ? helperMotherMarga : myMotherMarga;
  const activeSpouseMarga = isHelpingFriendMode ? helperSpouseMarga : mySpouseMarga;
  const activeSpouseMotherMarga = isHelpingFriendMode
    ? helperSpouseMotherMarga
    : mySpouseMotherMarga;

  const computeStrangerPartuturan = () => {
    const clanSaya = getMainMarga(activeMarga);
    const clanInang = getMainMarga(activeMotherMarga);
    const clanPasangan = getMainMarga(activeSpouseMarga);
    const clanTarget = getMainMarga(strangerMarga);

    const targetDisplayName = strangerName.trim() ? `${strangerName.trim()} (${strangerMarga})` : strangerMarga;
    const bapaOrderLabel =
      strangerBirthOrder === 'tua'
        ? 'Bapa Tua (Bapatua)'
        : strangerBirthOrder === 'tongah'
        ? 'Bapa Tongah (Bapatongah)'
        : strangerBirthOrder === 'anggi'
        ? 'Bapa Anggi (Bapanggi / Amburu)'
        : 'Bapa Tua (Bapatua) / Bapa Tongah (Bapatongah) / Bapa Anggi (Bapanggi)';
    const inangOrderLabel =
      strangerBirthOrder === 'tua'
        ? 'Inang Tua (Inangtua)'
        : strangerBirthOrder === 'tongah'
        ? 'Inang Tongah (Inangtongah)'
        : strangerBirthOrder === 'anggi'
        ? 'Inang Anggi (Inanggi)'
        : 'Inang Tua (Inangtua) / Inang Tongah / Inang Anggi (Inanggi)';

    // 1. Jika usia setara Ompung
    if (strangerAgeGroup === 'ompung') {
      const isTondongOmpung =
        areMargasSameOrAffiliated(strangerMarga, activeMotherMarga) ||
        areMargasSameOrAffiliated(strangerMarga, activeSpouseMarga) ||
        areMargasSameOrAffiliated(strangerSpouseMarga, activeMotherMarga);
      return {
        sapaanUtama:
          strangerGender === 'Laki-laki' ? 'Ompung (Ompung Dalahi)' : 'Ompung (Ompung Daboru)',
        panggilanBalasan: 'Pahompu (Cucu)',
        jalurTerdeteksi: isTondongOmpung ? 'Jalur Leluhur Tondong (Ibu/Istri)' : 'Jalur Usia Sepuh (Ompung)',
        kategoriAdat: isTondongOmpung
          ? 'Tondong (Leluhur Pemberi Berkat)'
          : 'Sanina / Ompung',
        alasan: `Karena beliau (${targetDisplayName}) berusia sepuh (setara kakek/nenek), dalam adat Simalungun semua orang tua seusia kakek/nenek disapa "Ompung".`,
        kalimatSapaan: `Horas Ompung! Ahu ${activeMarga}, bere ni ${activeMotherMarga}. Sehat-sehat do ham, Ompung?`,
        artiSapaan: `Horas Ompung! Saya marga ${activeMarga}, keponakan (bere) dari ${activeMotherMarga}. Sehat-sehatnya Ompung?`,
      };
    }

    // 2. JALUR SEMARGA LANGSUNG (Termasuk jika sama-sama Marga Toba seperti Simanjuntak == Simanjuntak, atau sekawanan SISADAPUR)
    if (areMargasSameOrAffiliated(strangerMarga, activeMarga)) {
      const sharedLabel = clanSaya ? `Marga Induk ${clanSaya}` : `Marga ${strangerMarga}`;
      if (strangerAgeGroup === 'orang-tua') {
        if (strangerGender === 'Laki-laki') {
          return {
            sapaanUtama: bapaOrderLabel,
            panggilanBalasan: 'Anak (Laki-laki) / Boru (Perempuan)',
            jalurTerdeteksi: `Jalur Marga Bapak / Semarga (${sharedLabel})`,
            kategoriAdat: 'Sanina (Saudara Semarga Se-Bapa)',
            alasan: `Marga beliau (${targetDisplayName}) semarga/sekawanan (${sharedLabel}) dengan ${activePersonName} (${activeMarga}) dan seusia orang tua. Jika beliau lebih tua dari Bapak disapa "Bapa Tua (Bapatua)", urutan tengah "Bapa Tongah (Bapatongah)", dan jika lebih muda dari Bapak disapa "Bapa Anggi (Bapanggi / Amburu)" — istrinya disapa "${inangOrderLabel}".`,
            kalimatSapaan: `Horas ${strangerBirthOrder === 'tua' ? 'Bapatua' : strangerBirthOrder === 'tongah' ? 'Bapatongah' : strangerBirthOrder === 'anggi' ? 'Bapanggi' : 'Bapa'}! Samarga do hita hape (${sharedLabel}), anak ni ${activeMarga} do ahu.`,
            artiSapaan: `Horas Pak (${bapaOrderLabel})! Satu marga rupanya kita (${sharedLabel}), anak dari ${activeMarga} saya ini.`,
          };
        } else {
          return {
            sapaanUtama: 'Amboru (Bibi Semarga Ayah)',
            panggilanBalasan: 'Anak / Parumaen / Bere',
            jalurTerdeteksi: `Jalur Saudari Perempuan Bapak (${sharedLabel})`,
            kategoriAdat: 'Boru / Anak Boru (Saudari Perempuan Ayah)',
            alasan: `Beliau perempuan bermarga ${strangerMarga} (semarga dengan ayah Anda, ${sharedLabel}) dan seusia orang tua. Maka beliau adalah saudari perempuan ayah Anda dan wajib disapa "Amboru" (suaminya disapa "Makkela").`,
            kalimatSapaan: `Horas Amboru! Boru ${strangerMarga} do ham hape, samarga pakon Bapa nami (${activeMarga}).`,
            artiSapaan: `Horas Bibi (Amboru)! Boru ${strangerMarga} rupanya Ibu, satu marga dengan Bapak kami.`,
          };
        }
      }

      if (strangerAgeGroup === 'lebih-muda') {
        return {
          sapaanUtama:
            activeGender === strangerGender
              ? 'Anggi (Adik Semarga)'
              : 'Botou (Adik Lintas Gender Semarga)',
          panggilanBalasan:
            activeGender === strangerGender
              ? activeGender === 'Laki-laki'
                ? 'Abang / Kaha'
                : 'Kakak / Kaha'
              : 'Botou',
          jalurTerdeteksi: `Jalur Semarga (${sharedLabel})`,
          kategoriAdat: 'Sanina (Saudara Semarga)',
          alasan: `Beliau satu marga (${sharedLabel}) dengan ${activePersonName} dan berusia lebih muda. Sesama jenis kelamin memanggil "Anggi", sedangkan berbeda jenis kelamin (laki-laki & perempuan semarga) saling memanggil "Botou" (pantang menikah karena saudara kandung adat).`,
          kalimatSapaan:
            activeGender === strangerGender
              ? `Horas Anggi! Marsanina do hita hape (${sharedLabel}), da!`
              : `Horas Botou! Marbotou do hita hape, samarga ${sharedLabel}!`,
          artiSapaan:
            activeGender === strangerGender
              ? `Horas Dik! Bersaudara semarga rupanya kita (${sharedLabel}), ya!`
              : `Horas Botou (Saudaraku)! Bersaudara semarga ${sharedLabel} rupanya kita!`,
        };
      }

      return {
        sapaanUtama:
          activeGender === strangerGender
            ? strangerGender === 'Laki-laki'
              ? 'Sanina / Abang / Anggi'
              : 'Kakak / Kaha / Anggi'
            : 'Botou (Saudara Kandung Adat)',
        panggilanBalasan: activeGender === strangerGender ? 'Sanina / Abang / Anggi' : 'Botou',
        jalurTerdeteksi: `Jalur Semarga (${sharedLabel})`,
        kategoriAdat: 'Sanina (Saudara Semarga — Manat bani Sanina)',
        alasan: `Karena marga beliau (${targetDisplayName}) sama-sama ${sharedLabel} dengan ${activePersonName} (${activeMarga}), kalian adalah saudara kandung secara adat (Marsanina jika sesama jenis kelamin, atau Marbotou jika lawan jenis).`,
        kalimatSapaan:
          activeGender === strangerGender
            ? `Horas Sanina! Sada marga do hita hape (${sharedLabel}), hun huta ja do ham, Sanina?`
            : `Horas Botou! Samarga ${sharedLabel} do hita hape, tene!`,
        artiSapaan:
          activeGender === strangerGender
            ? `Horas Saudaraku (Sanina)! Satu marga rupanya kita (${sharedLabel}), dari kampung mana Anda?`
            : `Horas Botou! Satu marga ${sharedLabel} rupanya kita, ya kan!`,
      };
    }

    // 3. JALUR TONDONG (Marga Kenalan = Marga Ibu Kandung Kita ATAU Marga Istri/Suami Kita)
    if (
      areMargasSameOrAffiliated(strangerMarga, activeMotherMarga) ||
      areMargasSameOrAffiliated(strangerMarga, activeSpouseMarga)
    ) {
      const isViaMother = areMargasSameOrAffiliated(strangerMarga, activeMotherMarga);
      const via = isViaMother
        ? `Ibu kandung (${myMotherName ? `${myMotherName} — ` : ''}Boru ${activeMotherMarga})`
        : `Istri/Pasangan (${mySpouseName ? `${mySpouseName} — ` : ''}Boru ${activeSpouseMarga})`;
      const refClan = clanTarget || strangerMarga;

      if (strangerAgeGroup === 'orang-tua') {
        return {
          sapaanUtama:
            strangerGender === 'Laki-laki'
              ? strangerBirthOrder === 'tua'
                ? 'Tulang (Tulang Tua)'
                : strangerBirthOrder === 'tongah'
                ? 'Tulang (Tulang Tongah)'
                : strangerBirthOrder === 'anggi'
                ? 'Tulang (Tulang Anggi)'
                : 'Tulang'
              : inangOrderLabel,
          panggilanBalasan: 'Panogolan / Bere / Hela',
          jalurTerdeteksi: isViaMother ? `Jalur Ibu Kandung (${via})` : `Jalur Istri/Pasangan (${via})`,
          kategoriAdat: 'Tondong Jabu (Pihak Pemberi Berkat — Hormat bani Tondong)',
          alasan: `Marga beliau (${targetDisplayName}) semarga dengan ${via}. Dalam adat Simalungun, laki-laki semarga Ibu atau Istri yang seusia orang tua wajib disapa "Tulang" (dan istrinya disapa "Anturang"). Sedangkan perempuan semarga Ibu yang seusia orang tua disapa "${inangOrderLabel}".`,
          kalimatSapaan: `Horas Tulang! Panogolan/bere ni ${refClan} do ahu, ai boru ${refClan} do Inang/parinangon nami.`,
          artiSapaan: `Horas Tulang (Om)! Keponakan/menantu dari marga ${refClan} saya ini, karena Ibu/istri kami boru ${refClan}.`,
        };
      }

      if (strangerGender === 'Laki-laki') {
        return {
          sapaanUtama:
            activeGender === 'Laki-laki' ? 'Lawei (atau Tulang Naposo)' : 'Hela / Lawei / Tulang',
          panggilanBalasan: 'Lawei / Bere',
          jalurTerdeteksi: isViaMother ? `Jalur Ibu Kandung (${via})` : `Jalur Istri/Pasangan (${via})`,
          kategoriAdat: 'Tondong (Pihak Keluarga Ibu / Istri)',
          alasan: `Beliau laki-laki sebaya bermarga ${strangerMarga}, yaitu semarga dengan ${via}. Sesama laki-laki sebaya menyapa "Lawei" (ipar/putra Tulang) atau "Tulang Naposo" (Tulang muda).`,
          kalimatSapaan: `Horas Lawei! Tondong nami do ham hape, ai boru ${refClan} do Inang/parinangonku!`,
          artiSapaan: `Horas Lawei! Tondong kami rupanya Anda, karena boru ${refClan} Ibu/istri saya!`,
        };
      } else {
        return {
          sapaanUtama:
            activeGender === 'Laki-laki' ? 'Pariban (Boru Tulang)' : 'Eda / Gawei (Pariban)',
          panggilanBalasan: activeGender === 'Laki-laki' ? 'Pariban (Anak ni Amboru)' : 'Eda / Gawei',
          jalurTerdeteksi: isViaMother ? `Jalur Ibu Kandung (${via})` : `Jalur Istri/Pasangan (${via})`,
          kategoriAdat: 'Tondong / Pariban',
          alasan: `Beliau perempuan sebaya bermarga ${strangerMarga} (semarga dengan ${via}). Bagi laki-laki, putri dari marga Tulang (${refClan}) adalah "Pariban" (Boru Tulang). Bagi perempuan, disapa "Eda / Gawei".`,
          kalimatSapaan:
            activeGender === 'Laki-laki'
              ? `Horas Pariban! Boru ni Tulang (${refClan}) do ham hape, tene!`
              : `Horas Eda! Boru ni Tulang nami do ham hape!`,
          artiSapaan:
            activeGender === 'Laki-laki'
              ? `Horas Pariban! Putri dari Tulang (${refClan}) rupanya kamu, ya kan!`
              : `Horas Eda! Putri dari Tulang kami rupanya kamu!`,
        };
      }
    }

    // 4. JALUR ISTRI / PASANGAN BELIAU ATAU IBU KANDUNG BELIAU
    // (Sangat penting jika marga beliau adalah Toba/Karo/Lainnya, kita hitung lewat marga Istri atau Ibunya!)
    const spouseMatchesMe = areMargasSameOrAffiliated(strangerSpouseMarga, activeMarga);
    const motherMatchesMe = areMargasSameOrAffiliated(strangerMotherMarga, activeMarga);
    if (spouseMatchesMe || motherMatchesMe) {
      const viaTarget = spouseMatchesMe
        ? `Istri/Pasangan beliau (Boru ${strangerSpouseMarga})`
        : `Ibu kandung beliau (Boru ${strangerMotherMarga})`;
      const myRefClan = clanSaya || activeMarga;

      if (strangerAgeGroup === 'orang-tua') {
        return {
          sapaanUtama: strangerGender === 'Laki-laki' ? 'Makkela (Amangboru)' : 'Amboru',
          panggilanBalasan: 'Tulang / Lawei / Anak',
          jalurTerdeteksi: `Dihitung dari ${viaTarget} → Semarga dengan kita (${myRefClan})`,
          kategoriAdat: 'Boru / Anak Boru Jabu (Pihak yang Diayomi)',
          alasan: `Walaupun marga beliau adalah ${strangerMarga}, karena ${viaTarget} berasal dari marga kita (${myRefClan}), maka beliau adalah pihak penerima boru (Anak Boru) kita! Laki-laki seusia orang tua disapa "Makkela" dan istrinya adalah "Amboru" kita.`,
          kalimatSapaan: `Horas Makkela! Anak boru nami do ham hape, ai boru ${myRefClan} do Amboru i rumah!`,
          artiSapaan: `Horas Paman (Makkela)! Pihak Anak Boru kami rupanya Bapak, karena boru ${myRefClan} Bibi (Amboru) di rumah!`,
        };
      }
      return {
        sapaanUtama:
          motherMatchesMe
            ? 'Panogolan / Bere (Keponakan Adat)'
            : strangerGender === 'Laki-laki'
            ? activeGender === 'Laki-laki'
              ? 'Lawei (Anak Boru) / Hela'
              : 'Lawei / Hela'
            : 'Botou / Parumaen',
        panggilanBalasan: motherMatchesMe ? 'Tulang / Inang' : 'Lawei / Tondong',
        jalurTerdeteksi: `Dihitung dari ${viaTarget} → Semarga dengan kita (${myRefClan})`,
        kategoriAdat: 'Boru / Anak Boru (Elek bani Boru)',
        alasan: `Meskipun marga beliau adalah ${strangerMarga}, karena ${viaTarget} semarga dengan Anda (${myRefClan}), maka beliau berkedudukan sebagai ${motherMatchesMe ? 'keponakan adat ("Panogolan / Bere") karena ibunya adalah boru kita' : 'ipar ("Lawei / Anak Boru") karena istrinya adalah botou/saudari semarga kita'}.`,
        kalimatSapaan: motherMatchesMe
          ? `Horas Bere/Panogolan! Tubuh ni boru ${myRefClan} do ham hape, Tulangmu do ahu!`
          : `Horas Lawei! Anak boru nami do ham hape, ai botouhu boru ${myRefClan} do parinangonmu!`,
        artiSapaan: motherMatchesMe
          ? `Horas Keponakan (Bere)! Lahir dari boru ${myRefClan} rupanya kamu, Tulangmu saya ini!`
          : `Horas Lawei! Anak Boru kami rupanya Anda, karena saudariku boru ${myRefClan} istri Anda!`,
      };
    }

    // 5. JALUR SEPENANGGUNGAN / PARIBAN LEWAT ISTRI ATAU IBU BELIAU
    // Jika Istri Beliau semarga dengan Istri Kita ATAU Ibu Beliau semarga dengan Ibu Kita!
    const spouseMatchesMySpouse = areMargasSameOrAffiliated(strangerSpouseMarga, activeSpouseMarga);
    const spouseMatchesMyMother = areMargasSameOrAffiliated(strangerSpouseMarga, activeMotherMarga);
    const motherMatchesMyMother = areMargasSameOrAffiliated(strangerMotherMarga, activeMotherMarga);
    if (spouseMatchesMySpouse || spouseMatchesMyMother || motherMatchesMyMother) {
      const reasonPath = spouseMatchesMySpouse
        ? `Istri beliau (Boru ${strangerSpouseMarga}) satu marga dengan Istri Anda (Boru ${activeSpouseMarga})`
        : spouseMatchesMyMother
        ? `Istri beliau (Boru ${strangerSpouseMarga}) satu marga dengan Ibu kandung Anda (Boru ${activeMotherMarga})`
        : `Ibu kandung beliau (Boru ${strangerMotherMarga}) satu marga dengan Ibu kandung Anda (Boru ${activeMotherMarga})`;

      return {
        sapaanUtama:
          strangerGender === 'Laki-laki'
            ? 'Sanina Sapanganonkon / Pariban (Abang / Anggi)'
            : 'Kaha / Anggi / Eda (Saudara Sepenanggungan)',
        panggilanBalasan: 'Sanina / Pariban / Abang / Anggi',
        jalurTerdeteksi: `Dihitung dari Jalur Istri/Ibu: ${reasonPath}`,
        kategoriAdat: 'Sanina Sapanganonkon (Saudara Sepenanggungan / Satu Tondong)',
        alasan: `Walaupun marga beliau (${strangerMarga}) berbeda atau berasal dari Toba/lainnya, karena ${reasonPath}, maka kalian memiliki Tondong yang sama! Dalam adat Simalungun, dua orang yang memperistri boru yang sama atau lahir dari boru yang sama adalah "Marsanina Sapanganonkon / Pariban" (saudara kandung sepenanggungan).`,
        kalimatSapaan: `Horas Sanina/Pariban! Marsanina sapanganonkon do hita hape, ai sada do Tondongta!`,
        artiSapaan: `Horas Saudaraku (Pariban)! Bersaudara sepenanggungan rupanya kita, karena satu Tondong kita!`,
      };
    }

    // 6. Jika Marga Kenalan = Marga Mama Mertua atau Ompung (Tondong ni Tondong)
    if (
      areMargasSameOrAffiliated(strangerMarga, activeSpouseMotherMarga) ||
      areMargasSameOrAffiliated(strangerMarga, myFatherMotherMarga) ||
      areMargasSameOrAffiliated(strangerMarga, myMotherMotherMarga)
    ) {
      const refClan = clanTarget || strangerMarga;
      return {
        sapaanUtama:
          strangerGender === 'Laki-laki'
            ? 'Tulang (Tondong ni Tondong)'
            : 'Anturang / Inang (Boru Tondong)',
        panggilanBalasan: 'Bere / Pahompu / Hela',
        jalurTerdeteksi: `Jalur Mama Mertua / Ompung (${refClan})`,
        kategoriAdat: 'Tondong ni Tondong (Lima Saodoran)',
        alasan: `Marga beliau (${strangerMarga}) sama dengan marga leluhur/Mama Mertua Anda (${refClan}). Dalam falsafah Lima Saodoran, marga pemberi istri kepada Tondong kita adalah "Tondong ni Tondong" dan disapa "Tulang".`,
        kalimatSapaan: `Horas Tulang! Tondong ni tondong nami do marga ${refClan}, sehat-sehat do ham, Tulang?`,
        artiSapaan: `Horas Tulang! Tondong ni tondong kami rupanya marga ${refClan}, sehat-sehatnya Tulang?`,
      };
    }

    // 7. Default Sapaan Umum & Santun (Termasuk panduan mengisi Marga Istri/Ibu Beliau jika Marga Toba/Lainnya)
    const isNonSisadapur = clanTarget === null;
    return {
      sapaanUtama:
        strangerAgeGroup === 'orang-tua'
          ? strangerGender === 'Laki-laki'
            ? 'Bapa / Tulang / Amang'
            : 'Inang / Anturang'
          : strangerGender === 'Laki-laki'
          ? activeGender === 'Laki-laki'
            ? 'Lawei (Ipar / Sahabat)'
            : 'Botou / Abang'
          : activeGender === 'Perempuan'
          ? 'Eda / Gawei'
          : 'Botou / Kakak / Anggi',
      panggilanBalasan:
        strangerAgeGroup === 'orang-tua'
          ? 'Anak / Bere'
          : strangerGender === 'Laki-laki'
          ? activeGender === 'Laki-laki'
            ? 'Lawei'
            : 'Botou'
          : activeGender === 'Perempuan'
          ? 'Eda / Gawei'
          : 'Botou',
      jalurTerdeteksi: isNonSisadapur
        ? `Marga Lintas Suku (${strangerMarga}) — Isi Marga Istri/Ibunya di kiri untuk hitung lewat pasangan/orang tua!`
        : 'Partuturan Persaudaraan Umum Simalungun',
      kategoriAdat: 'Partuturan Umum (Sapaan Persaudaraan Simalungun)',
      alasan: isNonSisadapur
        ? `Marga "${strangerMarga}" bukan bagian langsung dari 4 marga induk SISADAPUR. Anda tetap bisa menyapa beliau dengan sopan sebagai "Lawei / Eda / Bapa / Inang", ATAU ketik Marga Istri/Suami beliau maupun Marga Ibu kandung beliau pada kolom di sebelah kiri agar sistem menghitung partuturannya lewat jalur istri atau orang tuanya!`
        : `Antara marga ${activeMarga} dan ${strangerMarga} yang berbeda marga induk, sapaan perkenalan yang paling santun bagi sesama laki-laki sebaya adalah "Lawei", sesama perempuan adalah "Eda / Gawei", lintas gender adalah "Botou", dan kepada yang seusia orang tua adalah "Bapa / Tulang" atau "Inang / Anturang".`,
      kalimatSapaan: `Horas Ham! Ahu ${activeMarga}, hun huta ja do ham, Lawei/Eda?`,
      artiSapaan: `Horas Anda! Saya marga ${activeMarga}, dari kampung mana Anda, Lawei/Eda?`,
    };
  };

  const stepLabels: Record<RelationStep, string> = {
    pasangan: 'Istri / Suami',
    ayah: 'Bapak',
    ibu: 'Mama / Ibu',
    abang: 'Abang Tertua (Tua)',
    'saudara-tengah': 'Saudara Tengah (Tongah)',
    'adik-laki': 'Adik Laki-laki (Anggi)',
    'kakak-perempuan': 'Kakak Perempuan (Tua)',
    'adik-perempuan': 'Adik Perempuan (Anggi)',
    'anak-laki': 'Anak Laki-laki',
    'anak-perempuan': 'Anak Perempuan',
  };

  const computeChainPartuturan = () => {
    const key = relationChain.join(' -> ');
    const readableChain = ['Saya', ...relationChain.map((s) => stepLabels[s])].join(' → ');

    if (key === 'pasangan') {
      return {
        chainTitle: readableChain,
        sapaan:
          activeGender === 'Laki-laki' ? 'Inang (Parinangon / Hasian)' : 'Bapa (Pargotong / Hasian)',
        balasan: activeGender === 'Laki-laki' ? 'Bapa / Abang' : 'Inang / Adek',
        posisi: 'Teman Sehidup Semati (Rongkap ni Badan)',
        penjelasan:
          'Dalam Bahasa Simalungun, istri disebut "parinangon / parsonduk" dan disapa lembut dengan "Inang" atau "Hasian". Suami disebut "pargotong / namangalop" dan disapa "Bapa / Abang".',
      };
    }
    if (key === 'pasangan -> ibu') {
      return {
        chainTitle: readableChain,
        sapaan: activeGender === 'Laki-laki' ? 'Anturang (Inang Simatua)' : 'Amboru (Inang Simatua)',
        balasan:
          activeGender === 'Laki-laki' ? 'Hela (Menantu Laki-laki)' : 'Parumaen (Menantu Perempuan)',
        posisi: activeGender === 'Laki-laki' ? 'Tondong Jabu (Ibu Mertua)' : 'Orang Tua Suami',
        penjelasan:
          'Mama dari istri disapa "Anturang" (karena istri dari Tulang). Sedangkan bagi perempuan, mama dari suami disapa "Amboru" atau "Inang".',
      };
    }
    if (key === 'pasangan -> ayah') {
      return {
        chainTitle: readableChain,
        sapaan:
          activeGender === 'Laki-laki'
            ? 'Tulang (Bapa Simatua)'
            : 'Makkela / Amangboru (Bapa Simatua)',
        balasan:
          activeGender === 'Laki-laki' ? 'Hela (Menantu Laki-laki)' : 'Parumaen (Menantu Perempuan)',
        posisi: activeGender === 'Laki-laki' ? 'Tondong Jabu (Bapak Mertua)' : 'Orang Tua Suami',
        penjelasan:
          'Bapak dari istri wajib disapa "Tulang". Sedangkan bagi perempuan, bapak dari suami disapa "Makkela" atau "Bapa".',
      };
    }
    if (key.startsWith('pasangan -> ibu -> ayah') || key.startsWith('pasangan -> ibu -> ibu')) {
      return {
        chainTitle: readableChain,
        sapaan: 'Ompung (Tulang Matua / Ompung Tondong ni Tondong)',
        balasan: 'Pahompu / Hela',
        posisi: 'Tondong ni Tondong (Leluhur Lapis Kedua dari Mama Mertua)',
        penjelasan:
          'Orang tua dari Mama Istri (2 tingkat ke atas dari istri lewat jalur ibu mertua) berkedudukan sebagai Tondong ni Tondong. Sapaan resminya adalah "Ompung" (atau "Tulang Matua").',
      };
    }
    if (key.startsWith('pasangan -> ayah -> ayah') || key.startsWith('pasangan -> ayah -> ibu')) {
      return {
        chainTitle: readableChain,
        sapaan: 'Ompung (Ompung Tondong)',
        balasan: 'Pahompu / Hela',
        posisi: 'Tondong (Leluhur dari Bapak Mertua — 2 Tingkat ke Atas)',
        penjelasan:
          'Ayah dan Ibu dari Bapak Mertua kita (Ompung kandung dari istri kita) disapa dengan penuh hormat sebagai "Ompung".',
      };
    }
    if (
      key === 'pasangan -> ibu -> abang' ||
      key === 'pasangan -> ibu -> saudara-tengah' ||
      key === 'pasangan -> ibu -> adik-laki'
    ) {
      return {
        chainTitle: readableChain,
        sapaan: 'Tulang (Tondong ni Tondong)',
        balasan: 'Hela / Bere',
        posisi: 'Tondong ni Tondong (Saudara Laki-laki dari Mama Mertua)',
        penjelasan:
          'Abang, saudara tengah, atau adik laki-laki dari Mama Istri adalah Tulang kandung dari istri Anda. Maka Anda juga wajib menyapa beliau "Tulang" (dan istrinya disapa "Anturang").',
      };
    }
    if (key === 'pasangan -> ayah -> abang') {
      return {
        chainTitle: readableChain,
        sapaan: activeGender === 'Laki-laki' ? 'Tulang (Tulang Tua)' : 'Bapa Tua (Bapatua) / Makkela',
        balasan: activeGender === 'Laki-laki' ? 'Hela' : 'Parumaen',
        posisi: 'Tondong (Abang Tertua dari Bapak Mertua)',
        penjelasan:
          'Abang kandung dari Bapak Istri sama kedudukannya dengan Bapak Mertua, sehingga bagi laki-laki disapa "Tulang (Tulang Tua)" dan istrinya "Anturang".',
      };
    }
    if (key === 'pasangan -> ayah -> saudara-tengah') {
      return {
        chainTitle: readableChain,
        sapaan:
          activeGender === 'Laki-laki' ? 'Tulang (Tulang Tongah)' : 'Bapa Tongah (Bapatongah) / Makkela',
        balasan: activeGender === 'Laki-laki' ? 'Hela' : 'Parumaen',
        posisi: 'Tondong (Saudara Tengah dari Bapak Mertua)',
        penjelasan:
          'Saudara laki-laki urutan tengah dari Bapak Mertua disapa "Tulang (Tulang Tongah)" bagi laki-laki, atau "Bapa Tongah / Makkela" bagi perempuan.',
      };
    }
    if (key === 'pasangan -> ayah -> adik-laki') {
      return {
        chainTitle: readableChain,
        sapaan:
          activeGender === 'Laki-laki'
            ? 'Tulang (Tulang Anggi)'
            : 'Bapa Anggi (Bapanggi) / Makkela',
        balasan: activeGender === 'Laki-laki' ? 'Hela' : 'Parumaen',
        posisi: 'Tondong (Adik Laki-laki dari Bapak Mertua)',
        penjelasan:
          'Adik laki-laki dari Bapak Istri juga disapa "Tulang (Tulang Anggi)" dan istrinya disapa "Anturang".',
      };
    }
    if (
      key === 'pasangan -> abang' ||
      key === 'pasangan -> saudara-tengah' ||
      key === 'pasangan -> adik-laki'
    ) {
      return {
        chainTitle: readableChain,
        sapaan:
          activeGender === 'Laki-laki'
            ? 'Lawei (Tondong)'
            : key === 'pasangan -> adik-laki'
            ? 'Nasianggi'
            : 'Nasikaha (Kaha)',
        balasan:
          activeGender === 'Laki-laki'
            ? 'Lawei (Anak Boru)'
            : key === 'pasangan -> adik-laki'
            ? 'Nasikaha'
            : 'Nasianggi',
        posisi: activeGender === 'Laki-laki' ? 'Tondong (Ipar Laki-laki)' : 'Sanina Ipar (Marnasikaha)',
        penjelasan:
          activeGender === 'Laki-laki'
            ? 'Abang atau adik laki-laki dari istri disapa "Lawei". Istri dari Lawei tersebut disapa "Inang" (atau "Anturang Naposo") karena kedudukan mereka adalah Tondong Anda!'
            : 'Bagi seorang istri, abang dari suaminya disapa "Nasikaha / Kaha", sedangkan adik laki-laki dari suaminya disapa "Nasianggi".',
      };
    }
    if (
      key === 'pasangan -> abang -> pasangan' ||
      key === 'pasangan -> saudara-tengah -> pasangan' ||
      key === 'pasangan -> adik-laki -> pasangan'
    ) {
      return {
        chainTitle: readableChain,
        sapaan:
          activeGender === 'Laki-laki'
            ? 'Inang / Anturang Naposo (Istri dari Lawei Tondong)'
            : 'Eda / Gawei / Kakak',
        balasan: activeGender === 'Laki-laki' ? 'Hela / Amang' : 'Eda / Gawei',
        posisi: 'Tondong (Istri dari Abang/Adik Laki-laki Istri)',
        penjelasan:
          'Dalam adat Simalungun yang ketat, istri dari abang/adik ipar laki-laki (istri dari Lawei pihak istri) berkedudukan sebagai Tondong (penerus peran Anturang), sehingga disapa dengan sangat sopan ("Inang" atau "Anturang") dan pantang bercanda sembarangan.',
      };
    }
    if (key === 'pasangan -> kakak-perempuan' || key === 'pasangan -> adik-perempuan') {
      return {
        chainTitle: readableChain,
        sapaan:
          activeGender === 'Laki-laki'
            ? key === 'pasangan -> kakak-perempuan'
              ? 'Kaha / Kakak (Pariban)'
              : 'Anggi (Pariban)'
            : 'Eda / Gawei',
        balasan:
          activeGender === 'Laki-laki'
            ? key === 'pasangan -> kakak-perempuan'
              ? 'Anggi'
              : 'Kaha / Abang'
            : 'Eda / Gawei',
        posisi: 'Sanina / Pariban',
        penjelasan:
          activeGender === 'Laki-laki'
            ? 'Kakak perempuan dari istri disapa "Kaha / Kakak", sedangkan adik perempuan dari istri disapa "Anggi". Suami mereka adalah "Pariban" (abang/adik sepenanggungan) Anda.'
            : 'Saudara perempuan dari suami disapa "Eda" atau "Gawei" oleh seorang istri.',
      };
    }
    if (
      key === 'ibu -> abang' ||
      key === 'ibu -> saudara-tengah' ||
      key === 'ibu -> adik-laki'
    ) {
      const tulangOrder =
        key === 'ibu -> abang'
          ? 'Tulang (Tulang Tua — Istrinya Anturang Tua)'
          : key === 'ibu -> saudara-tengah'
          ? 'Tulang (Tulang Tongah — Istrinya Anturang Tongah)'
          : 'Tulang (Tulang Anggi — Istrinya Anturang Anggi)';
      return {
        chainTitle: readableChain,
        sapaan: tulangOrder,
        balasan: 'Panogolan / Bere',
        posisi: 'Tondong Jabu (Saudara Laki-laki Ibu Kandung)',
        penjelasan:
          'Abang, saudara tengah, maupun adik laki-laki dari Ibu kandung adalah "Tulang" kita (dan istrinya disapa "Anturang"). Anak perempuan dari Tulang adalah "Pariban / Boru Tulang", dan anak laki-lakinya adalah "Lawei".',
      };
    }
    if (key === 'ibu -> kakak-perempuan') {
      return {
        chainTitle: readableChain,
        sapaan: 'Inang Tua / Inangtua (Suaminya disapa Bapa Tua / Bapatua)',
        balasan: 'Anak / Boru',
        posisi: 'Sanina (Kakak Perempuan dari Ibu Kandung)',
        penjelasan:
          'Kakak perempuan dari Ibu kandung disapa "Inang Tua (Inangtua)", dan suaminya disapa "Bapa Tua (Bapatua)" karena anak-anak kita dan anak-anak mereka adalah saudara sepenanggungan (Marsanina Sapanganonkon).',
      };
    }
    if (key === 'ibu -> adik-perempuan') {
      return {
        chainTitle: readableChain,
        sapaan: 'Inang Anggi / Inanggi (Suaminya disapa Bapa Anggi / Bapanggi)',
        balasan: 'Anak / Boru',
        posisi: 'Sanina (Adik Perempuan dari Ibu Kandung)',
        penjelasan:
          'Adik perempuan dari Ibu kandung disapa "Inang Anggi (Inanggi)", dan suaminya disapa "Bapa Anggi (Bapanggi)".',
      };
    }
    if (key === 'ayah -> kakak-perempuan' || key === 'ayah -> adik-perempuan') {
      return {
        chainTitle: readableChain,
        sapaan: 'Amboru (Suaminya disapa Makkela)',
        balasan: 'Anak / Boru / Parumaen',
        posisi: 'Boru / Anak Boru Jabu (Saudara Perempuan Ayah)',
        penjelasan:
          'Kakak atau adik perempuan dari Ayah kandung disapa "Amboru" (Kamus hal. 7), dan suaminya disapa "Makkela" (hal. 86).',
      };
    }
    if (key === 'ayah -> abang') {
      return {
        chainTitle: readableChain,
        sapaan: 'Bapa Tua / Bapatua (Istrinya disapa Inang Tua / Inangtua)',
        balasan: 'Anak / Boru',
        posisi: 'Sanina (Abang Kandung/Semarga dari Ayah)',
        penjelasan:
          'Abang kandung atau abang semarga dari Ayah disapa "Bapa Tua (Bapatua)" (Kamus Balai Bahasa hal. 22), dan istrinya disapa "Inang Tua (Inangtua)".',
      };
    }
    if (key === 'ayah -> saudara-tengah') {
      return {
        chainTitle: readableChain,
        sapaan: 'Bapa Tongah / Bapatongah (Istrinya disapa Inang Tongah / Inangtongah)',
        balasan: 'Anak / Boru',
        posisi: 'Sanina (Saudara Laki-laki Urutan Tengah dari Ayah)',
        penjelasan:
          'Saudara laki-laki dari Ayah yang berada di urutan tengah (antara Bapatua dan Bapanggi) disapa "Bapa Tongah (Bapatongah)" (Kamus Balai Bahasa hal. 22), dan istrinya disapa "Inang Tongah (Inangtongah)".',
      };
    }
    if (key === 'ayah -> adik-laki') {
      return {
        chainTitle: readableChain,
        sapaan: 'Bapa Anggi / Bapanggi / Amburu (Istrinya disapa Inang Anggi / Inanggi)',
        balasan: 'Anak / Boru',
        posisi: 'Sanina (Adik Laki-laki dari Ayah)',
        penjelasan:
          'Adik laki-laki dari Ayah kandung disapa "Bapa Anggi (Bapanggi)" atau "Amburu" (Kamus Balai Bahasa hal. 8 & 22), dan istrinya disapa "Inang Anggi (Inanggi)".',
      };
    }
    if (key === 'abang -> pasangan' || key === 'saudara-tengah -> pasangan') {
      return {
        chainTitle: readableChain,
        sapaan: activeGender === 'Laki-laki' ? 'Nasikaha / Kaha (Kakak Ipar)' : 'Eda / Gawei',
        balasan: activeGender === 'Laki-laki' ? 'Nasianggi' : 'Eda / Gawei',
        posisi: 'Sanina (Ipar Dalam Rumah)',
        penjelasan:
          'Bagi laki-laki, istri dari abang kandung/semarga disapa "Nasikaha" atau "Kaha" (Kamus hal. 118). Bagi perempuan, istri dari abang kandung disapa "Eda / Gawei".',
      };
    }
    if (key === 'adik-laki -> pasangan') {
      return {
        chainTitle: readableChain,
        sapaan: activeGender === 'Laki-laki' ? 'Nasianggi (Adik Ipar)' : 'Eda / Gawei',
        balasan: activeGender === 'Laki-laki' ? 'Nasikaha / Kaha' : 'Eda / Gawei',
        posisi: 'Sanina (Ipar Dalam Rumah)',
        penjelasan:
          'Bagi seorang abang, istri dari adik laki-lakinya disapa "Nasianggi" (Kamus hal. 10).',
      };
    }
    if (key === 'kakak-perempuan -> pasangan' || key === 'adik-perempuan -> pasangan') {
      return {
        chainTitle: readableChain,
        sapaan:
          activeGender === 'Laki-laki'
            ? 'Lawei (Anak Boru)'
            : key.startsWith('kakak')
            ? 'Abang / Kaha'
            : 'Anggi / Lawei',
        balasan: 'Lawei / Tondong',
        posisi: 'Boru / Anak Boru (Suami dari Saudari Perempuan)',
        penjelasan:
          'Suami dari kakak atau adik perempuan kita disapa "Lawei" dan berkedudukan sebagai Anak Boru kita.',
      };
    }
    if (key.startsWith('kakak-perempuan -> anak') || key.startsWith('adik-perempuan -> anak')) {
      return {
        chainTitle: readableChain,
        sapaan: 'Panogolan / Bere (Keponakan)',
        balasan: activeGender === 'Laki-laki' ? 'Tulang' : 'Inang Tua / Inang Anggi',
        posisi: 'Boru / Anak Boru (Keponakan dari Saudari Perempuan)',
        penjelasan:
          'Anak dari saudari perempuan kita disebut "Panogolan" (Kamus hal. 173). Jika Anda laki-laki, mereka memanggil Anda "Tulang".',
      };
    }

    let genDelta = 0;
    relationChain.forEach((step) => {
      if (step === 'ayah' || step === 'ibu') genDelta += 1;
      if (step === 'anak-laki' || step === 'anak-perempuan') genDelta -= 1;
    });
    const lastStep = relationChain[relationChain.length - 1];
    const isFemaleTarget =
      lastStep === 'ibu' ||
      lastStep === 'kakak-perempuan' ||
      lastStep === 'adik-perempuan' ||
      lastStep === 'anak-perempuan' ||
      (lastStep === 'pasangan' && activeGender === 'Laki-laki');

    const startsFromSpouse = relationChain[0] === 'pasangan';

    if (genDelta >= 2) {
      return {
        chainTitle: readableChain,
        sapaan:
          genDelta >= 3
            ? 'Ompung Nono / Ompung Nini (Buyut)'
            : 'Ompung (Ompung Dalahi / Daboru)',
        balasan: genDelta >= 3 ? 'Nono / Nini (Cicit)' : 'Pahompu (Cucu)',
        posisi: startsFromSpouse
          ? 'Tondong / Tondong ni Tondong (Leluhur Pihak Pasangan)'
          : 'Leluhur Keluarga (Tingkat 2+ ke Atas)',
        penjelasan: `Jalur hubungan ini naik ${genDelta} generasi di atas Anda (${readableChain}). Dalam adat Simalungun, tingkat ke-2 ke atas disapa "Ompung", dan tingkat ke-3 ke atas disebut "Ompung Nono / Ompung Nini" (Kamus hal. xiv).`,
      };
    }
    if (genDelta === 1) {
      return {
        chainTitle: readableChain,
        sapaan: startsFromSpouse
          ? isFemaleTarget
            ? 'Anturang / Inang'
            : 'Tulang / Bapa'
          : isFemaleTarget
          ? 'Inang Tua / Inang Tongah / Inang Anggi / Amboru'
          : 'Bapa Tua (Bapatua) / Bapa Tongah (Bapatongah) / Bapa Anggi (Bapanggi) / Tulang',
        balasan: 'Anak / Bere / Hela',
        posisi: startsFromSpouse
          ? 'Tondong (Generasi Orang Tua Pasangan)'
          : 'Generasi Orang Tua (1 Tingkat di Atas)',
        penjelasan: `Jalur hubungan ini berada 1 generasi di atas Anda (${readableChain}). Jika berasal dari pihak ayah, sapaannya adalah Bapatua / Bapatongah / Bapanggi (atau Amboru). Jika berasal dari pihak ibu atau istri, sapaannya adalah Tulang / Anturang.`,
      };
    }
    if (genDelta <= -2) {
      return {
        chainTitle: readableChain,
        sapaan: 'Pahompu (Cucu)',
        balasan: 'Ompung',
        posisi: 'Keturunan Generasi Ke-2 ke Bawah',
        penjelasan: `Jalur hubungan ini turun ${Math.abs(genDelta)} generasi di bawah Anda (${readableChain}), sehingga disapa "Pahompu" (Cucu).`,
      };
    }
    if (genDelta === -1) {
      return {
        chainTitle: readableChain,
        sapaan: isFemaleTarget ? 'Boru / Parumaen / Panogolan' : 'Anak / Hela / Panogolan',
        balasan: 'Bapa / Inang / Tulang / Amboru',
        posisi: 'Generasi Anak / Keponakan (1 Tingkat di Bawah)',
        penjelasan: `Jalur hubungan ini berada 1 generasi di bawah Anda (${readableChain}).`,
      };
    }

    return {
      chainTitle: readableChain,
      sapaan: isFemaleTarget ? 'Eda / Gawei / Botou / Kaha' : 'Lawei / Sanina / Abang / Anggi',
      balasan: isFemaleTarget ? 'Eda / Botou' : 'Lawei / Sanina',
      posisi: startsFromSpouse ? 'Tondong / Ipar Sejajar' : 'Sanina / Saudara Sejajar',
      penjelasan: `Jalur hubungan ini berada pada generasi yang sejajar dengan Anda (${readableChain}).`,
    };
  };

  const strangerResult = computeStrangerPartuturan();
  const chainResult = computeChainPartuturan();

  // --- 3. VOICE RECORDING HANDLERS ---
  const startVoiceRecording = async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        await processRecordedAudioBlob(audioBlob, mediaRecorder.mimeType || 'audio/webm');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setVoiceError(
        'Izin mikrofon belum aktif pada browser ini. Klik kalimat contoh di bawah untuk langsung menguji terjemahan suara.'
      );
    }
  };

  const stopVoiceRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processRecordedAudioBlob = async (blob: Blob, mimeType: string) => {
    setIsProcessingVoice(true);
    setVoiceError(null);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;

      const response = await fetch('/api/voice-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType,
          direction: voiceDirection,
          dialect: voiceDialect,
        }),
      });
      const data = await readApiJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menerjemahkan suara.');
      }

      setVoiceResult(data);
    } catch (err: any) {
      setVoiceError(err.message || 'Gagal memproses rekaman suara.');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleQuickVoicePhrase = async (phrase: string, dir: 'id-to-smg' | 'smg-to-id') => {
    setVoiceError(null);
    const instant = translateOfflineInstant(phrase, dir, 'santai', allLexicon);
    const simulatedVoice: VoiceTranslationResponse = {
      rawTranscript: phrase,
      correctedTranscript: phrase,
      detectedLanguage: instant.detectedSourceLanguage,
      translatedText: instant.translatedText,
      simalungunTextToSpeak: dir === 'id-to-smg' ? instant.translatedText : phrase,
      phoneticGuide: instant.phoneticGuide,
      dialectNote: instant.dialectComparison.linguisticNote,
      wordBreakdown: instant.wordBreakdown.map((w) => ({
        word: w.word,
        meaning: w.meaning,
        partOfSpeech: w.partOfSpeech,
      })),
    };
    setVoiceResult(simulatedVoice);
    handlePlayPronunciation(simulatedVoice.simalungunTextToSpeak);
  };

  // --- 4. CAMERA & PHOTO OCR HANDLERS ---
  const startCameraStream = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      mediaStreamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoElementRef.current) {
          videoElementRef.current.srcObject = stream;
          videoElementRef.current.play();
        }
      }, 100);
    } catch {
      setCameraError(
        'Kamera langsung tidak dapat diakses pada perangkat ini. Silakan gunakan tombol "Unggah Foto" atau pilih Dokumen Contoh.'
      );
    }
  };

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhotoFromCamera = async () => {
    if (!videoElementRef.current) return;
    const video = videoElementRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 540;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1];
    stopCameraStream();
    setCapturedImageBase64(dataUrl);
    await analyzeImageWithGemini(base64, 'image/jpeg');
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCameraStream();

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setCapturedImageBase64(dataUrl);
      await analyzeImageWithGemini(base64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const analyzeImageWithGemini = async (imageBase64: string, mimeType: string) => {
    setIsAnalyzingImage(true);
    setCameraError(null);
    try {
      const response = await fetch('/api/vision-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      const data: VisionTranslationResponse = await readApiJson(response);
      if (!response.ok) {
        throw new Error((data as any).error || 'Gagal memindai teks di foto.');
      }
      setVisionResult(data);
      if (data.detectedRegions.length > 0) {
        setActiveRegionId(data.detectedRegions[0].id);
      }
    } catch (err: any) {
      setCameraError(err.message || 'Gagal menganalisis foto.');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const loadSampleDocumentIntoVision = (doc: SampleCameraDocument) => {
    setSelectedSampleDoc(doc);
    setCapturedImageBase64(null);
    const regions: VisionDetectedRegion[] = doc.simalungunLines.map((line) => ({
      id: line.id,
      box_2d: line.box_2d,
      sourceText: line.simalungun,
      translatedText: line.indonesian,
      detectedLanguage: 'Bahasa Simalungun',
    }));

    setVisionResult({
      summaryTitle: doc.title,
      fullSourceText: doc.simalungunLines.map((l) => l.simalungun).join('\n'),
      fullTranslatedText: doc.simalungunLines.map((l) => l.indonesian).join('\n'),
      detectedRegions: regions,
      vocabularyBreakdown: doc.vocabularyBreakdown,
    });
    if (regions.length > 0) {
      setActiveRegionId(regions[0].id);
    }
  };

  // --- 5. DIALECT & VIDEO VERIFICATION HANDLER ---
  const handleVerifyDialect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!verifyQuery.trim()) return;

    setIsVerifyingDialect(true);
    setVerifyError(null);
    try {
      const response = await fetch('/api/verify-dialect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: verifyQuery }),
      });
      const data = await readApiJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memverifikasi kosakata.');
      }
      setVerifyResult(data);
    } catch (err: any) {
      setVerifyError(err.message || 'Gagal menghubungi layanan verifikasi.');
    } finally {
      setIsVerifyingDialect(false);
    }
  };

  const filteredEntries = allLexicon.filter((item) => {
    const matchesCategory = selectedCategory === 'Semua' || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCategory;
    return (
      matchesCategory &&
      (item.simalungun.toLowerCase().includes(q) ||
        item.indonesian.toLowerCase().includes(q) ||
        item.dialects.raya.toLowerCase().includes(q) ||
        item.dialects.silimakuta.toLowerCase().includes(q))
    );
  });

  const filteredPartuturan = PARTUTURAN_DIRECTORY.filter((item) => {
    const q = partuturanSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      item.sapaanSimalungun.toLowerCase().includes(q) ||
      item.artiHubungan.toLowerCase().includes(q) ||
      item.posisiAdat.toLowerCase().includes(q)
    );
  });

  const filteredHymns = HYMN_CONCORDANCE_LIST.filter((h) => {
    const q = hymnSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      h.haleluyaNumber.toLowerCase().includes(q) ||
      h.haleluyaTitle.toLowerCase().includes(q) ||
      h.kjNumber.toLowerCase().includes(q) ||
      h.kjTitle.toLowerCase().includes(q) ||
      h.englishTitle.toLowerCase().includes(q)
    );
  });

  const activeRegion =
    visionResult?.detectedRegions.find((r) => r.id === activeRegionId) ||
    visionResult?.detectedRegions[0] ||
    null;

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#121110] text-stone-900 dark:text-stone-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#FBF9F5]/95 dark:bg-[#141210]/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-Line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveMode('text-lexicon');
            }}
            className="text-xl font-serif font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap shrink-0"
          >
            Pustaha Simalungun
          </a>

          {/* Zone 2: Clean Single-Line Text Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium">
            {(
              [
                { id: 'text-lexicon', label: 'Kamus & Penerjemah' },
                { id: 'partuturan-adat', label: 'Kalkulator Partuturan' },
                { id: 'doding-video', label: 'Lagu & Doding' },
                { id: 'voice-translate', label: 'Suara & Lafal' },
                { id: 'camera-ocr', label: 'Kamera Foto' },
              ] as const
            ).map((tab) => {
              const active = activeMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveMode(tab.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-[#9A3412] text-[#9A3412] dark:border-amber-400 dark:text-amber-400 font-semibold'
                      : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Theme Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowPdfDrawer(true)}
              className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>4 PDF Asli</span>
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Tema Terang / Gelap"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Toast Notification if Cache Saved */}
        {saveStatusMsg && (
          <div className="bg-emerald-800 text-white text-xs sm:text-sm font-medium py-2 px-4 text-center flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{saveStatusMsg}</span>
          </div>
        )}
      </header>

      {/* Fixed Bottom Navigation Bar on Mobile Phones (Ergonomic Thumb Zone, >= 44px Hitboxes) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#181615]/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 px-2 h-16 grid grid-cols-5 items-center shadow-lg">
        {(
          [
            { id: 'text-lexicon', label: 'Kamus', icon: BookOpen },
            { id: 'partuturan-adat', label: 'Partuturan', icon: Users },
            { id: 'doding-video', label: 'Lagu', icon: Music },
            { id: 'voice-translate', label: 'Suara', icon: Mic },
            { id: 'camera-ocr', label: 'Kamera', icon: Camera },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeMode === tab.id;
          return (
            <button
              key={`bottom-${tab.id}`}
              onClick={() => {
                setActiveMode(tab.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'text-[#9A3412] dark:text-amber-400 font-bold'
                  : 'text-stone-500 dark:text-stone-400 font-medium'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[11px] tracking-tight truncate max-w-full px-1">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Global Datalist for Plain-Text Marga Input (Supports Simalungun SISADAPUR + Toba + Karo + Lainnya) */}
      <datalist id="marga-suggestions">
        {MARGA_SISADAPUR.map((m) => (
          <option key={m.id} value={m.subMarga}>
            Simalungun — Marga Induk {m.mainMarga}
          </option>
        ))}
        {POPULAR_TOBA_KARO_MARGAS.map((tm, idx) => (
          <option key={`toba-${idx}`} value={tm}>
            Marga Batak Toba / Karo / Pakpak / Lainnya
          </option>
        ))}
      </datalist>

      {/* Main Content Container */}
      <main id="top" className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 lg:pb-16">
        {/* =====================================================================
            MODE 1: KAMUS & PENERJEMAH TEKS (VERBATIM 4 PDF ASLI + CACHE)
           ===================================================================== */}
        {activeMode === 'text-lexicon' && (
          <div className="space-y-10">
            {/* Primary Translator Workspace */}
            <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-8">
              {/* Editorial Header with Zero-Pill Metadata */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 mb-6 border-b border-stone-200/70 dark:border-stone-800">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <span>Bibel Simalungun 2007 Verbatim</span>
                    <span aria-hidden="true">·</span>
                    <span>Kamus Balai Bahasa 2016</span>
                    <span aria-hidden="true">·</span>
                    <span>Cache Browser Aktif</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                    Penerjemah Bahasa Simalungun & Korpus Alkitab
                  </h1>
                  <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                    Seluruh ayat Bibel Simalungun (seperti <strong>1 Musa 1:1: &ldquo;Bani mula ni mulani itompa Naibata ma langit pakon tanoh.&rdquo;</strong>) dikutip 100% persis dari dokumen PDF asli.
                  </p>
                </div>

                {/* Interactive Controls (Segmented Direction + Register Selector) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                  <div className="grid grid-cols-2 p-1 bg-stone-100 dark:bg-stone-900 rounded-xl">
                    <button
                      onClick={() => {
                        setTranslateDirection('id-to-smg');
                        setTextTranslationResult(
                          translateOfflineInstant(inputText, 'id-to-smg', speechStyle, allLexicon)
                        );
                      }}
                      className={`min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        translateDirection === 'id-to-smg'
                          ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                      }`}
                    >
                      Indonesia → Simalungun
                    </button>
                    <button
                      onClick={() => {
                        setTranslateDirection('smg-to-id');
                        setTextTranslationResult(
                          translateOfflineInstant(inputText, 'smg-to-id', speechStyle, allLexicon)
                        );
                      }}
                      className={`min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        translateDirection === 'smg-to-id'
                          ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                      }`}
                    >
                      Simalungun → Indonesia
                    </button>
                  </div>

                  <select
                    value={speechStyle}
                    onChange={(e) => {
                      const nextStyle = e.target.value as 'santai' | 'sopan' | 'alkitab';
                      setSpeechStyle(nextStyle);
                      setTextTranslationResult(
                        translateOfflineInstant(inputText, translateDirection, nextStyle, allLexicon)
                      );
                    }}
                    className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-medium bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-stone-200 rounded-xl border border-stone-200/80 dark:border-stone-800 cursor-pointer"
                  >
                    <option value="santai">Ragam Santai (Teman / Pacar)</option>
                    <option value="sopan">Ragam Sopan (Orang Tua / Mertua)</option>
                    <option value="alkitab">Ragam Bibel / Pustaka (Verbatim)</option>
                  </select>
                </div>
              </div>

              {/* Two-Column Split Input / Output */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
                {/* Input Surface */}
                <div className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900/70 border border-stone-200/80 dark:border-stone-800">
                  <div>
                    <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-3">
                      <span className="font-semibold">Teks Sumber / Referensi Ayat</span>
                      <span>Terjemahan Instan</span>
                    </div>
                    <textarea
                      rows={4}
                      value={inputText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInputText(val);
                        if (val.trim()) {
                          setTextTranslationResult(
                            translateOfflineInstant(
                              val,
                              translateDirection,
                              speechStyle,
                              allLexicon
                            )
                          );
                        }
                      }}
                      placeholder="Ketik kalimat sehari-hari, sapaan ke mertua, atau ketik '1 Musa 1:1'..."
                      className="w-full bg-transparent text-lg sm:text-xl text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-stone-200/70 dark:border-stone-800">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePlayPronunciation(inputText)}
                        className="min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4 text-[#9A3412]" />
                        <span>Dengarkan</span>
                      </button>
                      {textTranslationResult && (
                        <button
                          onClick={() =>
                            handleSaveTranslationToCache(
                              inputText,
                              textTranslationResult.translatedText
                            )
                          }
                          className="min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          <Bookmark className="w-4 h-4 text-[#9A3412]" />
                          <span>Simpan Cache</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleTranslateText(inputText, 'ai-natural')}
                      disabled={isTranslatingText || !inputText.trim()}
                      className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-50 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {isTranslatingText ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memperhalus...</span>
                        </>
                      ) : (
                        <>
                          <span>Perhalus Kalimat Panjang</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Output Surface */}
                <div className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-[#F3EFE6]/60 dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800">
                  {textTranslateError ? (
                    <div className="text-sm text-red-700 dark:text-red-300 p-4 bg-red-50 dark:bg-red-950/40 rounded-xl">
                      {textTranslateError}
                    </div>
                  ) : textTranslationResult ? (
                    <div className="space-y-5">
                      <div>
                        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-2">
                          <span className="font-semibold text-[#9A3412] dark:text-amber-400">
                            Hasil Terjemahan ({textTranslationResult.targetLanguage})
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                handlePlayPronunciation(textTranslationResult.translatedText)
                              }
                              className="min-h-[36px] px-2 text-stone-700 dark:text-stone-200 hover:text-[#9A3412] flex items-center gap-1.5 font-semibold cursor-pointer"
                            >
                              <Volume2 className="w-4 h-4" />
                              <span>Lafalkan</span>
                            </button>
                            <button
                              onClick={() =>
                                handleCopy(textTranslationResult.translatedText, 'tr-main')
                              }
                              className="min-h-[36px] px-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 flex items-center gap-1.5 cursor-pointer"
                            >
                              {copiedId === 'tr-main' ? (
                                <>
                                  <Check className="w-4 h-4 text-emerald-600" />
                                  <span>Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  <span>Salin</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 leading-snug">
                          {textTranslationResult.translatedText}
                        </p>
                        <p className="text-xs sm:text-sm font-mono text-stone-600 dark:text-stone-400 mt-2">
                          Cara Baca: [{textTranslationResult.phoneticGuide}]
                        </p>
                      </div>

                      {/* Clean Hairline Divider Comparison instead of nested boxes */}
                      <div className="pt-4 border-t border-stone-200/80 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
                            Versi Santai (Ke Pacar / Teman)
                          </span>
                          <span className="font-serif font-semibold text-base text-stone-900 dark:text-stone-100 leading-relaxed block">
                            {textTranslationResult.naturalCasualVersion ||
                              textTranslationResult.translatedText}
                          </span>
                        </div>
                        <div className="sm:border-l sm:border-stone-200/80 dark:sm:border-stone-800 sm:pl-4">
                          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
                            Versi Sopan (Ke Orang Tua / Mertua)
                          </span>
                          <span className="font-serif font-semibold text-base text-stone-900 dark:text-stone-100 leading-relaxed block">
                            {textTranslationResult.politeFormalVersion ||
                              textTranslationResult.translatedText}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-stone-200/70 dark:border-stone-800 text-xs sm:text-sm">
                        <span className="text-stone-600 dark:text-stone-400 line-clamp-1">
                          {textTranslationResult.dialectComparison.linguisticNote}
                        </span>
                        <button
                          onClick={() => setShowTranslationDetails(!showTranslationDetails)}
                          className="text-[#9A3412] dark:text-amber-400 font-semibold hover:underline flex items-center gap-1 shrink-0 ml-3 cursor-pointer"
                        >
                          <span>{showTranslationDetails ? 'Tutup Detail' : '4 Dialek & Bedah Kata'}</span>
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              showTranslationDetails ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Collapsible 4 Dialects & Word Breakdown */}
              {showTranslationDetails && textTranslationResult && (
                <div className="mt-6 pt-6 border-t border-stone-200/80 dark:border-stone-800 grid grid-cols-1 lg:grid-cols-12 gap-8 text-sm">
                  <div className="lg:col-span-7 space-y-3">
                    <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                      Perbandingan 4 Wilayah Dialek Simalungun
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="pb-3 border-b border-stone-200/70 dark:border-stone-800">
                        <span className="text-xs text-stone-500 block">Dialek Raya (Umum)</span>
                        <span className="font-serif font-semibold text-base mt-0.5 block">
                          {textTranslationResult.dialectComparison.raya}
                        </span>
                      </div>
                      <div className="pb-3 border-b border-stone-200/70 dark:border-stone-800">
                        <span className="text-xs text-stone-500 block">Silimakuta (Simalungun Atas)</span>
                        <span className="font-serif font-semibold text-base mt-0.5 block">
                          {textTranslationResult.dialectComparison.silimakuta}
                        </span>
                      </div>
                      <div className="pb-3 border-b border-stone-200/70 dark:border-stone-800">
                        <span className="text-xs text-stone-500 block">Topi Pasir (Pinggir Danau)</span>
                        <span className="font-serif font-semibold text-base mt-0.5 block">
                          {textTranslationResult.dialectComparison.topiPasir}
                        </span>
                      </div>
                      <div className="pb-3 border-b border-stone-200/70 dark:border-stone-800">
                        <span className="text-xs text-stone-500 block">Jahe-jahe (Simalungun Bawah)</span>
                        <span className="font-serif font-semibold text-base mt-0.5 block">
                          {textTranslationResult.dialectComparison.jaheJahe}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-3">
                    <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                      Bedah Kosakata Kalimat
                    </h3>
                    <div className="divide-y divide-stone-200/70 dark:divide-stone-800">
                      {textTranslationResult.wordBreakdown.map((w, i) => (
                        <div key={i} className="py-2.5 flex items-center justify-between gap-4">
                          <div>
                            <strong className="font-serif text-base">{w.word}</strong>{' '}
                            <span className="text-xs text-stone-500">· {w.partOfSpeech}</span>
                          </div>
                          <span className="font-semibold text-[#9A3412] dark:text-amber-400">
                            {w.meaning}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Phrase Examples */}
              <div className="mt-6 pt-5 border-t border-stone-100 dark:border-stone-800/80 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="text-stone-500 mr-1">Contoh cepat:</span>
                <button
                  onClick={() => {
                    setInputText('1 Musa 1:1');
                    setTranslateDirection('id-to-smg');
                    setTextTranslationResult(
                      translateOfflineInstant('1 Musa 1:1', 'id-to-smg', 'alkitab', allLexicon)
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#9A3412]/10 dark:bg-amber-950/60 text-[#9A3412] dark:text-amber-300 font-semibold hover:bg-[#9A3412]/20 transition-colors cursor-pointer"
                >
                  1 Musa 1:1 (Verbatim PDF)
                </button>
                {NATURAL_PHRASEBOOK.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(item.indonesian);
                      setTranslateDirection('id-to-smg');
                      setTextTranslationResult(
                        translateOfflineInstant(
                          item.indonesian,
                          'id-to-smg',
                          speechStyle,
                          allLexicon
                        )
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-[#F3EFE6] dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                  >
                    {item.indonesian}
                  </button>
                ))}
              </div>

              {/* Saved Translations Cache Bar */}
              {savedTranslations.length > 0 && (
                <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="font-semibold text-stone-700 dark:text-stone-300">
                      Riwayat Cache Terjemahan Tersimpan ({savedTranslations.length})
                    </span>
                    <span>Tersimpan di Cache Browser</span>
                  </div>
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                    {savedTranslations.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 text-xs flex items-center gap-2.5 shrink-0"
                      >
                        <button
                          onClick={() => {
                            setInputText(item.sourceText);
                            setTextTranslationResult(
                              translateOfflineInstant(
                                item.sourceText,
                                translateDirection,
                                speechStyle,
                                allLexicon
                              )
                            );
                          }}
                          className="text-left cursor-pointer"
                        >
                          <div className="font-semibold text-stone-800 dark:text-stone-200 truncate max-w-[200px]">
                            {item.sourceText}
                          </div>
                          <div className="text-xs text-[#9A3412] dark:text-amber-400 font-serif truncate max-w-[200px]">
                            → {item.translatedText}
                          </div>
                        </button>
                        <button
                          onClick={() => handleDeleteSavedTranslation(item.id)}
                          className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <BibleCorpusExplorer />

            {/* Verbatim 4 PDF Direct Search Bar */}
            <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                    Pencarian Verbatim di 4 Dokumen PDF Asli
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-0.5">
                    Periksa kalimat asli langsung di dalam PDF <em>Alkitab Simalungun 2007</em> & <em>Kamus Balai Bahasa</em>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs shrink-0">
                  {[
                    'Bani mula ni mulani',
                    'jaga ma uhurmu',
                    'Jahowa do siparmahan',
                    'bapa tongah',
                  ].map((sampleQ, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setPdfSearchQuery(sampleQ);
                        handleSearchVerbatimPdf(undefined, sampleQ);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-900 hover:bg-[#F3EFE6] text-stone-700 dark:text-stone-300 font-medium cursor-pointer"
                    >
                      {sampleQ}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={(e) => handleSearchVerbatimPdf(e)} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={pdfSearchQuery}
                  onChange={(e) => setPdfSearchQuery(e.target.value)}
                  placeholder="Ketik kata atau potongan ayat (misal: Bani mula ni mulani)..."
                  className="min-h-[44px] flex-1 px-4 py-2.5 text-sm bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-200/90 dark:border-stone-800 focus:outline-none focus:border-[#9A3412]"
                />
                <button
                  type="submit"
                  disabled={isSearchingPdf}
                  className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>{isSearchingPdf ? 'Mencari di PDF...' : 'Cari di PDF'}</span>
                </button>
              </form>

              {pdfSearchResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {pdfSearchResults.map((hit, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 space-y-1.5"
                    >
                      <div className="text-xs font-semibold text-[#9A3412] dark:text-amber-400">
                        {hit.docTitle} · Kutipan Verbatim PDF
                      </div>
                      <p className="text-sm sm:text-base font-serif text-stone-900 dark:text-stone-100 leading-relaxed">
                        &ldquo;...{hit.snippet}...&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Clean Dictionary Split View */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 5 Cols: Dictionary Search & Word List */}
              <div className="lg:col-span-5 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
                      Kamus Simalungun–Indonesia
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {filteredEntries.length} entri terverifikasi ·{' '}
                      <button
                        onClick={() => setShowAddWordModal(true)}
                        className="text-[#9A3412] dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                      >
                        + Tambah Kata Baru
                      </button>
                    </p>
                  </div>
                </div>

                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari kosakata (manggila, tiga, lawei, margoni)..."
                    className="min-h-[44px] w-full pl-10 pr-8 py-2.5 text-sm bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-200/90 dark:border-stone-800 focus:outline-none focus:border-[#9A3412]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 p-1 bg-stone-100 dark:bg-stone-900 rounded-xl mb-3">
                  {(
                    [
                      'Semua',
                      'Percakapan Harian',
                      'Adat & Partuturan',
                      'Alkitab / Pustaka',
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {cat === 'Percakapan Harian'
                        ? 'Harian'
                        : cat === 'Adat & Partuturan'
                        ? 'Partuturan'
                        : cat === 'Alkitab / Pustaka'
                        ? 'Alkitab'
                        : cat}
                    </button>
                  ))}
                </div>

                <div className="divide-y divide-stone-100 dark:divide-stone-800/70 max-h-[280px] lg:max-h-[480px] overflow-y-auto pr-1">
                  {filteredEntries.map((entry) => {
                    const isSelected = selectedEntry.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className={`w-full text-left py-3 px-3.5 rounded-xl transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-[#F3EFE6] dark:bg-stone-800 font-semibold'
                            : 'hover:bg-stone-50 dark:hover:bg-stone-900'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                            {entry.simalungun}{' '}
                            <span className="text-xs font-sans font-normal text-stone-500">
                              · {entry.partOfSpeech}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 truncate">
                            {entry.indonesian}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right 7 Cols: Selected Word Details (Editorial Catalog Layout) */}
              <div className="lg:col-span-7 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-stone-200/70 dark:border-stone-800">
                  <div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 mb-1.5">
                      <span>{selectedEntry.partOfSpeech}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{selectedEntry.category}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono">[{selectedEntry.phonetic}]</span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 dark:text-stone-100">
                      {selectedEntry.simalungun}
                    </h3>
                    <p className="text-lg sm:text-xl font-semibold text-[#9A3412] dark:text-amber-400 mt-1.5">
                      {selectedEntry.indonesian}
                    </p>
                  </div>

                  <button
                    onClick={() => handlePlayPronunciation(selectedEntry.simalungun)}
                    className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl flex items-center gap-2 shrink-0 self-start cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Lafalkan Kata</span>
                  </button>
                </div>

                {/* 4 Dialects Clean Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-stone-200/70 dark:border-stone-800">
                  <div>
                    <span className="text-xs text-stone-500 block">Dialek Raya</span>
                    <span className="font-serif font-bold text-base mt-0.5 block text-stone-900 dark:text-stone-100">
                      {selectedEntry.dialects.raya}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">Silimakuta (Atas)</span>
                    <span className="font-serif font-bold text-base mt-0.5 block text-stone-900 dark:text-stone-100">
                      {selectedEntry.dialects.silimakuta}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">Topi Pasir</span>
                    <span className="font-serif font-bold text-base mt-0.5 block text-stone-900 dark:text-stone-100">
                      {selectedEntry.dialects.topiPasir}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">Jahe-jahe (Bawah)</span>
                    <span className="font-serif font-bold text-base mt-0.5 block text-stone-900 dark:text-stone-100">
                      {selectedEntry.dialects.jaheJahe}
                    </span>
                  </div>
                </div>

                {selectedEntry.dialects.notes && (
                  <p className="text-sm sm:text-base text-stone-700 dark:text-stone-300 leading-relaxed">
                    {selectedEntry.dialects.notes}
                  </p>
                )}

                {selectedEntry.dailyExamples.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                      Contoh Percakapan Sehari-hari
                    </h4>
                    <div className="divide-y divide-stone-200/70 dark:divide-stone-800">
                      {selectedEntry.dailyExamples.map((ex, i) => (
                        <div
                          key={i}
                          className="py-3 flex items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <p className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">
                              &ldquo;{ex.simalungun}&rdquo;
                            </p>
                            <p className="text-sm text-stone-600 dark:text-stone-400">
                              &ldquo;{ex.indonesian}&rdquo;
                            </p>
                          </div>
                          <button
                            onClick={() => handlePlayPronunciation(ex.simalungun)}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#9A3412] hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl cursor-pointer shrink-0"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.biblicalReferences.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-stone-200/70 dark:border-stone-800">
                    <h4 className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                      Ayat Sejajar Verbatim di Bibel Simalungun 2007 & Alkitab TB
                    </h4>
                    <div className="space-y-4">
                      {selectedEntry.biblicalReferences.map((ref, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 space-y-1.5"
                        >
                          <div className="text-xs sm:text-sm font-mono font-bold text-[#1E3A8A] dark:text-blue-400">
                            {ref.reference}
                          </div>
                          <p className="text-base font-serif font-semibold text-stone-900 dark:text-stone-100 leading-relaxed">
                            {ref.simalungunVerse}
                          </p>
                          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                            {ref.indonesianVerse}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* =====================================================================
            MODE 2: KALKULATOR PARTUTURAN FLEKSIBEL (SAVED PROFILE + MODE BANTU TEMAN + PLAIN-TEXT MARGA)
           ===================================================================== */}
        {activeMode === 'partuturan-adat' && (
          <div className="space-y-6">
            {/* Top Card: Mode Toggle (Profil Saya vs Bantu Orang Lain), Profile Editor, & Instant Question Box */}
            <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
                    Kalkulator & Penentu Sapaan Partuturan Simalungun
                  </h1>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Tidak wajib isi dari awal! Profil Anda tersimpan otomatis di cache & Cloud, atau aktifkan <strong>Mode Bantu Orang Lain</strong> jika sedang menghitungkan punya teman. Mendukung <strong>ketik bebas marga Toba/Karo/Lainnya</strong> (dihitung lewat istri atau orang tuanya).
                  </p>
                </div>

                {/* Mode Switcher: Pakai Profilku vs Mode Bantu Orang Lain */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex items-center p-1 bg-stone-100 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
                    <button
                      onClick={() => setIsHelpingFriendMode(false)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        !isHelpingFriendMode
                          ? 'bg-[#9A3412] text-white shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      Pakai Profil Saya ({myName || formatMargaLabel(myMarga).split(' ')[0]})
                    </button>
                    <button
                      onClick={() => setIsHelpingFriendMode(true)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        isHelpingFriendMode
                          ? 'bg-[#1E3A8A] text-white shadow-xs'
                          : 'text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      Mode Bantu Orang Lain (Tanpa Ubah Profilku)
                    </button>
                  </div>

                  {!isHelpingFriendMode && (
                    <button
                      onClick={() => setShowProfileEditor(!showProfileEditor)}
                      className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs flex items-center gap-2 hover:border-[#9A3412] transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#9A3412]" />
                      <span>
                        {showProfileEditor ? 'Tutup Data Profilku' : 'Isi / Edit Nama & Marga Saya'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Active Profile Summary Pill */}
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-semibold text-[#9A3412] dark:text-amber-400">
                    {isHelpingFriendMode ? 'Mode Bantu Teman Aktif:' : 'Database Profil Tersimpan:'}
                  </span>
                  <span>
                    Nama: <strong>{activePersonName}</strong> ({activeGender})
                  </span>
                  <span>
                    Marga: <strong>{formatMargaLabel(activeMarga)}</strong>
                  </span>
                  <span>
                    Ibu (Boru Tulang): <strong>Boru {formatMargaLabel(activeMotherMarga)}</strong>
                  </span>
                  <span>
                    Pasangan: <strong>{formatMargaLabel(activeSpouseMarga)}</strong>
                  </span>
                </div>
                {!isHelpingFriendMode && (
                  <button
                    onClick={handleSaveProfileToCache}
                    disabled={isSavingProfile}
                    className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingProfile ? 'Menyimpan...' : 'Simpan ke Cache'}
                  </button>
                )}
              </div>

              {/* Temporary Helper Editor when "Mode Bantu Orang Lain" is active */}
              {isHelpingFriendMode && (
                <div className="p-4 mb-5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#1E3A8A] dark:text-blue-300">
                      Mode Bantu Orang Lain: Ketik marga teman Anda di bawah ini (Data profil asli Anda aman & tidak berubah!)
                    </span>
                    <div className="flex items-center p-1 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700">
                      <button
                        onClick={() => setHelperGender('Laki-laki')}
                        className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                          helperGender === 'Laki-laki' ? 'bg-[#1E3A8A] text-white' : 'text-stone-500'
                        }`}
                      >
                        Teman Laki-laki
                      </button>
                      <button
                        onClick={() => setHelperGender('Perempuan')}
                        className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                          helperGender === 'Perempuan' ? 'bg-[#1E3A8A] text-white' : 'text-stone-500'
                        }`}
                      >
                        Teman Perempuan
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-stone-500 mb-1">Nama Teman</label>
                      <input
                        type="text"
                        value={helperName}
                        onChange={(e) => setHelperName(e.target.value)}
                        placeholder="Nama teman..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">
                        Marga Teman (Bebas Ketik Toba/Simalungun)
                      </label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={helperMarga}
                        onChange={(e) => setHelperMarga(e.target.value)}
                        placeholder="Misal: Simanjuntak / Saragih..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">Marga Ibu Teman (Boru)</label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={helperMotherMarga}
                        onChange={(e) => setHelperMotherMarga(e.target.value)}
                        placeholder="Misal: Purba / Siahaan..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">Marga Istri/Suami Teman</label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={helperSpouseMarga}
                        onChange={(e) => setHelperSpouseMarga(e.target.value)}
                        placeholder="Misal: Damanik / Siregar..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">Boru Mama Mertua Teman</label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={helperSpouseMotherMarga}
                        onChange={(e) => setHelperSpouseMotherMarga(e.target.value)}
                        placeholder="Misal: Sinaga..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsible Saved Profile Editor (Names + Plain-Text Margas + Local Cache Save) */}
              {showProfileEditor && !isHelpingFriendMode && (
                <div className="p-5 mb-5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200/80 dark:border-stone-800">
                    <div>
                      <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 block">
                        Database Profil & Keluarga Saya (Otomatis Tersimpan di Cache Browser)
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Semua kolom marga di bawah ini <strong>bisa diketik bebas (plain text)</strong> — boleh isi marga Simalungun maupun Toba/Karo/Pakpak (contoh: Simanjuntak, Siahaan, Siregar, Ginting).
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center p-1 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 text-xs">
                        <button
                          onClick={() => setMyGender('Laki-laki')}
                          className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                            myGender === 'Laki-laki' ? 'bg-[#9A3412] text-white' : 'text-stone-500'
                          }`}
                        >
                          Saya Laki-laki
                        </button>
                        <button
                          onClick={() => setMyGender('Perempuan')}
                          className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                            myGender === 'Perempuan' ? 'bg-[#9A3412] text-white' : 'text-stone-500'
                          }`}
                        >
                          Saya Perempuan
                        </button>
                      </div>
                      <button
                        onClick={handleSaveProfileToCache}
                        disabled={isSavingProfile}
                        className="px-3.5 py-1.5 rounded-lg bg-[#9A3412] hover:bg-[#7C2D12] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                      </button>
                    </div>
                  </div>

                  {/* Row 1: Family Names */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-stone-500 mb-1">Nama Lengkap Saya</label>
                      <input
                        type="text"
                        value={myName}
                        onChange={(e) => setMyName(e.target.value)}
                        placeholder="Contoh: Joy Saragih"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">Nama Bapak & Ibu Kandung</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={myFatherName}
                          onChange={(e) => setMyFatherName(e.target.value)}
                          placeholder="Nama Bapak..."
                          className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                        />
                        <input
                          type="text"
                          value={myMotherName}
                          onChange={(e) => setMyMotherName(e.target.value)}
                          placeholder="Nama Ibu..."
                          className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">
                        Nama Istri/Suami/Pacar & Mertua
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={mySpouseName}
                          onChange={(e) => setMySpouseName(e.target.value)}
                          placeholder="Nama Pasangan..."
                          className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                        />
                        <input
                          type="text"
                          value={myMotherInLawName}
                          onChange={(e) => setMyMotherInLawName(e.target.value)}
                          placeholder="Nama Mertua..."
                          className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Plain-Text Margas with Datalist Suggestions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                    <div>
                      <label className="block text-stone-500 mb-1">
                        1. Marga Saya / Bapak (Ketik Bebas: Simalungun/Toba/Lainnya)
                      </label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={myMarga}
                        onChange={(e) => setMyMarga(e.target.value)}
                        placeholder="Ketik marga (misal: Saragih Sumbayak / Simanjuntak)..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">
                        2. Boru Ibu Kandung (Marga Tulang — Ketik Bebas)
                      </label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={myMotherMarga}
                        onChange={(e) => setMyMotherMarga(e.target.value)}
                        placeholder="Ketik boru Ibu (misal: Purba Pakpak / Siahaan)..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">
                        3. Marga Istri / Suami / Pacar (Ketik Bebas)
                      </label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={mySpouseMarga}
                        onChange={(e) => setMySpouseMarga(e.target.value)}
                        placeholder="Ketik marga pasangan (misal: Purba Tambak / Siregar)..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">
                        4. Boru Mama Mertua (Mama Istri/Pacar)
                      </label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={mySpouseMotherMarga}
                        onChange={(e) => setMySpouseMotherMarga(e.target.value)}
                        placeholder="Ketik boru Mama Mertua..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">
                        5. Boru Ompung dari Bapak (Tingkat 2)
                      </label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={myFatherMotherMarga}
                        onChange={(e) => setMyFatherMotherMarga(e.target.value)}
                        placeholder="Ketik boru Ompung dari Bapak..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-500 mb-1">
                        6. Boru Ompung dari Ibu (Tingkat 2)
                      </label>
                      <input
                        type="text"
                        list="marga-suggestions"
                        value={myMotherMotherMarga}
                        onChange={(e) => setMyMotherMotherMarga(e.target.value)}
                        placeholder="Ketik boru Ompung dari Ibu..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Natural Question Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={quickKinshipQuery}
                  onChange={(e) => setQuickKinshipQuery(e.target.value)}
                  placeholder="Ketik siapa yang ingin dipanggil (contoh: bapatua, bapatongah, bapanggi, mama pacar, opung istri, abang istri)..."
                  className="w-full pl-11 pr-9 py-3 text-sm bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-none focus:border-[#9A3412]"
                />
                {quickKinshipQuery && (
                  <button
                    onClick={() => setQuickKinshipQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Question Chips (Including Bapatua, Bapatongah, Bapanggi!) */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs">
                <span className="text-stone-400">Pertanyaan populer:</span>
                {[
                  'Bapatua (Abang Bapak)',
                  'Bapatongah (Tengah)',
                  'Bapanggi (Adik Bapak)',
                  'Mama pacar / istri',
                  'Bapak pacar / istri',
                  'Opung istri',
                  'Abang mama istri',
                  'Abang istri (ipar)',
                  'Istri abang ipar',
                  'Suami bibi (Amboru)',
                ].map((qLabel, i) => (
                  <button
                    key={i}
                    onClick={() => setQuickKinshipQuery(qLabel.split(' (')[0])}
                    className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-[#F3EFE6] text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                  >
                    {qLabel}
                  </button>
                ))}
              </div>

              {/* Instant Answer Card if user typed or clicked a popular question */}
              {matchedQuickKinship && (
                <div className="mt-4 p-5 rounded-xl bg-[#F3EFE6]/90 dark:bg-stone-900 border border-[#9A3412]/30 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-[#9A3412] dark:text-amber-400">
                        Jawaban Instan untuk: {matchedQuickKinship.questionLabel}
                      </div>
                      <div className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 mt-1">
                        {activeGender === 'Laki-laki'
                          ? matchedQuickKinship.sapaanLaki
                          : matchedQuickKinship.sapaanPerempuan}
                      </div>
                      <div className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                        Panggilan balasan ke Anda: <strong>{matchedQuickKinship.balasan}</strong> ·
                        Posisi Adat: <strong>{matchedQuickKinship.posisiAdat}</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePlayPronunciation(matchedQuickKinship.contohKalimat)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-[#9A3412] rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      Dengarkan Sapaan
                    </button>
                  </div>
                  <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                    {matchedQuickKinship.penjelasan}
                  </p>
                  <div className="p-3 rounded-lg bg-white dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 text-xs">
                    <span className="font-serif font-semibold text-stone-900 dark:text-stone-100">
                      &ldquo;{matchedQuickKinship.contohKalimat}&rdquo;
                    </span>{' '}
                    <span className="text-stone-500">({matchedQuickKinship.artiKalimat})</span>
                  </div>
                </div>
              )}
            </section>

            {/* Sub-Mode Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPartuturanMode('kenalan-baru')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  partuturanMode === 'kenalan-baru'
                    ? 'bg-[#9A3412] text-white shadow-xs'
                    : 'bg-white dark:bg-[#181615] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                1. Baru Kenal Orang (Martarombo Marga & Jalur Istri/Orangtua)
              </button>

              <button
                onClick={() => setPartuturanMode('jalur-keluarga')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  partuturanMode === 'jalur-keluarga'
                    ? 'bg-[#9A3412] text-white shadow-xs'
                    : 'bg-white dark:bg-[#181615] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
                }`}
              >
                <Users className="w-4 h-4" />
                2. Penyusun Jalur Silsilah (Bapatua, Bapatongah, Bapanggi, dll.)
              </button>

              <button
                onClick={() => setPartuturanMode('kamus-tutur')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  partuturanMode === 'kamus-tutur'
                    ? 'bg-[#9A3412] text-white shadow-xs'
                    : 'bg-white dark:bg-[#181615] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                3. Tabel Lengkap Partuturan & Marga SISADAPUR
              </button>
            </div>

            {/* SUB-MODE 1: BARU KENAL ORANG (MARTAROMBO — SUPPORTS PLAIN TEXT TOBA/KARO + SPOUSE/MOTHER CALCULATION) */}
            {partuturanMode === 'kenalan-baru' && (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-6 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 space-y-5">
                  <div>
                    <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
                      Ketemu Orang Baru: Panggil Siapa?
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Bisa pilih 4 marga SISADAPUR atau <strong>ketik bebas marga Toba/Karo/Lainnya</strong>. Jika marganya Toba/lainnya, isi marga Istri atau Ibunya di bawah agar tetap terhitung partuturannya!
                    </p>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Quick 4 Main Clan Buttons */}
                    <div>
                      <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                        Klik Cepat 4 Marga Induk Simalungun (SISADAPUR):
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(
                          [
                            { main: 'Sinaga', defaultSub: 'Sinaga Bonor' },
                            { main: 'Saragih', defaultSub: 'Saragih Sumbayak' },
                            { main: 'Damanik', defaultSub: 'Damanik Tomok' },
                            { main: 'Purba', defaultSub: 'Purba Pakpak' },
                          ] as const
                        ).map((clan) => {
                          const isSelected = getMainMarga(strangerMarga) === clan.main;
                          return (
                            <button
                              key={clan.main}
                              onClick={() => setStrangerMarga(clan.defaultSub)}
                              className={`py-2 px-3 rounded-xl font-serif font-bold text-sm border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#9A3412] text-white border-[#9A3412]'
                                  : 'bg-[#FAF8F5] dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-800'
                              }`}
                            >
                              {strangerGender === 'Perempuan' ? `Boru ${clan.main}` : clan.main}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Plain-Text Input for Stranger Name & Marga */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Nama Beliau (Opsional):
                        </label>
                        <input
                          type="text"
                          value={strangerName}
                          onChange={(e) => setStrangerName(e.target.value)}
                          placeholder="Misal: Bang Hendra..."
                          className="w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Ketik Marga Beliau (Simalungun / Toba / Lainnya):
                        </label>
                        <input
                          type="text"
                          list="marga-suggestions"
                          value={strangerMarga}
                          onChange={(e) => setStrangerMarga(e.target.value)}
                          placeholder="Ketik bebas: Purba / Simanjuntak / Siahaan..."
                          className="w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 font-semibold"
                        />
                      </div>
                    </div>

                    {/* Quick Toba/Karo Marga Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-stone-400">Contoh marga Toba/Karo:</span>
                      {[
                        'Simanjuntak',
                        'Siahaan',
                        'Siregar',
                        'Pasaribu',
                        'Pangaribuan',
                        'Sitompul',
                        'Ginting',
                        'Sembiring',
                      ].map((tm) => (
                        <button
                          key={tm}
                          onClick={() => setStrangerMarga(tm)}
                          className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 hover:bg-[#F3EFE6] text-[11px] text-stone-600 dark:text-stone-300 cursor-pointer"
                        >
                          {tm}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                          Jenis Kelamin Dia
                        </label>
                        <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 dark:bg-stone-900 rounded-lg">
                          <button
                            onClick={() => setStrangerGender('Laki-laki')}
                            className={`py-2 rounded-md font-semibold cursor-pointer ${
                              strangerGender === 'Laki-laki'
                                ? 'bg-white dark:bg-stone-800 text-[#9A3412] shadow-xs'
                                : 'text-stone-500'
                            }`}
                          >
                            Laki-laki
                          </button>
                          <button
                            onClick={() => setStrangerGender('Perempuan')}
                            className={`py-2 rounded-md font-semibold cursor-pointer ${
                              strangerGender === 'Perempuan'
                                ? 'bg-white dark:bg-stone-800 text-[#9A3412] shadow-xs'
                                : 'text-stone-500'
                            }`}
                          >
                            Perempuan
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                          Perkiraan Usia Dia
                        </label>
                        <select
                          value={strangerAgeGroup}
                          onChange={(e) => setStrangerAgeGroup(e.target.value as any)}
                          className="w-full px-2.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 font-semibold"
                        >
                          <option value="sebaya">Sebaya / Seumuran</option>
                          <option value="orang-tua">Seusia Bapak / Ibu</option>
                          <option value="ompung">Seusia Ompung</option>
                          <option value="lebih-muda">Lebih Muda / Adik</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                          Urutan Lahir (Jika Seusia Ortu)
                        </label>
                        <select
                          value={strangerBirthOrder}
                          onChange={(e) => setStrangerBirthOrder(e.target.value as any)}
                          className="w-full px-2.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 font-semibold"
                        >
                          <option value="umum">Umum / Belum Tahu</option>
                          <option value="tua">Kakak/Abang Ortu (Tua → Bapatua)</option>
                          <option value="tongah">Urutan Tengah (Tongah → Bapatongah)</option>
                          <option value="anggi">Adik Ortu (Anggi → Bapanggi)</option>
                        </select>
                      </div>
                    </div>

                    {/* Crucial Feature: Calculate from Stranger's Spouse or Mother Marga (Plain Text!) */}
                    <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-3">
                      <div className="text-[11px] font-semibold text-[#9A3412] dark:text-amber-400">
                        Hitung dari Jalur Istri / Suami atau Orang Tua Beliau (Sangat berguna jika marga beliau Toba/Lainnya):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-stone-500 mb-1">
                            Marga Istri / Suami Beliau (Ketik Bebas):
                          </label>
                          <input
                            type="text"
                            list="marga-suggestions"
                            value={strangerSpouseMarga}
                            onChange={(e) => setStrangerSpouseMarga(e.target.value)}
                            placeholder="Misal: Saragih / Purba / Kosongkan..."
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                          />
                        </div>
                        <div>
                          <label className="block text-stone-500 mb-1">
                            Marga Ibu Kandung Beliau / Boru (Ketik Bebas):
                          </label>
                          <input
                            type="text"
                            list="marga-suggestions"
                            value={strangerMotherMarga}
                            onChange={(e) => setStrangerMotherMarga(e.target.value)}
                            placeholder="Misal: Damanik / Sinaga / Kosongkan..."
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Output Card for Stranger (Large, Clear Typography & High Contrast on HP) */}
                <div className="lg:col-span-6 bg-white dark:bg-[#181615] rounded-2xl border-2 border-[#9A3412]/30 dark:border-amber-800/40 p-5 sm:p-8 space-y-5 shadow-xs">
                  <div className="p-5 sm:p-6 rounded-2xl bg-[#F3EFE6]/90 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#9A3412] dark:text-amber-400">
                        Panggilan yang Tepat ({activePersonName} → Beliau):
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-white dark:bg-stone-800 text-xs font-semibold text-[#1E3A8A] dark:text-blue-300 border border-stone-200 dark:border-stone-700">
                        {strangerResult.jalurTerdeteksi}
                      </span>
                    </div>
                    <div className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 leading-tight">
                      {strangerResult.sapaanUtama}
                    </div>
                    <div className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 pt-1">
                      Beliau memanggil {activePersonName}: <strong>{strangerResult.panggilanBalasan}</strong> ·
                      Kedudukan:{' '}
                      <strong className="text-[#1E3A8A] dark:text-blue-400">
                        {strangerResult.kategoriAdat}
                      </strong>
                    </div>
                  </div>

                  <div className="text-sm sm:text-base text-stone-800 dark:text-stone-200 leading-relaxed bg-[#FAF8F5] dark:bg-stone-900/60 p-4 rounded-xl border border-stone-200/70 dark:border-stone-800">
                    <strong className="text-[#9A3412] dark:text-amber-400 block mb-1">
                      Penjelasan Adat (Martarombo):
                    </strong>
                    {strangerResult.alasan}
                  </div>

                  <div className="p-4 sm:p-5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300">
                        Contoh Kalimat Sapaan Saat Berkenalan:
                      </span>
                      <button
                        onClick={() => handlePlayPronunciation(strangerResult.kalimatSapaan)}
                        className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-[#9A3412] rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Volume2 className="w-4 h-4" />
                        Dengarkan
                      </button>
                    </div>
                    <p className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-100 leading-relaxed">
                      &ldquo;{strangerResult.kalimatSapaan}&rdquo;
                    </p>
                    <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                      Artinya: &ldquo;{strangerResult.artiSapaan}&rdquo;
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-100/80 dark:bg-stone-900/70 text-xs sm:text-sm text-stone-700 dark:text-stone-300 flex items-center justify-between gap-3">
                    <span>
                      Cara sopan menanyakan marga saat baru kenal:{' '}
                      <strong className="text-stone-900 dark:text-stone-100 font-serif block sm:inline mt-0.5 sm:mt-0">
                        &ldquo;Santabi ham, marga/boru aha do ham, tene?&rdquo;
                      </strong>
                    </span>
                    <button
                      onClick={() =>
                        handlePlayPronunciation('Santabi ham, marga aha do ham, tene?')
                      }
                      className="p-2 text-[#9A3412] bg-white dark:bg-stone-800 rounded-lg shrink-0 cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* SUB-MODE 2: PENYUSUN JALUR SILSILAH FLEKSIBEL (CHAIN BUILDER) */}
            {partuturanMode === 'jalur-keluarga' && (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-6 space-y-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                      Penyusun Jalur Hubungan Keluarga Fleksibel (Bapatua, Bapatongah, Bapanggi)
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                      Klik tombol hubungan secara berurutan (misal:{' '}
                      <strong>Saya → Bapak → Saudara Tengah (Tongah)</strong> untuk melihat panggilan{' '}
                      <strong>Bapa Tongah / Bapatongah</strong>). Tanpa perlu mengisi marga!
                    </p>
                  </div>

                  {/* Current Chain Breadcrumb */}
                  <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-300">
                        Jalur Hubungan Saat Ini (Klik langkah untuk memotong):
                      </span>
                      <button
                        onClick={() => setRelationChain([])}
                        className="text-xs sm:text-sm text-red-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Reset Jalur
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-3 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs sm:text-sm font-semibold">
                        {activePersonName} ({activeGender})
                      </span>
                      {relationChain.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                          <button
                            onClick={() => setRelationChain(relationChain.slice(0, idx + 1))}
                            className="px-3 py-1.5 rounded-lg bg-[#9A3412] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                          >
                            {stepLabels[step]}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Buttons to Add Next Step in Chain */}
                  <div className="space-y-2.5">
                    <div className="text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-300">
                      + Tambahkan Langkah Hubungan Berikutnya (Bisa Sampai 4 Tingkat):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {(Object.keys(stepLabels) as RelationStep[]).map((stepKey) => (
                        <button
                          key={stepKey}
                          disabled={relationChain.length >= 4}
                          onClick={() => setRelationChain([...relationChain, stepKey])}
                          className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 hover:bg-[#F3EFE6] dark:hover:bg-stone-800 disabled:opacity-40 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm font-semibold text-left flex items-center justify-between cursor-pointer"
                        >
                          <span>+ {stepLabels[stepKey]}</span>
                          <Plus className="w-4 h-4 text-[#9A3412] shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* One-Click Preset Chains (Including Bapatua, Bapatongah, Bapanggi!) */}
                  <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-2.5">
                    <div className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400">
                      Atau Pilih Jalur Silsilah Cepat (1 Klik):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        {
                          label: 'Abang Bapak (Bapatua)',
                          chain: ['ayah', 'abang'] as RelationStep[],
                        },
                        {
                          label: 'Saudara Tengah Bapak (Bapatongah)',
                          chain: ['ayah', 'saudara-tengah'] as RelationStep[],
                        },
                        {
                          label: 'Adik Laki-laki Bapak (Bapanggi)',
                          chain: ['ayah', 'adik-laki'] as RelationStep[],
                        },
                        { label: 'Mama dari Istri', chain: ['pasangan', 'ibu'] as RelationStep[] },
                        { label: 'Bapak dari Istri', chain: ['pasangan', 'ayah'] as RelationStep[] },
                        {
                          label: 'Ompung dari Mama Istri',
                          chain: ['pasangan', 'ibu', 'ayah'] as RelationStep[],
                        },
                        {
                          label: 'Ompung dari Bapak Istri',
                          chain: ['pasangan', 'ayah', 'ayah'] as RelationStep[],
                        },
                        {
                          label: 'Abang Laki-laki Mama Istri',
                          chain: ['pasangan', 'ibu', 'abang'] as RelationStep[],
                        },
                        {
                          label: 'Istri dari Abang Istri',
                          chain: ['pasangan', 'abang', 'pasangan'] as RelationStep[],
                        },
                        {
                          label: 'Istri dari Abang Kandung',
                          chain: ['abang', 'pasangan'] as RelationStep[],
                        },
                        {
                          label: 'Suami dari Bibi (Amboru)',
                          chain: ['ayah', 'kakak-perempuan', 'pasangan'] as RelationStep[],
                        },
                      ].map((preset, i) => (
                        <button
                          key={i}
                          onClick={() => setRelationChain(preset.chain)}
                          className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-900 hover:bg-stone-200 text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-300 cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Output Card for Chain (High-Contrast & Easy to Read) */}
                <div className="lg:col-span-5 bg-white dark:bg-[#181615] rounded-2xl border-2 border-[#9A3412]/30 dark:border-amber-800/40 p-5 sm:p-8 space-y-5 shadow-xs">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Jalur Silsilah:
                    </div>
                    <div className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">
                      {chainResult.chainTitle}
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl bg-[#F3EFE6]/90 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2">
                    <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#9A3412] dark:text-amber-400">
                      Panggilan Simalungun:
                    </div>
                    <div className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 leading-tight">
                      {chainResult.sapaan}
                    </div>
                    <div className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 pt-1">
                      Beliau memanggil Anda: <strong>{chainResult.balasan}</strong>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-sm sm:text-base">
                    <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Posisi Adat:
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 font-bold text-[#1E3A8A] dark:text-blue-400">
                      {chainResult.posisi}
                    </div>
                    <p className="text-stone-800 dark:text-stone-200 leading-relaxed pt-1">
                      {chainResult.penjelasan}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* SUB-MODE 3: DAFTAR LENGKAP ISTILAH PARTUTURAN & MARGA SISADAPUR */}
            {partuturanMode === 'kamus-tutur' && (
              <div className="space-y-8">
                <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
                      Tabel Lengkap Istilah Partuturan Simalungun
                    </h2>
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={partuturanSearch}
                        onChange={(e) => setPartuturanSearch(e.target.value)}
                        placeholder="Cari panggilan (Tulang, Anturang, Lawei)..."
                        className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPartuturan.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                              {item.sapaanSimalungun}
                            </h3>
                            <button
                              onClick={() =>
                                handlePlayPronunciation(item.sapaanSimalungun.split('(')[0])
                              }
                              className="p-1 text-stone-400 hover:text-[#9A3412] cursor-pointer"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xs font-semibold text-[#9A3412] dark:text-amber-400">
                            {item.artiHubungan}
                          </div>
                          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                            {item.penjelasanEtika}
                          </p>
                        </div>
                        <div className="pt-2.5 border-t border-stone-200/60 dark:border-stone-800 text-[11px] text-stone-500 flex items-center justify-between">
                          <span>Balasan: {item.panggilanBalasan}</span>
                          <span>{item.sumberKamus.split('(')[0]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Marga SISADAPUR Explorer */}
                <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-serif font-bold">
                        Cabang 4 Marga Induk Simalungun (SISADAPUR)
                      </h3>
                      <p className="text-xs text-stone-500">
                        Sinaga · Saragih · Damanik · Purba beserta sub-marga dan asal kerajaan
                      </p>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-900 rounded-lg text-xs">
                      {(['Semua', 'Sinaga', 'Saragih', 'Damanik', 'Purba'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setSelectedMargaFilter(m)}
                          className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                            selectedMargaFilter === m
                              ? 'bg-white dark:bg-stone-800 text-[#9A3412] shadow-xs'
                              : 'text-stone-500'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {MARGA_SISADAPUR.filter(
                      (m) => selectedMargaFilter === 'Semua' || m.mainMarga === selectedMargaFilter
                    ).map((branch) => (
                      <div
                        key={branch.id}
                        className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800"
                      >
                        <div className="text-[11px] font-mono text-[#9A3412]">
                          Marga {branch.mainMarga}
                        </div>
                        <div className="font-serif font-bold text-sm mt-0.5">{branch.subMarga}</div>
                        <div className="text-stone-500 mt-1">{branch.originNote}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            MODE 3: PENERJEMAH SUARA OTOMATIS (VOICE-TO-TEXT & TTS)
           ===================================================================== */}
        {activeMode === 'voice-translate' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 space-y-6">
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Penerjemah Suara & Pelafalan
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Rekam suara Anda melalui mikrofon atau klik kalimat percakapan di bawah untuk mendengar pelafalan Simalungun.
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-stone-500">Arah Suara:</span>
                <select
                  value={voiceDirection}
                  onChange={(e) => setVoiceDirection(e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 font-medium"
                >
                  <option value="auto">Deteksi Otomatis</option>
                  <option value="id-to-smg">Indonesia → Simalungun</option>
                  <option value="smg-to-id">Simalungun → Indonesia</option>
                </select>
              </div>

              <div className="p-6 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center space-y-4">
                <div className="flex justify-center">
                  {!isRecording ? (
                    <button
                      onClick={startVoiceRecording}
                      disabled={isProcessingVoice}
                      className="w-20 h-20 rounded-full bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-50 text-white flex items-center justify-center shadow-md cursor-pointer"
                    >
                      <Mic className="w-8 h-8" />
                    </button>
                  ) : (
                    <button
                      onClick={stopVoiceRecording}
                      className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md cursor-pointer"
                    >
                      <Square className="w-7 h-7 fill-current" />
                    </button>
                  )}
                </div>

                <div>
                  {isRecording ? (
                    <p className="text-sm font-semibold text-red-600 font-mono">
                      Merekam... 00:{String(recordingSeconds).padStart(2, '0')} (Klik untuk selesai)
                    </p>
                  ) : isProcessingVoice ? (
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-[#9A3412]">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Menerjemahkan suara...
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                      Tekan Mikrofon untuk Berbicara
                    </p>
                  )}
                </div>
              </div>

              {voiceError && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-200">
                  {voiceError}
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold text-stone-500">
                  Klik Kalimat untuk Langsung Terjemahkan & Dengarkan Suara:
                </div>
                {NATURAL_PHRASEBOOK.slice(0, 6).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickVoicePhrase(item.indonesian, 'id-to-smg')}
                    className="w-full text-left p-3 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 hover:bg-[#F3EFE6] border border-stone-200/80 dark:border-stone-800 flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span className="font-medium">&ldquo;{item.indonesian}&rdquo;</span>
                    <Volume2 className="w-4 h-4 text-[#9A3412] shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 sm:p-8">
              {voiceResult ? (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                    <div className="text-xs text-stone-400 mb-1">Kalimat Asli:</div>
                    <p className="text-base font-medium">&ldquo;{voiceResult.correctedTranscript}&rdquo;</p>
                  </div>

                  <div className="p-5 rounded-xl bg-[#F3EFE6]/80 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-[#9A3412]">
                        Terjemahan Simalungun
                      </span>
                      <button
                        onClick={() => handlePlayPronunciation(voiceResult.simalungunTextToSpeak)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#9A3412] rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4" />
                        Putar Suara
                      </button>
                    </div>
                    <p className="text-2xl font-serif font-bold">{voiceResult.translatedText}</p>
                    <p className="text-xs font-mono text-stone-500">[{voiceResult.phoneticGuide}]</p>
                  </div>

                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    {voiceResult.dialectNote}
                  </p>
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-stone-400">
                  Pilih contoh kalimat di samping atau tekan tombol mikrofon untuk melihat hasil terjemahan suara.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            MODE 4: KAMERA & FOTO LANGSUNG TRANSLATE
           ===================================================================== */}
        {activeMode === 'camera-ocr' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-serif font-bold">Kamera & Foto Langsung Translate</h2>
                <p className="text-xs text-stone-500">
                  Ambil foto teks Simalungun/Indonesia atau klik kotak penanda pada gambar untuk melihat arti dan rincian kosakata.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!cameraActive ? (
                  <button
                    onClick={startCameraStream}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Buka Kamera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={capturePhotoFromCamera}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      Ambil Foto
                    </button>
                    <button
                      onClick={stopCameraStream}
                      className="px-3 py-2 text-xs bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                    >
                      Tutup
                    </button>
                  </>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 text-xs font-medium bg-stone-100 dark:bg-stone-900 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Unggah Foto
                </button>

                {SAMPLE_CAMERA_DOCUMENTS.map((doc, idx) => (
                  <button
                    key={doc.id}
                    onClick={() => loadSampleDocumentIntoVision(doc)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg cursor-pointer ${
                      !capturedImageBase64 && selectedSampleDoc.id === doc.id
                        ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                        : 'bg-stone-100 dark:bg-stone-900 text-stone-600'
                    }`}
                  >
                    Contoh {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {cameraError && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                {cameraError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5">
                {cameraActive ? (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video
                      ref={videoElementRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative w-full rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-[#F6F1E5] dark:bg-stone-950 min-h-[380px]">
                    {isAnalyzingImage && (
                      <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center text-white text-xs gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Memindai teks di foto...
                      </div>
                    )}
                    {capturedImageBase64 ? (
                      <img
                        src={capturedImageBase64}
                        alt="Dokumen yang dipindai"
                        referrerPolicy="no-referrer"
                        className="w-full h-auto block max-h-[500px] object-contain mx-auto"
                      />
                    ) : (
                      <div className="p-8 min-h-[380px] flex flex-col justify-between">
                        <div className="text-center border-b border-stone-300 dark:border-stone-800 pb-3">
                          <div className="text-xs font-serif font-bold">
                            {selectedSampleDoc.title}
                          </div>
                        </div>
                        <div className="text-[11px] text-stone-400 text-center pt-3">
                          Klik kotak teks di atas untuk melihat terjemahan dan bedah kosakata
                        </div>
                      </div>
                    )}

                    {visionResult?.detectedRegions.map((region, idx) => {
                      const [ymin, xmin, ymax, xmax] = region.box_2d;
                      const topPct = Math.max(0, Math.min(95, ymin / 10));
                      const leftPct = Math.max(0, Math.min(95, xmin / 10));
                      const heightPct = Math.max(6, Math.min(100 - topPct, (ymax - ymin) / 10));
                      const widthPct = Math.max(10, Math.min(100 - leftPct, (xmax - xmin) / 10));
                      const isActive = activeRegion?.id === region.id;

                      return (
                        <button
                          key={region.id}
                          onClick={() => setActiveRegionId(region.id)}
                          style={{
                            top: `${topPct}%`,
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                          }}
                          className={`absolute text-left p-2.5 rounded-lg transition-all cursor-pointer flex flex-col justify-center ${
                            isActive
                              ? 'border-2 border-[#9A3412] bg-[#9A3412]/15 z-10'
                              : 'border border-stone-400/70 bg-white/50 dark:bg-stone-900/50'
                          }`}
                        >
                          <span className="text-[10px] font-mono font-bold text-[#9A3412]">
                            #{idx + 1}
                          </span>
                          {!capturedImageBase64 && (
                            <span className="text-xs sm:text-sm font-serif font-medium line-clamp-2">
                              {region.sourceText}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 space-y-5">
                {activeRegion && (
                  <div className="space-y-3 pb-4 border-b border-stone-100 dark:border-stone-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#9A3412]">Baris Terpilih</span>
                      <button
                        onClick={() => handlePlayPronunciation(activeRegion.sourceText)}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-[#9A3412] rounded-md flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Lafalkan
                      </button>
                    </div>
                    <p className="text-base font-serif font-semibold">{activeRegion.sourceText}</p>
                    <p className="text-sm text-stone-600 dark:text-stone-300">
                      {activeRegion.translatedText}
                    </p>
                  </div>
                )}

                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Rincian Kosakata di Foto
                  </h3>
                  {visionResult?.vocabularyBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 text-xs space-y-1"
                    >
                      <div className="font-serif font-bold text-sm">
                        {item.word}{' '}
                        <span className="font-sans font-normal text-stone-400">
                          · {item.partOfSpeech}
                        </span>
                      </div>
                      <div className="font-semibold text-[#9A3412]">{item.meaning}</div>
                      <div className="text-stone-500">{item.dialectNote}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODE 5: DODING HALELUYA <-> KJ <-> INGGRIS & VIDEO KOMEDI/PERCAKAPAN
           ===================================================================== */}
        {activeMode === 'doding-video' && (
          <div className="space-y-8 sm:space-y-10">
            {/* Section A: Doding Haleluya <-> KJ <-> English + Lagu Simalungun Auto-Translate (Optimized for HP & Readability) */}
            <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-4 sm:p-6 lg:p-8 space-y-6 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
                    Lagu Simalungun & Doding Haleluya GKPS ↔ Terjemahan Indonesia
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                    Nyaman dibaca di HP maupun Laptop. Lagu Simalungun yang belum punya padanan resmi Kidung Jemaat (KJ) tetap tampil lengkap dengan <span className="font-semibold text-amber-800 dark:text-amber-300 underline decoration-amber-400">Terjemahan Otomatis dari Sistem</span>.
                  </p>
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={hymnSearch}
                    onChange={(e) => setHymnSearch(e.target.value)}
                    placeholder="Cari judul lagu Simalungun, nomor Doding, atau lirik..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-300/80 dark:border-stone-700 focus:outline-none focus:border-[#9A3412]"
                  />
                </div>
              </div>

              {/* Mobile-Friendly Quick Song Picker Dropdown + Horizontal Pills (Visible on HP so user doesn't have to scroll far) */}
              <div className="lg:hidden space-y-2.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Pilih Lagu / Doding ({filteredHymns.length} Lagu Tersedia):
                </label>
                <select
                  value={selectedHymn.id}
                  onChange={(e) => {
                    const found = filteredHymns.find((h) => h.id === e.target.value);
                    if (found) setSelectedHymn(found);
                  }}
                  className="w-full px-3.5 py-3 text-sm font-serif font-bold bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border-2 border-[#9A3412]/40 text-stone-900 dark:text-stone-100"
                >
                  {filteredHymns.map((hymn) => (
                    <option key={`mob-opt-${hymn.id}`} value={hymn.id}>
                      {hymn.haleluyaTitle} ({hymn.haleluyaNumber}) {hymn.isSystemAutoTranslated ? '— [Terjemahan Otomatis]' : `— [${hymn.kjNumber}]`}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {filteredHymns.map((hymn) => (
                    <button
                      key={`mob-pill-${hymn.id}`}
                      onClick={() => setSelectedHymn(hymn)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                        selectedHymn.id === hymn.id
                          ? 'bg-[#9A3412] text-white border-[#9A3412]'
                          : 'bg-[#FAF8F5] dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                      }`}
                    >
                      {hymn.haleluyaTitle}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Desktop Left Sidebar Song List (Hidden on small mobile since mobile has the instant selector above, or shown cleanly on lg) */}
                <div className="hidden lg:block lg:col-span-4 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  {filteredHymns.map((hymn) => (
                    <button
                      key={hymn.id}
                      onClick={() => setSelectedHymn(hymn)}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedHymn.id === hymn.id
                          ? 'bg-[#F3EFE6] dark:bg-stone-800 border-[#9A3412] shadow-xs'
                          : 'bg-[#FAF8F5] dark:bg-stone-900 border-stone-200/80 dark:border-stone-800 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-[#9A3412] dark:text-amber-400">
                          {hymn.haleluyaNumber}
                        </span>
                        {hymn.isSystemAutoTranslated ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 text-[11px] font-semibold border border-amber-300/60">
                            Terjemahan Otomatis
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-mono">
                            {hymn.kjNumber}
                          </span>
                        )}
                      </div>
                      <div className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 mt-1">
                        {hymn.haleluyaTitle}
                      </div>
                      <div className="text-xs text-stone-600 dark:text-stone-400 truncate mt-0.5">
                        {hymn.kjTitle}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Main Song Lyric Reader Panel (Large, Clear, High-Contrast Typography for HP & Desktop) */}
                <div className="lg:col-span-8 bg-[#FAF8F5] dark:bg-stone-900/90 rounded-2xl border border-stone-200/90 dark:border-stone-800 p-4 sm:p-6 lg:p-7 space-y-6">
                  {/* Song Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-stone-200/80 dark:border-stone-800">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-md bg-[#9A3412]/10 dark:bg-amber-950/60 text-[#9A3412] dark:text-amber-300 text-xs font-mono font-bold">
                          {selectedHymn.haleluyaNumber}
                        </span>
                        {selectedHymn.isSystemAutoTranslated ? (
                          <span className="px-3 py-1 rounded-md bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                            Terjemahan Otomatis dari Sistem
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold">
                            Padanan Resmi: {selectedHymn.kjNumber}
                          </span>
                        )}
                      </div>

                      <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 leading-tight pt-1">
                        {selectedHymn.haleluyaTitle}
                      </h3>

                      <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300">
                        {selectedHymn.isSystemAutoTranslated
                          ? 'Judul Arti Indonesia (Otomatis Sistem): '
                          : 'Judul Kidung Jemaat (KJ): '}
                        <strong className="text-stone-900 dark:text-stone-100">{selectedHymn.kjTitle}</strong>
                        {' · '}
                        <span className="italic">{selectedHymn.englishTitle}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start shrink-0">
                      <button
                        onClick={() =>
                          handlePlayPronunciation(selectedHymn.stanzaComparison.simalungunStanza)
                        }
                        className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl flex items-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Volume2 className="w-4 h-4" />
                        Dengarkan Lafal Lirik
                      </button>
                      <button
                        onClick={() =>
                          handleCopy(
                            `${selectedHymn.haleluyaTitle}\n\n${selectedHymn.stanzaComparison.simalungunStanza}\n\nTerjemahan:\n${selectedHymn.stanzaComparison.indonesianStanza}`,
                            `hymn-${selectedHymn.id}`
                          )
                        }
                        className="px-3 py-2.5 text-xs sm:text-sm font-medium bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedId === `hymn-${selectedHymn.id}` ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Primary Side-by-Side Simalungun & Indonesian Cards (2 Large Columns on Tablet/Desktop, Stacked Clearly on HP) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Lirik Asli Bahasa Simalungun */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181615] border-2 border-[#9A3412]/25 dark:border-amber-800/40 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
                        <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#9A3412] dark:text-amber-400">
                          1. Lirik Asli Simalungun
                        </span>
                        <span className="text-[11px] font-mono text-stone-400">
                          Teks Utama
                        </span>
                      </div>
                      <p className="font-serif text-base sm:text-lg text-stone-900 dark:text-stone-100 leading-loose whitespace-pre-line">
                        {selectedHymn.stanzaComparison.simalungunStanza}
                      </p>
                    </div>

                    {/* Terjemahan Bahasa Indonesia / Kidung Jemaat */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181615] border border-stone-200/90 dark:border-stone-800 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-stone-100 dark:border-stone-800 pb-2">
                        <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                          2. {selectedHymn.isSystemAutoTranslated ? 'Arti Bahasa Indonesia' : 'Lirik Kidung Jemaat (KJ)'}
                        </span>
                        {selectedHymn.isSystemAutoTranslated && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 text-[10px] font-semibold">
                            Terjemahan Otomatis dari Sistem
                          </span>
                        )}
                      </div>
                      <p className="text-base sm:text-lg text-stone-800 dark:text-stone-200 leading-loose whitespace-pre-line">
                        {selectedHymn.stanzaComparison.indonesianStanza}
                      </p>
                    </div>
                  </div>

                  {/* Line-by-Line Parallel Stanza Breakdown (Super easy to follow on HP!) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181615] border border-stone-200/80 dark:border-stone-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200">
                        Baca Baris demi Baris (Simalungun ↔ Arti Indonesia):
                      </span>
                      {selectedHymn.isSystemAutoTranslated && (
                        <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          *Terjemahan Otomatis dari Sistem
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-stone-100 dark:divide-stone-800">
                      {selectedHymn.stanzaComparison.simalungunStanza
                        .split('\n')
                        .map((smgLine, idx) => {
                          const idnLines = selectedHymn.stanzaComparison.indonesianStanza.split('\n');
                          const idnLine = idnLines[idx] || '';
                          return (
                            <div key={idx} className="py-2.5 space-y-1">
                              <div className="font-serif font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                                {smgLine}
                              </div>
                              {idnLine && (
                                <div className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
                                  → {idnLine}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* English & Verbatim Bible Parallel Footer */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                    <div className="p-4 rounded-xl bg-white dark:bg-[#181615] border border-stone-200/80 dark:border-stone-800 space-y-1.5">
                      <div className="font-semibold text-[#1E3A8A] dark:text-blue-400">
                        3. Versi Bahasa Inggris ({selectedHymn.englishTitle})
                      </div>
                      <p className="italic text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                        {selectedHymn.stanzaComparison.englishStanza}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-[#181615] border border-stone-200/80 dark:border-stone-800 space-y-1.5">
                      <div className="font-mono font-bold text-[#9A3412] dark:text-amber-400">
                        Ayat Bibel Sejajar ({selectedHymn.biblicalParallel.reference})
                      </div>
                      <p className="font-serif font-semibold text-stone-900 dark:text-stone-100 leading-relaxed">
                        &ldquo;{selectedHymn.biblicalParallel.simalungunText}&rdquo;
                      </p>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        {selectedHymn.biblicalParallel.indonesianText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Simalungun Song / Lyric Auto-Translator (HP Friendly + 1-Tap Examples) */}
              <div className="pt-6 border-t border-stone-200 dark:border-stone-800 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
                      Terjemahkan Lagu / Lirik Simalungun Lainnya
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                      Terjemahan Otomatis dari Sistem
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                    Ada lagu Simalungun yang belum ada terjemahan resminya? Ketik atau tempel liriknya di bawah ini (atau klik contoh lagu di bawah), lagu akan tetap keluar lengkap dengan <strong>Terjemahan Otomatis dari Sistem</strong>.
                  </p>

                  {/* 1-Tap Sample Song Pills for Mobile Users */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs font-semibold text-stone-500">Coba 1-Klik Lagu:</span>
                    {[
                      {
                        title: 'Sitalasari (Lagu Simalungun Populer)',
                        lyrics:
                          'Sitalasari bunga ni pargaulan,\nUlang lupa ham bani padanta,\nAge daoh ahu hun lambungmu,\nSai tong do ingot uhurhu bamu.',
                      },
                      {
                        title: 'Tading ma Ham Na Tading',
                        lyrics:
                          'Tading ma ham na tading, borhat ma ahu na laho,\nHoras ma ham na tading, sai jumpah ma use,\nTondong pakon sanina, ulang lupa martonggo.',
                      },
                      {
                        title: 'Doding Pujian Simalungun',
                        lyrics:
                          'Puji ma Jahowa ale tonduyhu,\nHalani banggal ni holong-Ni banta,\nSai ihutkon ma hata-Ni ganup ari.',
                      },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCustomSongTitle(preset.title);
                          setCustomSongLyrics(preset.lyrics);
                          const instant = translateOfflineInstant(
                            preset.lyrics,
                            'smg-to-id',
                            'alkitab',
                            allLexicon
                          );
                          setCustomSongAutoTranslation(instant.translatedText);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 hover:bg-[#F3EFE6] border border-stone-300/80 dark:border-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 cursor-pointer"
                      >
                        {preset.title}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleTranslateCustomSong} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-5 space-y-3">
                    <input
                      type="text"
                      value={customSongTitle}
                      onChange={(e) => setCustomSongTitle(e.target.value)}
                      placeholder="Judul Lagu Simalungun (mis: Sitalasari / Doding Haleluya...)"
                      className="w-full px-4 py-2.5 text-sm bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-300/80 dark:border-stone-700 font-medium"
                    />
                    <textarea
                      value={customSongLyrics}
                      onChange={(e) => setCustomSongLyrics(e.target.value)}
                      rows={4}
                      placeholder="Ketik atau tempel bait lirik lagu Simalungun di sini..."
                      className="w-full px-4 py-3 text-sm sm:text-base bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-300/80 dark:border-stone-700 font-serif leading-relaxed"
                    />
                    <button
                      type="submit"
                      disabled={isTranslatingSong || !customSongLyrics.trim()}
                      className="w-full sm:w-auto px-5 py-3 text-xs sm:text-sm font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isTranslatingSong ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Menerjemahkan Lirik Lagu...
                        </>
                      ) : (
                        <>
                          <Music className="w-4 h-4" />
                          Tampilkan Lagu & Terjemahan Otomatis Sistem
                        </>
                      )}
                    </button>
                  </div>

                  <div className="lg:col-span-7">
                    {customSongAutoTranslation ? (
                      <div className="p-4 sm:p-6 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-stone-200/80 dark:border-stone-800">
                          <h4 className="font-serif font-bold text-lg sm:text-xl text-stone-900 dark:text-stone-100">
                            {customSongTitle.trim() || 'Lagu Simalungun'}
                          </h4>
                          <span className="px-3 py-1 rounded-md bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                            Terjemahan Otomatis dari Sistem
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-white dark:bg-[#181615] border border-stone-200/80 dark:border-stone-800 space-y-1.5">
                            <div className="text-xs font-bold uppercase tracking-wider text-[#9A3412] dark:text-amber-400">
                              Lirik Asli Simalungun
                            </div>
                            <p className="font-serif text-base sm:text-lg text-stone-900 dark:text-stone-100 whitespace-pre-line leading-loose">
                              {customSongLyrics}
                            </p>
                          </div>
                          <div className="p-4 rounded-xl bg-white dark:bg-[#181615] border border-stone-200/80 dark:border-stone-800 space-y-1.5">
                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                              Arti Indonesia (Otomatis Sistem)
                            </div>
                            <p className="text-base sm:text-lg text-stone-800 dark:text-stone-200 whitespace-pre-line leading-loose">
                              {customSongAutoTranslation}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-800 text-sm text-stone-500 leading-relaxed">
                        Ketik lirik lagu Simalungun di sebelah kiri (atau klik salah satu tombol contoh lagu di atas) untuk melihat lirik berdampingan dengan <span className="font-semibold text-amber-800 dark:text-amber-300">Terjemahan Otomatis dari Sistem</span>.
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </section>

            {/* Section B: Video Grid */}
            <section className="space-y-4">
              <h2 className="text-xl font-serif font-bold">
                Video Komedi Simalungun, Percakapan Santai & Doding Haleluya
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {VIDEO_REFERENCES.map((vid) => {
                  const embedUrl = vid.playlistId
                    ? `https://www.youtube.com/embed/${vid.youtubeId}?list=${vid.playlistId}`
                    : `https://www.youtube.com/embed/${vid.youtubeId}`;
                  return (
                    <div
                      key={vid.id}
                      className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 overflow-hidden"
                    >
                      <div className="aspect-video w-full bg-stone-950">
                        <iframe
                          src={embedUrl}
                          title={vid.title}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="text-xs text-stone-400">{vid.category}</div>
                        <h3 className="font-serif font-bold text-base">{vid.title}</h3>
                        <p className="text-xs text-stone-500">{vid.description}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          {vid.featuredVocabulary.map((fv, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 text-xs"
                            >
                              <div className="font-serif font-bold">{fv.word}</div>
                              <div className="text-[#9A3412]">{fv.meaning}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Section C: Web Dialect & Reference Verification */}
            <section className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-serif font-bold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#9A3412]" />
                  Konfirmasi Kosakata, Umpasa & Adat Simalungun
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Tanyakan makna kata, perbedaan dialek, atau adat Simalungun untuk diverifikasi dengan literatur & web.
                </p>
              </div>

              <form onSubmit={handleVerifyDialect} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={verifyQuery}
                  onChange={(e) => setVerifyQuery(e.target.value)}
                  placeholder="Tanyakan kosakata, umpasa, atau adat Simalungun..."
                  className="flex-1 px-4 py-2.5 text-xs bg-[#FAF8F5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800"
                />
                <button
                  type="submit"
                  disabled={isVerifyingDialect}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#9A3412] rounded-xl flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  {isVerifyingDialect ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Memeriksa...
                    </>
                  ) : (
                    <>
                      <HelpCircle className="w-3.5 h-3.5" />
                      Verifikasi
                    </>
                  )}
                </button>
              </form>

              {verifyError && <div className="text-xs text-red-600">{verifyError}</div>}

              {verifyResult && (
                <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs space-y-3">
                  <p className="leading-relaxed whitespace-pre-line">{verifyResult.analysis}</p>
                </div>
              )}

              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex flex-wrap gap-2 text-xs">
                {EXTERNAL_REFERENCES.map((ref, idx) => (
                  <a
                    key={idx}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-[#9A3412] flex items-center gap-1.5 text-stone-700 dark:text-stone-300"
                  >
                    <span>{ref.title}</span>
                    <ExternalLink className="w-3 h-3 text-[#9A3412]" />
                  </a>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* =====================================================================
          MODAL 1: 4 ATTACHED PDF DOCUMENTS VIEWER
         ===================================================================== */}
      {showPdfDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF8F5] dark:bg-stone-900 w-full max-w-6xl h-[88vh] rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col overflow-hidden shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h2 className="text-lg font-serif font-bold">
                  Pustaka 4 Dokumen PDF Asli (Kamus Balai Bahasa & Alkitab Sejajar)
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-800 rounded-lg text-xs">
                  <button
                    onClick={() => setActivePdfTab('kamus-2016')}
                    className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
                      activePdfTab === 'kamus-2016'
                        ? 'bg-white dark:bg-stone-900 text-[#9A3412]'
                        : 'text-stone-600'
                    }`}
                  >
                    1. PDF Kamus Simalungun (2016 & 2015)
                  </button>
                  <button
                    onClick={() => setActivePdfTab('bibel-parallel')}
                    className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
                      activePdfTab === 'bibel-parallel'
                        ? 'bg-white dark:bg-stone-900 text-[#9A3412]'
                        : 'text-stone-600'
                    }`}
                  >
                    2. PDF Bibel Simalungun & Alkitab TB
                  </button>
                </div>

                <button
                  onClick={() => setShowPdfDrawer(false)}
                  className="p-2 text-stone-500 hover:text-stone-900 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {activePdfTab === 'kamus-2016' ? (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-stone-800 overflow-hidden">
                <div className="flex flex-col h-full">
                  <div className="px-4 py-2 bg-stone-100 dark:bg-stone-950 flex items-center justify-between text-xs font-medium">
                    <span>Kamus Bahasa Simalungun–Indonesia (Edisi 2016)</span>
                    <a
                      href="assets/aistudio/Kamus_Bahasa_Simalungun-Indonesia__2016__cdb45e49.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#9A3412] hover:underline flex items-center gap-1"
                    >
                      Tab Baru <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <iframe
                    src="assets/aistudio/Kamus_Bahasa_Simalungun-Indonesia__2016__cdb45e49.pdf"
                    title="Kamus 2016"
                    className="w-full flex-1 border-0"
                  />
                </div>
                <div className="flex flex-col h-full">
                  <div className="px-4 py-2 bg-stone-100 dark:bg-stone-950 flex items-center justify-between text-xs font-medium">
                    <span>Kamus Simalungun–Indonesia (Edisi 2015)</span>
                    <a
                      href="assets/aistudio/KAMUS-SIMALUNGUN-INDONESIA_e0d70b76.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#9A3412] hover:underline flex items-center gap-1"
                    >
                      Tab Baru <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <iframe
                    src="assets/aistudio/KAMUS-SIMALUNGUN-INDONESIA_e0d70b76.pdf"
                    title="Kamus 2015"
                    className="w-full flex-1 border-0"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-stone-800 overflow-hidden">
                <div className="flex flex-col h-full">
                  <div className="px-4 py-2 bg-stone-100 dark:bg-stone-950 flex items-center justify-between text-xs font-medium">
                    <span>Bibel Bahasa Simalungun</span>
                    <a
                      href="assets/aistudio/alkitab_simalungun_00d96e9c.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#9A3412] hover:underline flex items-center gap-1"
                    >
                      Tab Baru <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <iframe
                    src="assets/aistudio/alkitab_simalungun_00d96e9c.pdf"
                    title="Bibel Simalungun"
                    className="w-full flex-1 border-0"
                  />
                </div>
                <div className="flex flex-col h-full">
                  <div className="px-4 py-2 bg-stone-100 dark:bg-stone-950 flex items-center justify-between text-xs font-medium">
                    <span>Alkitab Terjemahan Baru</span>
                    <a
                      href="assets/aistudio/alkitab_terjemahan_baru_37df3eea.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#9A3412] hover:underline flex items-center gap-1"
                    >
                      Tab Baru <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <iframe
                    src="assets/aistudio/alkitab_terjemahan_baru_37df3eea.pdf"
                    title="Alkitab TB"
                    className="w-full flex-1 border-0"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: TAMBAH KOSAKATA BARU
         ===================================================================== */}
      {showAddWordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="text-base font-serif font-bold">Tambah Kosakata Baru</h3>
              <button
                onClick={() => setShowAddWordModal(false)}
                className="text-stone-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomWord} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Kata Simalungun *</label>
                <input
                  type="text"
                  required
                  value={newWordSmg}
                  onChange={(e) => setNewWordSmg(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Arti Bahasa Indonesia *</label>
                <input
                  type="text"
                  required
                  value={newWordIdn}
                  onChange={(e) => setNewWordIdn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium mb-1">Kelas Kata</label>
                  <select
                    value={newWordPos}
                    onChange={(e) => setNewWordPos(e.target.value as PartOfSpeech)}
                    className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                  >
                    <option value="kb">Kata Benda (kb)</option>
                    <option value="kk">Kata Kerja (kk)</option>
                    <option value="ks">Kata Sifat (ks)</option>
                    <option value="ungkapan">Ungkapan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Kategori</label>
                  <select
                    value={newWordCat}
                    onChange={(e) => setNewWordCat(e.target.value as LexiconCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                  >
                    <option value="Percakapan Harian">Percakapan Harian</option>
                    <option value="Adat & Partuturan">Adat & Partuturan</option>
                    <option value="Alkitab / Pustaka">Alkitab / Pustaka</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Contoh Kalimat Simalungun</label>
                <input
                  type="text"
                  value={newWordExampleSmg}
                  onChange={(e) => setNewWordExampleSmg(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddWordModal(false)}
                  className="px-4 py-2 rounded-lg text-stone-500 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-[#9A3412] cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
