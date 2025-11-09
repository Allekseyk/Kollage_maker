import sys
import math
import pandas as pd
from sqlmodel import select

from .db import init_db, get_session
from .models import Product

"""
Ожидаемые колонки в Excel:
- name (обязательно)
- image_url (обязательно)
- category (опционально)
- color (опционально)
- tags (опционально)

Пример запуска:
python -m backend.import_excel "/полный/путь/к/файлу.xlsx"
"""


def normalize_column_name(column_name: str) -> str:
    return column_name.strip().lower().replace(" ", "_")


def first_existing(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for c in candidates:
        if c in df.columns:
            return c
    return None


def main(xlsx_path: str) -> None:
    init_db()
    df = pd.read_excel(xlsx_path)
    df.columns = [normalize_column_name(str(c)) for c in df.columns]

    # Определяем колонки по нескольким вариантам из файла
    name_col = first_existing(df, ["name", "title", "наименование", "название"])
    category_col = first_existing(df, ["category", "категория"])
    image_col = first_existing(
        df,
        [
            "фото1",
            "photo",
            "picture",
            "image_url",
            "image",
            "main_image",
        ],
    )

    if not name_col:
        raise ValueError("Не найдена колонка с названием товара (name/title/наименование)")
    if not image_col:
        raise ValueError("Не найдена колонка с ссылкой на картинку (Фото1/Photo/picture/image_url)")

    with get_session() as session:
        created = 0
        skipped = 0
        for _, row in df.iterrows():
            raw_name = row.get(name_col, "")
            raw_img = row.get(image_col, "")
            if isinstance(raw_name, float) and math.isnan(raw_name):
                raw_name = ""
            if isinstance(raw_img, float) and math.isnan(raw_img):
                raw_img = ""

            name = str(raw_name).strip()
            image_url = str(raw_img).strip()
            if not name or not image_url:
                skipped += 1
                continue

            category = None
            if category_col is not None:
                raw_cat = row.get(category_col, "")
                if isinstance(raw_cat, float) and math.isnan(raw_cat):
                    raw_cat = ""
                category = str(raw_cat).strip() or None

            color = None
            if "color" in df.columns:
                rc = row.get("color", "")
                if isinstance(rc, float) and math.isnan(rc):
                    rc = ""
                color = str(rc).strip() or None
            tags = None
            if "tags" in df.columns:
                rt = row.get("tags", "")
                if isinstance(rt, float) and math.isnan(rt):
                    rt = ""
                tags = str(rt).strip() or None

            exists = session.exec(
                select(Product).where(
                    Product.name == name,
                    Product.image_url == image_url,
                )
            ).first()
            if exists:
                skipped += 1
                continue

            p = Product(
                name=name,
                category=category,
                image_url=image_url,
                color=color,
                tags=tags,
            )
            session.add(p)
            created += 1

        session.commit()

    print(f"Импорт завершён. Создано: {created}, пропущено: {skipped}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Укажи путь к Excel: python -m backend.import_excel /path/to/file.xlsx")
        sys.exit(1)
    main(sys.argv[1])


