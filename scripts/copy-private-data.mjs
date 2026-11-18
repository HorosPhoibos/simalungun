// Copies the private (copyrighted) data into the Cloudflare build output only.
// dist-cf/ is deployed to the password-protected Cloudflare Pages site and is git-ignored;
// docs/ (GitHub Pages) never receives these files.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'private-data', 'songbooks.json');
const DEST = path.join(ROOT, 'dist-cf', 'data', 'songbooks.json');

if (!fs.existsSync(SRC)) {
  console.error('private-data/songbooks.json tidak ada. Jalankan dulu:');
  console.error('  python scripts/export-songbooks.py <song.db> [dodhaleluya.db]');
  process.exit(1);
}
fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.copyFileSync(SRC, DEST);
console.log(`Copied ${path.relative(ROOT, SRC)} -> ${path.relative(ROOT, DEST)}`);
