import os
from typing import List, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from sqlmodel import select

# Импортируем db - он сам загрузит .env
from .db import init_db, get_session
from .models import Product

app = FastAPI(title="Interior Collage Builder - MVP")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def root():
    return FileResponse("static/index.html")

@app.get("/products")
def get_products(
    skip: int = 0,
    limit: int = 10,
    name: Optional[str] = Query(None),
    session=Depends(get_session)
):
    query = select(Product)
    if name:
        query = query.where(Product.name.contains(name))
    products = session.exec(query).all()
    return products

@app.post("/products")
def create_product(product: Product, session=Depends(get_session)):
    session.add(product)
    session.commit()
    session.refresh(product)
    return product

@app.get("/products/{product_id}")
def get_product(product_id: int, session=Depends(get_session)):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.put("/products/{product_id}")
def update_product(product_id: int, product: Product, session=Depends(get_session)):
    db_product = session.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in product.dict(exclude_unset=True).items():
        setattr(db_product, key, value)
    session.commit()
    session.refresh(db_product)
    return db_product

@app.delete("/products/{product_id}")
def delete_product(product_id: int, session=Depends(get_session)):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    session.delete(product)
    session.commit()
    return Response(status_code=204)

@app.get("/api/debug/db-info")
def debug_db_info():
    """Временный endpoint для проверки подключения к БД"""
    import os
    from .db import DATABASE_URL, engine
    
    with get_session() as session:
        from sqlmodel import select, text
        # Проверяем количество записей
        count_result = session.exec(text("SELECT COUNT(*) FROM product")).first()
        # Получаем все категории
        categories_result = session.exec(text("SELECT DISTINCT category FROM product WHERE category IS NOT NULL")).all()
        
    return {
        "database_url": DATABASE_URL,
        "total_products": count_result,
        "categories": categories_result,
        "categories_count": len(categories_result) if categories_result else 0
    }
