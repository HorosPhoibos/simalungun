# Pustaha Simalungun

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

## Jalankan di komputer (lengkap dengan fitur AI)

Butuh Node.js 20.19+ atau 22+.

1. `npm install`
2. Salin `.env.example` menjadi `.env.local`, lalu isi `GEMINI_API_KEY`.
3. `npm run dev` → buka http://localhost:3000
