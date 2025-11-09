#!/usr/bin/env bash
# Простой скрипт для запуска проекта локально

# Переходим в папку проекта
cd "/home/username/Рабочий стол/my py/Sobirator/interior-collage"

# Создаём виртуальное окружение, если его нет
if [ ! -d ".venv" ]; then
    echo "Создаю виртуальное окружение..."
    python3 -m venv .venv
fi

# Активируем виртуальное окружение (ВАЖНО!)
source .venv/bin/activate

# Устанавливаем зависимости
echo "Устанавливаю зависимости..."
pip install -q --upgrade pip
pip install -q fastapi "uvicorn[standard]" sqlmodel sqlalchemy pandas openpyxl python-dotenv python-multipart httpx

# Запускаем сервер
echo "Запускаю сервер на http://127.0.0.1:8000"
echo "Для остановки нажми Ctrl+C"
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
