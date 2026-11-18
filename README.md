# Simalungunku

Kamus Bahasa Simalungun–Indonesia berbasis korpus sejajar Alkitab Simalungun & Terjemahan Baru, variasi dialek wilayah, penerjemah suara dengan TTS, serta penerjemah kamera/foto.

## Publikasikan ke GitHub Pages

Website versi siap pakai sudah ada di folder **`docs/`**, jadi tidak perlu build di GitHub.

1. Di VS Code: **Source Control → Initialize Repository → Commit → Publish Branch** (pilih *public*).
2. Di GitHub buka repo → **Settings → Pages**.
3. **Source**: `Deploy from a branch`. **Branch**: `main` dan folder **`/docs`** → **Save**.
4. Tunggu 1–2 menit, lalu buka `https://<username>.github.io/<nama-repo>/`.

> Jangan pilih folder `/ (root)`, karena isinya source code mentah dan hasilnya halaman kosong (blank).

Di GitHub Pages tidak ada server, jadi fitur Gemini AI (`/api/*`) tidak aktif. Kamus, penerjemah mode Instan/Offline, kalkulator partuturan, lagu, pencarian korpus, dan PDF tetap berfungsi.

## Kalau kodenya diubah

Setelah mengubah file di `src/`, build ulang dulu supaya `docs/` ikut ter-update, lalu commit & push:

```
npm install
npm run build
```

## Korpus paralel Alkitab

`public/data/bible-parallel.json` berisi ±31.000 ayat Bibel Simalungun 2007 yang disejajarkan per ayat dengan Alkitab Terjemahan Baru. `public/data/smg-lexicon.json` berisi ±21.000 kata Simalungun beserta arti yang dipelajari secara statistik (IBM Model 1, dua arah) dari kedua Alkitab. Keduanya dibuat dari PDF di `public/assets/aistudio/` dan dipakai oleh panel *Korpus Paralel* serta penerjemah offline.

Untuk membuat ulang (misalnya setelah mengubah `scripts/parse-bible.mjs`):

```
npm run build:corpus
npm run build
```

## Versi pribadi berpassword di Cloudflare (dengan Doding Haleluya)

Lirik Doding Haleluya (© GKPS) **tidak pernah masuk ke GitHub**. Liriknya disimpan di `private-data/` (diabaikan Git) dan hanya ikut ke situs Cloudflare Pages, yang seluruh halamannya dikunci kata sandi oleh `functions/_middleware.js`.

Sekali saja:

1. Buat akun gratis di https://dash.cloudflare.com
2. Ekstrak lirik dari aplikasi BibelDoding: buka `.xapk` (file zip), lalu `com.rilixtech.bibeldoding.apk` di dalamnya (juga zip), dan ambil `assets/databases/song.db`. Setelah itu jalankan:
   ```
   python scripts/export-doding.py path/ke/song.db
   ```
3. Masuk ke Cloudflare dari terminal (browser akan terbuka):
   ```
   npx wrangler login
   ```
4. Deploy pertama (pilih *Create a new project* jika ditanya, nama: `pustaha-simalungun`):
   ```
   npm run deploy:cf
   ```
5. Atur kata sandi situs (ketik kata sandinya saat diminta):
   ```
   npx wrangler pages secret put SITE_PASSWORD --project-name pustaha-simalungun
   ```
6. Jalankan `npm run deploy:cf` sekali lagi agar kata sandi aktif. Situs ada di `https://pustaha-simalungun.pages.dev`.

Setiap ada perubahan cukup jalankan `npm run deploy:cf`. Untuk tes di komputer: buat file `.dev.vars` berisi `SITE_PASSWORD=...`, lalu `npm run build:cf` dan `npm run preview:cf`.

## Pasang di HP (aplikasi offline)

Buka situsnya di Chrome HP → menu ⋮ → **Tambahkan ke layar utama / Instal aplikasi**. Halaman yang sudah pernah dibuka (termasuk data korpus dan lirik) tersimpan dan bisa dibuka tanpa internet.

## Jalankan di komputer (lengkap dengan fitur AI)

Butuh Node.js 20.19+ atau 22+.

1. `npm install`
2. Salin `.env.example` menjadi `.env.local`, lalu isi `GEMINI_API_KEY`.
3. `npm run dev` → buka http://localhost:3000
