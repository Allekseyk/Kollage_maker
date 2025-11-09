import os
from pathlib import Path
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session

# Определяем путь к .env файлу (он должен быть в корне проекта interior-collage)
# db.py находится в backend/, поэтому поднимаемся на уровень выше
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

# Загружаем .env ПЕРЕД чтением переменных
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    # Если .env нет в корне проекта, пробуем загрузить из текущей директории
    load_dotenv()

# Теперь читаем DATABASE_URL (он будет из .env или значение по умолчанию)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./products.db")
engine = create_engine(DATABASE_URL, echo=False)
