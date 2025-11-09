from typing import Optional
from sqlmodel import SQLModel, Field


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: Optional[str] = None
    image_url: str  # ссылка на jpg/png
    image_blob: Optional[bytes] = None  # BLOB с содержимым изображения
    color: Optional[str] = None
    tags: Optional[str] = None  # через запятую


