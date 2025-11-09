import os
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from sqlmodel import select, text

# Импортируем db - он сам загрузит .env
from .db import init_db, get_session, DATABASE_URL
from .models import Product

app = FastAPI(title="Interior Collage Builder - MVP")

# CORS
cors_origins = os.getenv("CORS_ORIGINS", "*")
origins_list = [o.strip() for o in cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static under /static and index at /
STATIC_DIR = "backend/static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def serve_index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


# Простая прокси для изображений, чтобы обойти CORS
try:
    import httpx  # type: ignore
except Exception:  # pragma: no cover
    httpx = None  # будет установлен через зависимости


@app.get("/api/proxy")
def proxy_image(url: str) -> Response:
    if httpx is None:
        return Response(status_code=500, content=b"httpx not installed")
    # безопасный таймаут и редиректы
    with httpx.Client(follow_redirects=True, timeout=10.0) as client:
        r = client.get(url)
        # передаём тип контента; блокируем опасные заголовки
        content_type = r.headers.get("content-type", "image/jpeg")
        return Response(content=r.content, media_type=content_type)


@app.get("/api/image/{product_id}")
def get_product_image(product_id: int) -> Response:
    """Отдает изображение продукта из базы данных (из image_blob)"""
    with get_session() as session:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Если есть изображение в базе (image_blob), отдаем его
        if product.image_blob:
            # Определяем тип изображения по первым байтам
            img_bytes = product.image_blob
            if img_bytes.startswith(b'\xff\xd8\xff'):
                content_type = "image/jpeg"
            elif img_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
                content_type = "image/png"
            elif img_bytes.startswith(b'GIF87a') or img_bytes.startswith(b'GIF89a'):
                content_type = "image/gif"
            elif img_bytes.startswith(b'RIFF') and b'WEBP' in img_bytes[:12]:
                content_type = "image/webp"
            else:
                content_type = "image/jpeg"  # по умолчанию
            
            return Response(content=img_bytes, media_type=content_type)
        
        # Если изображения в базе нет, пробуем загрузить через image_url
        if product.image_url and httpx:
            try:
                with httpx.Client(follow_redirects=True, timeout=10.0) as client:
                    r = client.get(product.image_url)
                    content_type = r.headers.get("content-type", "image/jpeg")
                    return Response(content=r.content, media_type=content_type)
            except Exception:
                pass
        
        raise HTTPException(status_code=404, detail="Image not found")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# Response модель без image_blob (для Pydantic v2)
class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: Optional[int] = None
    name: str
    category: Optional[str] = None
    image_url: str
    color: Optional[str] = None
    tags: Optional[str] = None


@app.get("/api/products", response_model=List[ProductResponse])
def list_products(
    search: Optional[str] = Query(default=None, description="поиск по имени/тегам"),
    category: Optional[str] = Query(default=None),
    limit: int = 50,
    offset: int = 0,
):
    with get_session() as session:
        stmt = select(Product)
        if search:
            s = f"%{search.lower()}%"
            stmt = stmt.where((Product.name.ilike(s)) | (Product.tags.ilike(s)))
        if category:
            stmt = stmt.where(Product.category == category)
        stmt = stmt.offset(offset).limit(limit)
        products = session.exec(stmt).all()
        # Преобразуем в response модель (исключаем image_blob автоматически)
        return [ProductResponse.model_validate(p) for p in products]


@app.get("/api/categories", response_model=List[str])
def list_categories() -> List[str]:
    with get_session() as session:
        rows = session.exec(select(Product.category)).all()
    cats = sorted({c for c in rows if c})
    return cats


@app.get("/api/debug/db-info")
def debug_db_info() -> Dict[str, Any]:
    """Временный endpoint для проверки подключения к БД"""
    try:
        with get_session() as session:
            # Проверяем количество записей
            count_result = session.exec(text("SELECT COUNT(*) FROM product")).first()
            # Получаем все категории
            categories_result = session.exec(
                text("SELECT DISTINCT category FROM product WHERE category IS NOT NULL AND category != ''")
            ).all()
            # Получаем несколько примеров продуктов
            sample_products = session.exec(
                select(Product).limit(5)
            ).all()
            
        return {
            "database_url": DATABASE_URL,
            "total_products": count_result,
            "categories": categories_result,
            "categories_count": len(categories_result) if categories_result else 0,
            "sample_products": [
                {"name": p.name, "category": p.category, "id": p.id} 
                for p in sample_products
            ]
        }
    except Exception as e:
        return {
            "database_url": DATABASE_URL,
            "error": str(e),
            "error_type": type(e).__name__
        }


