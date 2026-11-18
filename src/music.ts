// Small music helpers for church musicians: key parsing/transposition and a metronome.
// Keys in Indonesian hymnbooks are written as "1=As" (do = A♭), "1=F", "1=Bes", "1=Es" ...

const NOTE_INDEX: Record<string, number> = {
  c: 0, cis: 1, des: 1, 'c#': 1, db: 1,
  d: 2, dis: 3, es: 3, 'd#': 3, eb: 3,
  e: 4, f: 5, fis: 6, ges: 6, 'f#': 6, gb: 6,
  g: 7, gis: 8, as: 8, 'g#': 8, ab: 8,
  a: 9, ais: 10, bes: 10, 'a#': 10, bb: 10,
  b: 11, h: 11,
};

// Spelling used in Indonesian church notation, with the international name.
const NOTE_NAMES = ['C', 'Cis/Des', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'Bes', 'B'];
const NOTE_NAMES_INTL = ['C', 'C♯/D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** "1=As" → 8 (semitones above C); null when the key is missing or unreadable. */
export function parseKey(key: string | null | undefined): number | null {
  const m = (key || '').trim().toLowerCase().match(/^(?:1\s*=\s*|do\s*=\s*)?([a-h](?:is|es|s|#|b)?)\b/);
  if (!m) return null;
  const idx = NOTE_INDEX[m[1]];
  return idx === undefined ? null : idx;
}

export function keyName(index: number): string {
  const i = ((index % 12) + 12) % 12;
  return `1=${NOTE_NAMES[i]} (${NOTE_NAMES_INTL[i]})`;
}

/** Written key for transposing instruments: B♭ instruments read 2 semitones higher, E♭ 9, F 7. */
export function writtenKeyFor(concert: number, instrument: 'Bb' | 'Eb' | 'F'): string {
  const shift = { Bb: 2, Eb: 9, F: 7 }[instrument];
  return keyName(concert + shift);
}

/** Beats per bar from "4/4", "3/4", "6/8", "4 Ketuk", "3 ketuk". */
export function beatsPerBar(time: string | null | undefined): number {
  const m = (time || '').match(/(\d+)\s*(?:\/|ketuk)/i);
  const n = m ? Number(m[1]) : 4;
  return n >= 2 && n <= 12 ? n : 4;
}

export class Metronome {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private beat = 0;

  constructor(private onBeat: (beat: number) => void) {}

  start(bpm: number, beats: number) {
    this.stop();
    this.ctx = this.ctx ?? new AudioContext();
    this.beat = 0;
    const tick = () => {
      this.click(this.beat % beats === 0);
      this.onBeat(this.beat % beats);
      this.beat++;
    };
    tick();
    this.timer = window.setInterval(tick, 60000 / bpm);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private click(accent: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }
}
