import os
import sqlite3
import shutil
import sys
from pathlib import Path
from typing import Iterable, Tuple

try:
    import httpx  # type: ignore
except Exception:
    httpx = None


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "products.db"
# Целевая папка на уровне корня проекта Sobirator: /.../Sobirator/@1
TARGET_DIR = Path(PROJECT_ROOT.parents[0]) / "@1"


def ensure_target_dir() -> None:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)


def fetch_rows(conn: sqlite3.Connection) -> Iterable[Tuple[int, str]]:
    cur = conn.cursor()
    # Таблица называется "product" по умолчанию у SQLModel
    cur.execute("SELECT id, image_url FROM product WHERE image_url IS NOT NULL AND image_url != ''")
    for row in cur.fetchall():
        try:
            _id = int(row[0])
            url = str(row[1])
        except Exception:
            continue
        low = url.lower()
        if low.endswith(".jpg") or low.endswith(".jpeg"):
            yield _id, url


def safe_filename(product_id: int, source_path: str) -> str:
    # Имя файла: <id>_<basename>
    base = os.path.basename(source_path.split("?")[0].split("#")[0]) or f"{product_id}.jpg"
    # Страхуем расширение
    low = base.lower()
    if not (low.endswith(".jpg") or low.endswith(".jpeg")):
        base = f"{base}.jpg"
    return f"{product_id}_" + base


def is_http(url: str) -> bool:
    return url.startswith("http://") or url.startswith("https://")


def download_to(path: Path, url: str) -> bool:
    if httpx is None:
        print("[WARN] httpx не установлен — пропускаю загрузку по URL")
        return False
    try:
        # Жёсткий таймаут, чтобы не зависать на медленных ресурсах
        with httpx.Client(follow_redirects=True, timeout=15.0) as client:
            r = client.get(url)
            if r.status_code == 200 and r.content:
                path.write_bytes(r.content)
                return True
            print(f"[WARN] HTTP {r.status_code} при загрузке: {url}")
    except Exception as e:
        print(f"[WARN] Ошибка загрузки {url}: {e}")
        return False
    return False


def copy_local_to(path: Path, src: str) -> bool:
    try:
        src_path = Path(src)
        if src_path.is_file():
            shutil.copy2(src_path, path)
            return True
    except Exception as e:
        print(f"[WARN] Не удалось скопировать {src} -> {path}: {e}")
        return False
    return False


def main() -> int:
    if not DB_PATH.exists():
        print(f"[ERROR] Не найден файл БД: {DB_PATH}")
        return 1

    ensure_target_dir()
    print(f"Экспорт JPG в: {TARGET_DIR}")

    # Возможность быстро проверить часть данных
    max_items_env = os.getenv("EXPORT_MAX")
    max_items = int(max_items_env) if (max_items_env and max_items_env.isdigit()) else None

    conn = sqlite3.connect(str(DB_PATH))
    exported = 0
    skipped = 0
    processed = 0
    try:
        for product_id, img_url in fetch_rows(conn):
            processed += 1
            if max_items is not None and processed > max_items:
                print(f"[INFO] Достигнут лимит EXPORT_MAX={max_items}")
                break

            out_name = safe_filename(product_id, img_url)
            out_path = TARGET_DIR / out_name
            if out_path.exists():
                print(f"[SKIP] Уже есть: {out_name}")
                skipped += 1
                continue

            ok = False
            if is_http(img_url):
                print(f"[{processed}] HTTP → {img_url}", flush=True)
                ok = download_to(out_path, img_url)
            else:
                # пробуем относительный путь от корня проекта и абсолютный
                rel_candidate = (PROJECT_ROOT / img_url).as_posix()
                ok = copy_local_to(out_path, rel_candidate) or copy_local_to(out_path, img_url)

            if ok:
                print(f"[OK]  {out_name}")
                exported += 1
            else:
                print(f"[ERR] {out_name}")
                skipped += 1
    finally:
        conn.close()

    print(f"Готово. Успешно: {exported}, пропущено: {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())


