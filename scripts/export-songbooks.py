"""Exports the hymnbooks from the BibelDoding app database for private study.

Books: Doding Haleluya (GKPS), Kidung Jemaat and Pelengkap KJ (YAMUGER),
Nyanyikanlah Kidung Baru (GKI). All are copyrighted, so the output goes to
private-data/ (git-ignored) and is only deployed to the password-protected
Cloudflare Pages site.

Doding Haleluya songs whose credits name an Indonesian counterpart
("KJ 8", "PKJ 66", "NKB 114") are linked to it, so both lyrics can be shown side by side.

Usage:
    python scripts/export-songbooks.py <path/to/song.db> [path/to/dodhaleluya.db]

song.db is assets/databases/song.db inside com.rilixtech.bibeldoding.apk
(the .apk is itself inside the .xapk; both are zip files).

dodhaleluya.db (optional) is assets/dodhaleluya.db inside the GratiaNet
"Doding Haleluya" app (gratianet.com.dodinghaleluya). Only its song categories
(kategori: Puji-pujian, Ajal ni Jolma, Partubuh ni Tuhan Jesus, ...) are used.
"""
import json
import re
import sqlite3
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "private-data" / "songbooks.json"
BOOKS = [
    # (book_id in song.db, id, name, language, copyright)
    (1, "DH", "Doding Haleluya", "smg", "GKPS"),
    (2, "KJ", "Kidung Jemaat", "id", "YAMUGER"),
    (3, "PKJ", "Pelengkap Kidung Jemaat", "id", "YAMUGER"),
    (4, "NKB", "Nyanyikanlah Kidung Baru", "id", "GKI"),
]
REF_RE = re.compile(r"\b(KJ|PKJ|NKB)\b[\s.\-–:]*0*(\d{1,3})")
# Original-language titles quoted in the credits (English or German), used for hymnary.org links.
ORIGINAL_RE = re.compile(r"(?:Syair:\s*)?([A-Z][^;,|]*?(?:/[^;,|]+)?)\s*,\s*[A-Z][a-z]+ [A-Z]")


def clean(value):
    value = (value or "").replace("\r", "").strip()
    return value or None


def split_stanzas(lyric):
    """Handles '1.Line\\nLine' (DH) and '1\\nLine\\nLine' / 'Reff:\\nLine' (KJ, PKJ, NKB)."""
    stanzas = []
    for block in re.split(r"\n[ \t]*\n", (lyric or "").replace("\r", "").strip()):
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue
        label = ""
        m = re.match(r"^(\d+)\s*\.?\s*(.*)$", lines[0])
        if m and (m.group(2) == "" or "." in lines[0][: len(m.group(1)) + 2]):
            label = m.group(1)
            lines = ([m.group(2)] if m.group(2) else []) + lines[1:]
        elif re.match(r"^ref+\s*[:.]?\s*$", lines[0], re.I):
            label = "Reff"
            lines = lines[1:]
        elif re.match(r"^ref+\s*[:.]", lines[0], re.I):
            label = "Reff"
            lines[0] = re.sub(r"^ref+\s*[:.]\s*", "", lines[0], flags=re.I)
        if lines:
            stanzas.append({"n": label, "lines": lines})
    return stanzas


def add_categories(out, gratia_db_path):
    """Adds the GratiaNet category of each Doding Haleluya song (matched by song number)."""
    db = sqlite3.connect(f"file:{gratia_db_path}?mode=ro", uri=True)
    names = {cid: name for cid, name in db.execute("select id, kategori from kategori") if cid != 0}
    by_number = {str(no): cat for no, cat in db.execute("select no, kategori from doding")}
    dh = next(b for b in out["books"] if b["id"] == "DH")
    tagged = 0
    for song in dh["songs"]:
        cat = by_number.get(song["number"])
        if cat in names:
            song["category"] = cat
            tagged += 1
    out["categories"] = [{"id": cid, "name": name} for cid, name in sorted(names.items())]
    print(f"{tagged} DH songs categorised into {len(names)} categories")


def main():
    db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
    out = {"books": []}
    numbers = {}  # book id -> set of song numbers, to validate references
    for book_db_id, book_id, name, lang, owner in BOOKS:
        rows = db.execute(
            "select number, title, key_signature, time_signature, lyric, authors_lyric, authors_music "
            "from song where book_id = ? order by cast(number as integer), number",
            (book_db_id,),
        ).fetchall()
        songs = []
        for number, title, key, time_sig, lyric, author_lyric, author_music in rows:
            credits = " · ".join(filter(None, [clean(author_lyric), clean(author_music)])) or None
            song = {
                "number": number.strip(),
                "title": title.strip(),
                "key": clean(key),
                "time": clean(time_sig),
                "credits": credits,
                "stanzas": split_stanzas(lyric),
            }
            if credits:
                refs = [{"book": b, "number": n} for b, n in REF_RE.findall(credits)]
                if refs:
                    song["refs"] = refs
            songs.append(song)
        numbers[book_id] = {s["number"] for s in songs}
        out["books"].append({"id": book_id, "name": name, "lang": lang, "copyright": owner, "songs": songs})

    # Resolve "KJ 287" to the actual entry ("287A") and keep only references that exist.
    linked = 0
    for book in out["books"]:
        for song in book["songs"]:
            resolved = []
            for ref in song.get("refs", []):
                pool = numbers.get(ref["book"], set())
                match = ref["number"] if ref["number"] in pool else next(
                    (n for n in sorted(pool) if re.fullmatch(ref["number"] + r"[A-Z]?", n)), None
                )
                if match:
                    resolved.append({"book": ref["book"], "number": match})
            if resolved:
                song["refs"] = resolved
                linked += 1
            else:
                song.pop("refs", None)

    if len(sys.argv) > 2:
        add_categories(out, sys.argv[2])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    counts = ", ".join(f"{b['id']} {len(b['songs'])}" for b in out["books"])
    print(f"{counts}; {linked} songs linked to a counterpart -> {OUT} ({OUT.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
