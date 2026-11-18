import React, { useEffect, useRef, useState } from 'react';
import { Youtube, Music2, Link2, Trash2, Search, Check } from 'lucide-react';
import { deleteAudio, getAudio, getYoutubeLink, parseYoutubeId, saveAudio, setYoutubeLink, songKey } from '../songMedia';

// Recordings for one song: a YouTube video chosen by the user (official embed)
// and/or an audio file of their own, both kept on this device.

const btn =
  'min-h-[40px] px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-[#9A3412]/50';

export default function SongMedia({ book, number, searchUrl }: { book: string; number: string; searchUrl: string }) {
  const key = songKey(book, number);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ name: string; url: string } | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [editingLink, setEditingLink] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setYoutubeId(getYoutubeLink(key));
    setEditingLink(false);
    setLinkInput('');
    setLinkError(false);
    let url: string | null = null;
    let cancelled = false;
    getAudio(key).then((a) => {
      if (cancelled || !a) {
        setAudio(null);
        return;
      }
      url = URL.createObjectURL(a.blob);
      setAudio({ name: a.name, url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);

  const saveLink = () => {
    const id = parseYoutubeId(linkInput);
    if (!id) {
      setLinkError(true);
      return;
    }
    setYoutubeLink(key, id);
    setYoutubeId(id);
    setEditingLink(false);
    setLinkInput('');
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    await saveAudio(key, file);
    if (audio) URL.revokeObjectURL(audio.url);
    setAudio({ name: file.name, url: URL.createObjectURL(file) });
  };

  return (
    <div className="rounded-2xl bg-[#FAF8F5] dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 p-3 sm:p-4 space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Rekaman</div>

      {youtubeId && !editingLink && (
        <div className="space-y-2">
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
              title="Rekaman lagu (YouTube)"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditingLink(true)} className={btn}>
              <Link2 className="w-4 h-4" /> Ganti video
            </button>
            <button
              onClick={() => {
                setYoutubeLink(key, null);
                setYoutubeId(null);
              }}
              className={btn}
            >
              <Trash2 className="w-4 h-4" /> Hapus video
            </button>
          </div>
        </div>
      )}

      {(!youtubeId || editingLink) && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={linkInput}
              onChange={(e) => {
                setLinkInput(e.target.value);
                setLinkError(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && saveLink()}
              placeholder="Tempel link YouTube lagu ini"
              className="flex-1 min-w-0 min-h-[40px] px-3 text-sm bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-none focus:border-[#9A3412]"
              inputMode="url"
            />
            <button onClick={saveLink} disabled={!linkInput.trim()} className={`${btn} disabled:opacity-40`}>
              <Check className="w-4 h-4" /> Simpan
            </button>
          </div>
          {linkError && <p className="text-xs text-red-700 dark:text-red-400">Link YouTube tidak dikenali. Salin link dari tombol Bagikan di YouTube.</p>}
          <a href={searchUrl} target="_blank" rel="noreferrer" className={`${btn} w-fit`}>
            <Search className="w-4 h-4" /> <Youtube className="w-4 h-4" /> Cari rekaman di YouTube
          </a>
          <p className="text-[11px] text-stone-500 leading-relaxed">
            Cari videonya, tekan <strong>Bagikan → Salin link</strong>, lalu tempel di sini. Video akan terputar langsung di halaman lagu ini.
          </p>
        </div>
      )}

      <div className="pt-1 border-t border-stone-200/80 dark:border-stone-800 space-y-2">
        {audio ? (
          <>
            <div className="text-xs text-stone-600 dark:text-stone-400 truncate flex items-center gap-1.5 pt-2">
              <Music2 className="w-3.5 h-3.5 shrink-0" /> {audio.name}
            </div>
            <audio controls src={audio.url} className="w-full" preload="metadata" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => fileRef.current?.click()} className={btn}>
                <Music2 className="w-4 h-4" /> Ganti file
              </button>
              <button
                onClick={async () => {
                  await deleteAudio(key);
                  URL.revokeObjectURL(audio.url);
                  setAudio(null);
                }}
                className={btn}
              >
                <Trash2 className="w-4 h-4" /> Hapus file
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button onClick={() => fileRef.current?.click()} className={btn}>
              <Music2 className="w-4 h-4" /> Pilih file audio (MP3, M4A)
            </button>
            <span className="text-[11px] text-stone-500">Rekaman milikmu, tersimpan di perangkat ini.</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}
