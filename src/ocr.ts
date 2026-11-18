// Reads printed text from a photo in the browser with Tesseract.js (open source, no server).
// The engine and the Indonesian language data (also fine for Simalungun's Latin script)
// are downloaded on first use and cached by the browser.
import type { Worker } from 'tesseract.js';

export interface OcrLine {
  text: string;
  confidence: number;
  /** [ymin, xmin, ymax, xmax] on a 0–1000 scale of the image, like the camera overlay expects */
  box: [number, number, number, number];
  paragraph: number;
}

let workerPromise: Promise<Worker> | null = null;

function getWorker(onProgress?: (p: number, status: string) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) =>
        createWorker('ind', 1, {
          logger: (m: { progress: number; status: string }) => onProgress?.(m.progress, m.status),
        })
      )
      .catch((err) => {
        workerPromise = null; // allow retry, e.g. after going online
        throw err;
      });
  }
  return workerPromise;
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

const STATUS_LABEL: Record<string, string> = {
  'loading tesseract core': 'Memuat mesin pembaca teks',
  'initializing tesseract': 'Menyiapkan mesin pembaca teks',
  'loading language traineddata': 'Mengunduh data bahasa (sekali saja)',
  'initializing api': 'Menyiapkan',
  'recognizing text': 'Membaca teks di foto',
};

/** Recognises the text lines of an image (data URL). */
export async function recognizeLines(
  imageDataUrl: string,
  onProgress?: (percent: number, label: string) => void
): Promise<OcrLine[]> {
  const report = (p: number, status: string) => onProgress?.(Math.round(p * 100), STATUS_LABEL[status] ?? 'Memproses');
  const [worker, size] = await Promise.all([getWorker(report), imageSize(imageDataUrl)]);
  const { data } = await worker.recognize(imageDataUrl, {}, { blocks: true });

  const lines: OcrLine[] = [];
  let paragraph = 0;
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      paragraph++;
      for (const line of para.lines) {
        const text = line.text.replace(/\s+/g, ' ').trim();
        // Skip noise: very short fragments or lines with almost no letters.
        if (text.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 3 || line.confidence < 30) continue;
        const { x0, y0, x1, y1 } = line.bbox;
        lines.push({
          text,
          confidence: line.confidence,
          box: [
            Math.round((y0 / size.height) * 1000),
            Math.round((x0 / size.width) * 1000),
            Math.round((y1 / size.height) * 1000),
            Math.round((x1 / size.width) * 1000),
          ],
          paragraph,
        });
      }
    }
  }
  return lines;
}
